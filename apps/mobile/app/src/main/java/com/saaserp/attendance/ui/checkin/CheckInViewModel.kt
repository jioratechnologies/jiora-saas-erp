package com.saaserp.attendance.ui.checkin

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.saaserp.attendance.data.remote.ColleagueDto
import com.saaserp.attendance.data.repository.AttendanceRepository
import com.saaserp.attendance.di.ServiceLocator
import com.saaserp.attendance.location.CampusGeofence
import com.saaserp.attendance.location.CampusTarget
import com.saaserp.attendance.location.GeofenceCheck
import com.saaserp.attendance.location.LocationCapture
import com.saaserp.attendance.sync.SyncScheduler
import com.saaserp.attendance.util.NetworkMonitor
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

/**
 * Four distinct states as required by ATTENDANCE_PLAN.md:
 * ONLINE+VERIFIED, OFFLINE+PENDING, FLAGGED, REJECTED.
 */
sealed class CheckInResult {
    data class Verified(val reasons: List<String>) : CheckInResult()
    data class Flagged(val reasons: List<String>) : CheckInResult()
    data class Rejected(val reason: String) : CheckInResult()
    object SavedOffline : CheckInResult()
    data class Error(val message: String) : CheckInResult()
}

/** Screen phase — camera hardware is only live during [READY] before capture. */
enum class CapturePhase { IDLE, LOCATING, OUTSIDE_RANGE, READY }

data class CheckInUiState(
    val phase: CapturePhase = CapturePhase.IDLE,
    val location: LocationCapture? = null,
    val isOnline: Boolean = false,
    val locationError: String? = null,
    val isCapturing: Boolean = false,
    val capturedPhotoPath: String? = null,
    val result: CheckInResult? = null,
    /** True once at least one event (IN or OUT) has been logged today. */
    val alreadyCheckedInToday: Boolean = false,
    /** True while checked in and not yet checked out — drives "Check In" vs "Check Out" on the home screen. */
    val sessionOpen: Boolean = false,
    /** True once today has a completed IN→OUT cycle. */
    val dayComplete: Boolean = false,
    /** Live-updating while [phase] is [CapturePhase.OUTSIDE_RANGE] — powers the "guide me to campus" arrow + distance readout. */
    val campusTarget: CampusTarget? = null,
    val distanceToCampusM: Int? = null,
    val guideLat: Double? = null,
    val guideLng: Double? = null,
    /** Set only while marking attendance for a colleague instead of yourself. */
    val targetEmployeeId: String? = null,
    val targetEmployeeName: String? = null,
    /** "IN" or "OUT" while the mark-in / mark-out reminder dialog is showing (from a tapped notification, or after organization time while still checked in). */
    val reminderPrompt: String? = null,
    val showColleagueModeChoice: Boolean = false,
    /** "IN" or "OUT" — which list the colleague picker shows and which event gets submitted for the picked colleague. */
    val colleagueMode: String = "IN",
    val showColleaguePicker: Boolean = false,
    val colleagues: List<ColleagueDto> = emptyList(),
    val colleaguesLoading: Boolean = false,
    /** "IN" or "OUT" — whichever event the pending capture (in progress via [startCapturing]) will submit as. */
    val pendingEventType: String = "IN",
    /** Set only when the pending capture is a self-declared half-day exit. */
    val pendingLeaveType: String? = null,
    val showHalfDayConfirm: Boolean = false,
    /** "Discard & retake today's attendance" — the 1st-of-the-month window the server enforces. */
    val isFirstOfMonth: Boolean = false,
    val isDiscarding: Boolean = false,
    val discardError: String? = null,
    /** Total number of punches logged today across all shifts. */
    val todayPunchCount: Int = 0,
)

class CheckInViewModel(application: Application) : AndroidViewModel(application) {
    private val repository: AttendanceRepository = ServiceLocator.attendanceRepository(application)
    private val locationHelper = ServiceLocator.locationHelper(application)

    private val _uiState = MutableStateFlow(CheckInUiState())
    val uiState: StateFlow<CheckInUiState> = _uiState.asStateFlow()

    private var guideJob: Job? = null
    private var organizationEndTime: java.time.LocalTime? = null
    private var checkoutPromptShown = false
    private var historyLoaded = false
    private var pendingReminder: String? = null

    /** Once per launch, after organization closing time, while still checked in — offers to mark out. */
    private fun maybeShowCheckoutPrompt() {
        val state = _uiState.value
        if (checkoutPromptShown || !state.sessionOpen || state.targetEmployeeId != null || state.reminderPrompt != null) return
        if (!com.saaserp.attendance.util.OrganizationHours.isPastEndTime(organizationEndTime)) return
        checkoutPromptShown = true
        _uiState.value = state.copy(reminderPrompt = "OUT")
    }

    /**
     * A tapped reminder notification wants a dialog. Deferred until today's
     * history has loaded so the dialog only shows if the action is still
     * pending (no "mark in" prompt for someone already checked in).
     */
    private fun applyPendingReminder() {
        val action = pendingReminder ?: return
        if (!historyLoaded) return
        pendingReminder = null
        val state = _uiState.value
        val prompt = when (action) {
            com.saaserp.attendance.sync.ReminderNotifier.ACTION_MARK_IN -> if (!state.sessionOpen) "IN" else null
            com.saaserp.attendance.sync.ReminderNotifier.ACTION_MARK_OUT -> if (state.sessionOpen) "OUT" else null
            else -> null
        }
        if (prompt != null) _uiState.value = state.copy(reminderPrompt = prompt)
    }

    fun dismissReminderPrompt() {
        _uiState.value = _uiState.value.copy(reminderPrompt = null)
    }

    /** "Mark In" / "Mark Out" tapped on the reminder dialog — opens location check then the camera, same as the normal button. */
    fun confirmReminderPrompt() {
        val eventType = _uiState.value.reminderPrompt ?: return
        _uiState.value = _uiState.value.copy(reminderPrompt = null, pendingEventType = eventType)
        startCapturing()
    }

    init {
        val authRepository = ServiceLocator.authRepository(application)
        val employeeId = authRepository.employeeId
        val todayIst = DateTimeFormatter.ofPattern("yyyy-MM-dd")
            .withZone(ZoneId.of("Asia/Kolkata"))
            .format(Instant.now())
        _uiState.value = _uiState.value.copy(isFirstOfMonth = todayIst.endsWith("-01"))

        // Login only populates the avatar from profiles.avatar_url (rarely
        // set — attendance selfies don't touch it, only the Staff
        // Directory portrait does). That portrait lives in a separate table
        // and previously only got fetched once the Profile tab itself was
        // opened, which is why the top-bar avatar stayed blank from a fresh
        // launch until then. Fetching it here, once per app start, fills it
        // in before the user ever has to visit Profile.
        viewModelScope.launch {
            ServiceLocator.staffRepository(application).getMyProfile()
        }

        // Reconciles local Room against the server's own record of today
        // (and any other cached date range) before the home screen decides
        // whether to show "Attendance Completed" — without this, a record
        // that an admin deleted/discarded server-side (dev-reset, a test
        // cleanup, etc.) stays "completed" on this device forever, since
        // observeHistory below only ever reads the local cache.
        viewModelScope.launch {
            repository.refreshRemoteHistory()
        }

        // Roster-tab visibility check, run once at launch so the tab is
        // there from the start for admin+ roles. A cheap probe (one boolean,
        // retried once) so a slow roster build can never hide the tab; a
        // failed probe keeps whatever was last known.
        viewModelScope.launch {
            val adminRepo = ServiceLocator.adminAttendanceRepository(application)
            val canView = adminRepo.probeRosterAccess() ?: adminRepo.probeRosterAccess()
            if (canView != null) authRepository.updateCanViewRosterAttendance(canView)
            // Warm the roster cache so opening the tab paints instantly.
            if (canView == true) adminRepo.getRoster(todayIst)
        }

        // First login: fetch + persist organization hours, arm the daily reminders.
        // Later launches re-arm from the cache immediately, then refresh.
        organizationEndTime = com.saaserp.attendance.util.OrganizationHours.cachedEndTime(application)
        com.saaserp.attendance.sync.ReminderScheduler.scheduleAll(application)
        viewModelScope.launch {
            organizationEndTime = com.saaserp.attendance.util.OrganizationHours.refresh(application).end
            com.saaserp.attendance.sync.ReminderScheduler.scheduleAll(application)
            maybeShowCheckoutPrompt()
        }
        viewModelScope.launch {
            com.saaserp.attendance.sync.ReminderNotifier.pendingAction.collect { action ->
                if (action != null) {
                    com.saaserp.attendance.sync.ReminderNotifier.pendingAction.value = null
                    pendingReminder = action
                    applyPendingReminder()
                }
            }
        }

        viewModelScope.launch {
            ColleagueRequests.markOut.collect { colleague ->
                if (colleague != null) {
                    ColleagueRequests.markOut.value = null
                    markOutColleague(colleague)
                }
            }
        }

        if (employeeId != null) {
            viewModelScope.launch {
                repository.observeHistory(employeeId).collect { list ->
                    val todayEvents = list.filter { it.attendanceDate == todayIst }.sortedBy { it.capturedAtIso }
                    val lastEvent = todayEvents.lastOrNull()
                    val sessionOpen = lastEvent?.eventType == "IN"
                    _uiState.value = _uiState.value.copy(
                        alreadyCheckedInToday = todayEvents.isNotEmpty(),
                        sessionOpen = sessionOpen,
                        dayComplete = todayEvents.isNotEmpty() && !sessionOpen,
                        pendingEventType = if (sessionOpen) "OUT" else "IN",
                        todayPunchCount = todayEvents.size,
                    )
                    historyLoaded = true
                    applyPendingReminder()
                    maybeShowCheckoutPrompt()
                }
            }
        }
    }

    /** User confirmed "Request Half-Day" — proceeds through the same checkout capture flow, tagged as a self-declared half day. */
    fun confirmHalfDayRequest() {
        _uiState.value = _uiState.value.copy(showHalfDayConfirm = false, pendingLeaveType = "HALF_DAY")
        startCapturing()
    }

    fun requestHalfDay() {
        _uiState.value = _uiState.value.copy(showHalfDayConfirm = true)
    }

    fun dismissHalfDayConfirm() {
        _uiState.value = _uiState.value.copy(showHalfDayConfirm = false)
    }

    fun openColleagueModeChoice() {
        _uiState.value = _uiState.value.copy(showColleagueModeChoice = true)
    }

    fun dismissColleagueModeChoice() {
        _uiState.value = _uiState.value.copy(showColleagueModeChoice = false)
    }

    /** [mode] "IN" lists staff not currently checked in; "OUT" lists only staff checked in and pending check-out. */
    fun openColleaguePicker(mode: String) {
        _uiState.value = _uiState.value.copy(
            showColleagueModeChoice = false,
            showColleaguePicker = true,
            colleaguesLoading = true,
            colleagueMode = mode,
            colleagues = emptyList(),
        )
        viewModelScope.launch {
            val colleagues = repository.fetchColleagues(mode)
            _uiState.value = _uiState.value.copy(colleagues = colleagues, colleaguesLoading = false)
        }
    }

    fun dismissColleaguePicker() {
        _uiState.value = _uiState.value.copy(showColleaguePicker = false)
    }

    /**
     * A colleague was picked — proceeds through the exact same location +
     * camera flow as a normal check-in. Submitted as the mode chosen in the
     * IN/OUT dialog; the picker list is already filtered server-side to
     * staff eligible for that event, and /verify re-validates the sequence.
     */
    fun selectColleague(colleague: ColleagueDto) {
        _uiState.value = _uiState.value.copy(
            showColleaguePicker = false,
            targetEmployeeId = colleague.id,
            targetEmployeeName = colleague.fullName,
            pendingEventType = _uiState.value.colleagueMode,
        )
        startCapturing()
    }

    /** Direct "Mark Out" for a colleague already known to be checked in (from History → Marked by Me). */
    fun markOutColleague(colleague: ColleagueDto) {
        _uiState.value = _uiState.value.copy(
            colleagueMode = "OUT",
            targetEmployeeId = colleague.id,
            targetEmployeeName = colleague.fullName,
            pendingEventType = "OUT",
        )
        startCapturing()
    }

    fun discardTodayForRetake() {
        _uiState.value = _uiState.value.copy(isDiscarding = true, discardError = null)
        viewModelScope.launch {
            when (val result = repository.discardTodayForRetake()) {
                is AttendanceRepository.DiscardResult.Success -> {
                    _uiState.value = _uiState.value.copy(
                        isDiscarding = false,
                        alreadyCheckedInToday = false,
                        sessionOpen = false,
                        dayComplete = false,
                        pendingEventType = "IN",
                    )
                }
                is AttendanceRepository.DiscardResult.Error -> {
                    _uiState.value = _uiState.value.copy(isDiscarding = false, discardError = result.message)
                }
            }
        }
    }

    fun dismissDiscardError() {
        _uiState.value = _uiState.value.copy(discardError = null)
    }

    fun dismissResult() {
        _uiState.value = _uiState.value.copy(result = null, capturedPhotoPath = null, isCapturing = false)
    }

    /** User tapped "Verify & Mark Attendance" — fetch GPS first, camera binds once this succeeds. */
    fun startCapturing() {
        val context = getApplication<Application>()
        _uiState.value = _uiState.value.copy(
            phase = CapturePhase.LOCATING,
            locationError = null,
            capturedPhotoPath = null,
        )

        viewModelScope.launch {
            try {
                val location = locationHelper.getCurrentLocation()

                // The camera never opens for a capture that's going to be
                // rejected anyway — the server re-checks this independently
                // (the authoritative decision), this is purely to save the
                // user a pointless selfie.
                when (val geofence = CampusGeofence.check(location.lat, location.lng)) {
                    is GeofenceCheck.Outside -> {
                        _uiState.value = _uiState.value.copy(
                            phase = CapturePhase.OUTSIDE_RANGE,
                            campusTarget = geofence.target,
                            distanceToCampusM = geofence.distanceM,
                            guideLat = location.lat,
                            guideLng = location.lng,
                        )
                        startGuideLoop(geofence.target)
                        return@launch
                    }
                    else -> Unit // Inside, NotEnforced, or Unknown (fails open) — proceed.
                }

                _uiState.value = _uiState.value.copy(
                    phase = CapturePhase.READY,
                    location = location,
                    isOnline = NetworkMonitor.isOnline(context),
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    phase = CapturePhase.IDLE,
                    locationError = e.message ?: "Could not get your location",
                )
            }
        }
    }

    /**
     * Re-polls GPS every few seconds while the employee is outside the
     * campus radius, live-updating distance so the on-screen compass arrow
     * and countdown actually track their walk — auto-advances straight to
     * [CapturePhase.READY] the moment they're back in range, no extra tap
     * needed.
     */
    private fun startGuideLoop(target: CampusTarget) {
        guideJob?.cancel()
        guideJob = viewModelScope.launch {
            while (_uiState.value.phase == CapturePhase.OUTSIDE_RANGE) {
                delay(4000)
                if (_uiState.value.phase != CapturePhase.OUTSIDE_RANGE) return@launch
                try {
                    val location = locationHelper.getCurrentLocation()
                    val distanceM = CampusGeofence.distanceMeters(location.lat, location.lng, target)
                    if (distanceM <= target.radiusM) {
                        _uiState.value = _uiState.value.copy(
                            phase = CapturePhase.READY,
                            location = location,
                            isOnline = NetworkMonitor.isOnline(getApplication()),
                            campusTarget = null,
                            distanceToCampusM = null,
                            guideLat = null,
                            guideLng = null,
                        )
                        return@launch
                    }
                    _uiState.value = _uiState.value.copy(
                        distanceToCampusM = distanceM,
                        guideLat = location.lat,
                        guideLng = location.lng,
                    )
                } catch (e: Exception) {
                    // Transient GPS hiccup mid-guide — ignore, next tick retries.
                }
            }
        }
    }

    fun cancelCapturing() {
        guideJob?.cancel()
        guideJob = null
        _uiState.value = _uiState.value.copy(
            phase = CapturePhase.IDLE,
            location = null,
            capturedPhotoPath = null,
            isCapturing = false,
            campusTarget = null,
            distanceToCampusM = null,
            guideLat = null,
            guideLng = null,
            targetEmployeeId = null,
            targetEmployeeName = null,
            pendingLeaveType = null,
        )
    }

    fun performCheckIn(photoLocalPath: String, livenessVerified: Boolean? = null) {
        val context = getApplication<Application>()
        val location = _uiState.value.location ?: run {
            _uiState.value = _uiState.value.copy(result = CheckInResult.Error("Location was lost — try again"))
            return
        }
        _uiState.value = _uiState.value.copy(
            isCapturing = true,
            capturedPhotoPath = photoLocalPath,
        )

        val targetEmployeeId = _uiState.value.targetEmployeeId
        val eventType = _uiState.value.pendingEventType
        val leaveType = _uiState.value.pendingLeaveType

        viewModelScope.launch {
            try {
                val isOnline = NetworkMonitor.isOnline(context)

                when (
                    val outcome = repository.checkIn(
                        location, photoLocalPath, isOnline,
                        eventType = eventType,
                        leaveType = leaveType,
                        livenessVerified = livenessVerified,
                        targetEmployeeId = targetEmployeeId,
                    )
                ) {
                    // alreadyCheckedInToday/sessionOpen/dayComplete all update
                    // reactively from the init{} Flow collector once the new
                    // Room row lands (dao.insert inside repository.checkIn) —
                    // no need to compute them again here, for self or proxy.
                    is AttendanceRepository.CheckInOutcome.OnlineVerified -> {
                        val result = when (outcome.status) {
                            "VERIFIED" -> CheckInResult.Verified(outcome.reasons)
                            "FLAGGED" -> CheckInResult.Flagged(outcome.reasons)
                            else -> CheckInResult.Rejected(outcome.reasons.joinToString("; "))
                        }
                        _uiState.value = _uiState.value.copy(
                            isCapturing = false,
                            result = result,
                            phase = CapturePhase.IDLE,
                            location = null,
                            targetEmployeeId = null,
                            targetEmployeeName = null,
                            pendingLeaveType = null,
                        )
                    }
                    is AttendanceRepository.CheckInOutcome.OnlineRejected -> {
                        _uiState.value = _uiState.value.copy(
                            isCapturing = false,
                            result = CheckInResult.Rejected(outcome.message),
                            phase = CapturePhase.IDLE,
                            location = null,
                            targetEmployeeId = null,
                            targetEmployeeName = null,
                            pendingLeaveType = null,
                        )
                    }
                    is AttendanceRepository.CheckInOutcome.SavedOffline -> {
                        _uiState.value = _uiState.value.copy(
                            isCapturing = false,
                            result = CheckInResult.SavedOffline,
                            phase = CapturePhase.IDLE,
                            location = null,
                            targetEmployeeId = null,
                            targetEmployeeName = null,
                            pendingLeaveType = null,
                        )
                        SyncScheduler.triggerImmediateSync(context)
                    }
                    is AttendanceRepository.CheckInOutcome.Error -> {
                        _uiState.value = _uiState.value.copy(
                            isCapturing = false,
                            result = CheckInResult.Error(outcome.message),
                            phase = CapturePhase.IDLE,
                            location = null,
                            targetEmployeeId = null,
                            targetEmployeeName = null,
                            pendingLeaveType = null,
                        )
                    }
                }
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isCapturing = false,
                    result = CheckInResult.Error(e.message ?: "Check-in failed"),
                    phase = CapturePhase.IDLE,
                    location = null,
                    targetEmployeeId = null,
                    targetEmployeeName = null,
                    pendingLeaveType = null,
                )
            }
        }
    }
}
