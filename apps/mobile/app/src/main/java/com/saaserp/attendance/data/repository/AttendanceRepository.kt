package com.saaserp.attendance.data.repository

import android.os.Build
import android.util.Log
import com.saaserp.attendance.BuildConfig
import com.saaserp.attendance.data.auth.AuthRepository
import com.saaserp.attendance.data.local.AttendanceDao
import com.saaserp.attendance.data.local.AttendanceEntity
import com.saaserp.attendance.data.remote.AttendanceApi
import com.saaserp.attendance.data.remote.PhotoUploader
import com.saaserp.attendance.data.remote.SyncRecordRequest
import com.saaserp.attendance.data.remote.SyncRequest
import com.saaserp.attendance.data.remote.VerifyRequest
import com.saaserp.attendance.location.LocationCapture
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.Flow
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.UUID

/**
 * The single place that decides ONLINE vs OFFLINE and enforces the rule
 * this whole app exists for: an OFFLINE capture is written locally as
 * PENDING_VERIFICATION / PENDING_SYNC and NEVER marked VERIFIED here.
 * Only a successful server response — from /verify (online) or /sync
 * (offline, once connectivity returns) — can set verification_status to
 * VERIFIED/FLAGGED/REJECTED. See ATTENDANCE_PLAN.md section 1.
 */
class AttendanceRepository(
    private val dao: AttendanceDao,
    private val api: AttendanceApi,
    private val authRepository: AuthRepository,
    private val photoUploader: PhotoUploader,
) {
    fun observeHistory(
        employeeId: String,
        fromDate: String? = null,
        toDate: String? = null,
        status: String? = null,
    ): Flow<List<AttendanceEntity>> =
        if (fromDate.isNullOrBlank() && toDate.isNullOrBlank() && (status == null || status == "ALL")) {
            dao.observeForEmployee(employeeId)
        } else {
            val statusFilter = if (status == "ALL" || status.isNullOrBlank()) null else status
            val fromFilter = fromDate?.ifBlank { null }
            val toFilter = toDate?.ifBlank { null }
            dao.observeFiltered(employeeId, fromFilter, toFilter, statusFilter)
        }

    /**
     * Pulls historical attendance records from the server for the current employee
     * and persists them in the local database.
     */
    suspend fun refreshRemoteHistory(
        fromDate: String? = null,
        toDate: String? = null,
        status: String? = null,
    ): Boolean {
        val employeeId = authRepository.employeeId ?: return false
        val accessToken = authRepository.currentAccessToken() ?: return false
        return try {
            val statusParam = if (status == "ALL") null else status
            val response = api.getStaffHistory(
                authorization = "Bearer $accessToken",
                from = fromDate?.ifBlank { null },
                to = toDate?.ifBlank { null },
                status = statusParam,
            )
            if (!response.isSuccessful) return false
            val body = response.body() ?: return false
            val entities = body.records.map { r ->
                val offlineId = r.offlineAttendanceId?.ifBlank { null } ?: r.id ?: UUID.randomUUID().toString()
                val capturedAt = r.capturedAt ?: Instant.now().toString()
                val attDate = r.attendanceDate ?: attendanceDateFor(capturedAt)
                AttendanceEntity(
                    offlineAttendanceId = offlineId,
                    employeeId = r.employeeId ?: employeeId,
                    capturedAtIso = capturedAt,
                    attendanceDate = attDate,
                    verificationMode = r.verificationMode ?: "ONLINE",
                    verificationStatus = r.verificationStatus ?: "VERIFIED",
                    syncStatus = r.syncStatus ?: "SYNCED",
                    verifiedAtIso = r.verifiedAt,
                    gpsLat = r.gpsLat ?: 0.0,
                    gpsLng = r.gpsLng ?: 0.0,
                    gpsAccuracyM = r.gpsAccuracyM,
                    mockLocationReported = false,
                    rootRiskReported = false,
                    developerOptionsReported = false,
                    photoLocalPath = null,
                    photoUrl = r.photoUrl,
                    deviceId = "server-record",
                    appVersion = BuildConfig.VERSION_NAME,
                    rejectionReason = r.rejectionReason,
                    createdAtIso = capturedAt,
                    eventType = r.eventType ?: "IN",
                    leaveType = r.leaveType,
                    livenessVerified = r.livenessVerified,
                )
            }
            if (entities.isNotEmpty()) {
                dao.upsertAll(entities)
            }
            dao.deleteSyncedOrphans(
                employeeId = employeeId,
                fromDate = fromDate?.ifBlank { null },
                toDate = toDate?.ifBlank { null },
                status = statusParam,
                keepIds = entities.map { it.offlineAttendanceId },
            )
            true
        } catch (e: kotlinx.coroutines.CancellationException) {
            // Screen navigated away / process killed mid-call — the caller's
            // scope is going away, not a real failure. Must rethrow: a
            // swallowed CancellationException breaks structured concurrency
            // (the parent job never learns this child actually finished).
            throw e
        } catch (e: Exception) {
            Log.e(TAG, "refreshRemoteHistory failed", e)
            false
        }
    }

    /**
     * Discards a PENDING_VERIFICATION/PENDING_SYNC record the employee no
     * longer wants to wait on — clears today's local slot so
     * [checkIn]'s one-per-day guard no longer blocks a fresh attempt.
     * Refuses to touch anything already SYNCED — a record the server has
     * seen is no longer just a local draft.
     */
    suspend fun discardPending(record: AttendanceEntity): Boolean {
        if (record.syncStatus == "SYNCED") return false
        dao.delete(record)
        return true
    }

    /**
     * TESTING ONLY — see /api/attendance/dev-reset. Wipes today's record
     * both server-side and locally so the one-check-in-per-day rule can be
     * exercised repeatedly without waiting a day. The server independently
     * refuses this outside a non-production environment.
     */
    suspend fun resetTodayForTesting(): Boolean {
        val employeeId = authRepository.employeeId ?: return false
        return try {
            val response = api.devResetToday()
            if (!response.isSuccessful) return false
            dao.deleteForDate(employeeId, attendanceDateFor(Instant.now().toString()))
            true
        } catch (e: Exception) {
            Log.e(TAG, "resetTodayForTesting failed", e)
            false
        }
    }

    /**
     * Self-service "discard & retake" — the server enforces the 1st-of-the-
     * month window (see /api/attendance/discard), this just relays that
     * decision and, on success, clears the local row so [checkIn]'s
     * one-per-day guard doesn't immediately block the fresh attempt this
     * was for.
     */
    suspend fun discardTodayForRetake(): DiscardResult {
        val employeeId = authRepository.employeeId ?: return DiscardResult.Error("Not signed in")
        return try {
            val response = api.discardToday()
            if (!response.isSuccessful) {
                return DiscardResult.Error(response.body()?.error ?: "Could not discard today's attendance")
            }
            dao.deleteForDate(employeeId, attendanceDateFor(Instant.now().toString()))
            DiscardResult.Success
        } catch (e: Exception) {
            Log.e(TAG, "discardTodayForRetake failed", e)
            DiscardResult.Error(e.message ?: "Network error while discarding attendance")
        }
    }

    sealed class DiscardResult {
        object Success : DiscardResult()
        data class Error(val message: String) : DiscardResult()
    }

    /** Punches the signed-in user made on behalf of colleagues (newest first) — not stored locally, always fetched. Null on failure. */
    suspend fun fetchMarkedByMe(): List<com.saaserp.attendance.data.remote.RemoteAttendanceItemDto>? = try {
        val token = authRepository.currentAccessToken()
        if (token == null) {
            null
        } else {
            val response = api.getStaffHistory(authorization = "Bearer $token", scope = "marked_by_me")
            if (response.isSuccessful) response.body()?.records ?: emptyList() else null
        }
    } catch (e: kotlinx.coroutines.CancellationException) {
        throw e
    } catch (e: Exception) {
        Log.e(TAG, "fetchMarkedByMe failed", e)
        null
    }

    /** Staff picker for "mark attendance for a colleague" — see /api/attendance/colleagues. */
    suspend fun fetchColleagues(mode: String = "IN"): List<com.saaserp.attendance.data.remote.ColleagueDto> = try {
        val response = api.getColleagues(mode)
        if (response.isSuccessful) response.body()?.colleagues ?: emptyList() else emptyList()
    } catch (e: Exception) {
        Log.e(TAG, "fetchColleagues failed", e)
        emptyList()
    }

    /**
     * What today looks like so far for the signed-in employee — whether
     * they're mid-session (checked in, not out yet) drives whether the
     * home screen offers "Check In" or "Check Out" next. Mirrors the
     * server's own validateNextEventType() logic (src/lib/attendance/
     * validation.ts) as a local fast-fail; the server re-checks
     * independently regardless.
     */
    data class TodayState(val events: List<AttendanceEntity>, val sessionOpen: Boolean)

    /** Events logged on [date] (IST yyyy-MM-dd) for [employeeId], oldest first — used by the check-out reminder worker. */
    suspend fun todayEventsFor(employeeId: String, date: String): List<AttendanceEntity> =
        dao.findEventsForDate(employeeId, date)

    suspend fun getTodayState(): TodayState {
        val employeeId = authRepository.employeeId ?: return TodayState(emptyList(), false)
        val today = attendanceDateFor(Instant.now().toString())
        val events = dao.findEventsForDate(employeeId, today)
        val sessionOpen = events.lastOrNull()?.eventType == "IN"
        return TodayState(events, sessionOpen)
    }

    sealed class CheckInOutcome {
        data class OnlineVerified(val status: String, val reasons: List<String>) : CheckInOutcome()
        data class OnlineRejected(val message: String) : CheckInOutcome()
        object SavedOffline : CheckInOutcome()
        data class Error(val message: String) : CheckInOutcome()
    }

    suspend fun checkIn(
        location: LocationCapture,
        photoLocalPath: String,
        isOnline: Boolean,
        /** "IN" or "OUT" — a day is a sequence of events now, not one row. */
        eventType: String = "IN",
        /** Only meaningful on an "OUT" — the employee's own self-declared half-day exit. */
        leaveType: String? = null,
        /** Blink-challenge outcome, or null if no liveness check ran. */
        livenessVerified: Boolean? = null,
        /** Set only when marking attendance for a colleague instead of yourself. */
        targetEmployeeId: String? = null,
    ): CheckInOutcome {
        val employeeId = authRepository.employeeId ?: return CheckInOutcome.Error("Not signed in")
        val isProxy = targetEmployeeId != null && targetEmployeeId != employeeId
        val offlineAttendanceId = UUID.randomUUID().toString()
        val capturedAt = Instant.now().toString()
        val deviceId = Build.MODEL ?: "unknown-device"
        val rootRisk = com.saaserp.attendance.location.DeviceSignals.hasRootRiskSignals()
        val today = attendanceDateFor(capturedAt)

        // Marking for a colleague needs the server's decision — this
        // device's local Room DB only tracks the signed-in employee's own
        // history, so there's nothing locally to check against for someone
        // else, and nothing useful to queue offline either (the target
        // never sees their own device's pending-sync queue).
        if (isProxy) {
            if (!isOnline) {
                return CheckInOutcome.Error("Marking attendance for a colleague needs an internet connection.")
            }
            return checkInOnline(
                targetEmployeeId!!, offlineAttendanceId, capturedAt, today, location, photoLocalPath, deviceId, rootRisk,
                eventType = eventType, leaveType = leaveType, livenessVerified = livenessVerified,
            )
        }

        // Fail fast if this isn't the event the sequence actually allows
        // next — the server enforces this for real (validateNextEventType),
        // this just avoids burning a challenge / creating a doomed offline
        // row for a submission that's going to be rejected anyway.
        val todayEvents = dao.findEventsForDate(employeeId, today)
        val sessionOpen = todayEvents.lastOrNull()?.eventType == "IN"
        if (eventType == "IN" && sessionOpen) {
            return CheckInOutcome.Error("You're already checked in — check out before checking in again.")
        }
        if (eventType == "OUT" && !sessionOpen) {
            return CheckInOutcome.Error("You haven't checked in yet today.")
        }

        if (!isOnline) {
            val entity = AttendanceEntity(
                offlineAttendanceId = offlineAttendanceId,
                employeeId = employeeId,
                capturedAtIso = capturedAt,
                attendanceDate = today,
                verificationMode = "OFFLINE",
                verificationStatus = "PENDING_VERIFICATION",
                syncStatus = "PENDING_SYNC",
                gpsLat = location.lat,
                gpsLng = location.lng,
                gpsAccuracyM = location.accuracyM,
                mockLocationReported = location.mockLocationReported,
                rootRiskReported = rootRisk,
                developerOptionsReported = false,
                photoLocalPath = photoLocalPath,
                deviceId = deviceId,
                appVersion = BuildConfig.VERSION_NAME,
                createdAtIso = Instant.now().toString(),
                eventType = eventType,
                leaveType = leaveType,
                livenessVerified = livenessVerified,
            )
            dao.insert(entity)
            return CheckInOutcome.SavedOffline
        }

        // ── ONLINE path ──────────────────────────────────────────────
        return try {
            val accessToken = authRepository.currentAccessToken()

            // Run challenge request and photo upload concurrently to minimize check-in latency
            val (challenge, photoUrl) = coroutineScope {
                val challengeDeferred = async { api.requestChallenge().body() }
                val photoDeferred = async {
                    if (accessToken != null) {
                        photoUploader.upload(photoLocalPath, employeeId, accessToken, onTokenExpired = { authRepository.refreshAccessToken() })
                    } else null
                }
                Pair(challengeDeferred.await(), photoDeferred.await())
            }

            if (challenge == null) {
                return fallbackToOffline(
                    employeeId, offlineAttendanceId, capturedAt, location, photoLocalPath, deviceId, rootRisk, eventType, leaveType, livenessVerified
                )
            }
            Log.d(TAG, "photoUrl going into verify request: $photoUrl (accessToken present: ${accessToken != null})")

            val verifyResponse = api.verify(
                VerifyRequest(
                    challengeId = challenge.challengeId,
                    nonce = challenge.nonce,
                    offlineAttendanceId = offlineAttendanceId,
                    capturedAt = capturedAt,
                    gpsLat = location.lat,
                    gpsLng = location.lng,
                    gpsAccuracyM = location.accuracyM,
                    mockLocationReported = location.mockLocationReported,
                    rootRiskReported = rootRisk,
                    developerOptionsReported = false,
                    photoUrl = photoUrl,
                    deviceId = deviceId,
                    appVersion = BuildConfig.VERSION_NAME,
                    eventType = eventType,
                    leaveType = leaveType,
                    livenessVerified = livenessVerified,
                )
            )

            val verifyBody = verifyResponse.body()

            // A 5xx means the server itself failed (overload, timeout, a
            // bug) — that's not the same thing as the server reviewing this
            // check-in and rejecting it. Queue it exactly like a dropped
            // connection instead of telling the employee their submission was
            // invalid: under a burst of simultaneous check-ins (the whole
            // staff at 8:55am), this is the case that matters most — nobody
            // loses their one shot at attendance because the server was
            // momentarily busy.
            if (!verifyResponse.isSuccessful && verifyResponse.code() >= 500) {
                Log.e(TAG, "Server error ${verifyResponse.code()} during verify, queuing for retry instead of rejecting")
                return fallbackToOffline(
                    employeeId, offlineAttendanceId, capturedAt, location, photoLocalPath, deviceId, rootRisk, eventType, leaveType, livenessVerified
                )
            }

            if (!verifyResponse.isSuccessful || verifyBody?.record == null) {
                return CheckInOutcome.OnlineRejected(verifyBody?.error ?: "Server rejected the check-in")
            }

            val entity = AttendanceEntity(
                offlineAttendanceId = offlineAttendanceId,
                employeeId = employeeId,
                capturedAtIso = capturedAt,
                attendanceDate = today,
                verificationMode = "ONLINE",
                verificationStatus = verifyBody.verificationStatus ?: "VERIFIED",
                syncStatus = "SYNCED",
                verifiedAtIso = verifyBody.record.verifiedAt,
                gpsLat = location.lat,
                gpsLng = location.lng,
                gpsAccuracyM = location.accuracyM,
                mockLocationReported = location.mockLocationReported,
                rootRiskReported = rootRisk,
                developerOptionsReported = false,
                photoLocalPath = photoLocalPath,
                photoUrl = photoUrl,
                deviceId = deviceId,
                appVersion = BuildConfig.VERSION_NAME,
                rejectionReason = verifyBody.record.rejectionReason,
                createdAtIso = Instant.now().toString(),
                eventType = eventType,
                leaveType = leaveType,
                livenessVerified = livenessVerified,
            )
            dao.insert(entity)
            CheckInOutcome.OnlineVerified(entity.verificationStatus, verifyBody.reasons)
        } catch (e: Exception) {
            // Network died mid-flow after all — degrade gracefully to the
            // offline path rather than losing the capture entirely. Logged
            // (was previously silent) — a device reporting "online" but
            // still landing here every time usually means it can't reach
            // API_BASE_URL specifically (wrong LAN IP, WiFi AP/client
            // isolation blocking phone-to-dev-machine traffic, etc.), not a
            // real connectivity problem.
            Log.e(TAG, "Online check-in failed, falling back to offline", e)
            fallbackToOffline(employeeId, offlineAttendanceId, capturedAt, location, photoLocalPath, deviceId, rootRisk, eventType, leaveType, livenessVerified)
        }
    }

    /**
     * The online-only path for marking a colleague's attendance. Deliberately
     * separate from [checkIn]'s own online branch (rather than threading a
     * target/markedBy pair through that whole method) — that branch is the
     * self check-in flow already live in production; this stays additive
     * next to it instead of risking it.
     */
    private suspend fun checkInOnline(
        targetEmployeeId: String,
        offlineAttendanceId: String,
        capturedAt: String,
        today: String,
        location: LocationCapture,
        photoLocalPath: String,
        deviceId: String,
        rootRisk: Boolean,
        eventType: String,
        leaveType: String?,
        livenessVerified: Boolean?,
    ): CheckInOutcome {
        return try {
            val accessToken = authRepository.currentAccessToken()
                ?: return CheckInOutcome.Error("You're signed out — please log in again")

            // Run challenge request and photo upload concurrently to minimize check-in latency
            val (challenge, photoUrl) = coroutineScope {
                val challengeDeferred = async { api.requestChallenge().body() }
                val photoDeferred = async {
                    photoUploader.upload(
                        photoLocalPath, targetEmployeeId, accessToken,
                        onTokenExpired = { authRepository.refreshAccessToken() },
                        targetEmployeeId = targetEmployeeId,
                    )
                }
                Pair(challengeDeferred.await(), photoDeferred.await())
            }

            if (challenge == null) {
                return CheckInOutcome.Error("Could not reach the server — try again")
            }

            val verifyResponse = api.verify(
                VerifyRequest(
                    challengeId = challenge.challengeId,
                    nonce = challenge.nonce,
                    offlineAttendanceId = offlineAttendanceId,
                    capturedAt = capturedAt,
                    gpsLat = location.lat,
                    gpsLng = location.lng,
                    gpsAccuracyM = location.accuracyM,
                    mockLocationReported = location.mockLocationReported,
                    rootRiskReported = rootRisk,
                    developerOptionsReported = false,
                    photoUrl = photoUrl,
                    deviceId = deviceId,
                    appVersion = BuildConfig.VERSION_NAME,
                    targetEmployeeId = targetEmployeeId,
                    eventType = eventType,
                    leaveType = leaveType,
                    livenessVerified = livenessVerified,
                )
            )

            val verifyBody = verifyResponse.body()
            if (!verifyResponse.isSuccessful || verifyBody?.record == null) {
                return CheckInOutcome.OnlineRejected(verifyBody?.error ?: "Server rejected the check-in")
            }

            CheckInOutcome.OnlineVerified(verifyBody.verificationStatus ?: "VERIFIED", verifyBody.reasons)
        } catch (e: Exception) {
            Log.e(TAG, "Proxy check-in failed", e)
            CheckInOutcome.Error(e.message ?: "Failed to mark attendance for this colleague")
        }
    }

    private suspend fun fallbackToOffline(
        employeeId: String,
        offlineAttendanceId: String,
        capturedAt: String,
        location: LocationCapture,
        photoLocalPath: String,
        deviceId: String,
        rootRisk: Boolean,
        eventType: String,
        leaveType: String?,
        livenessVerified: Boolean?,
    ): CheckInOutcome.SavedOffline {
        dao.insert(
            AttendanceEntity(
                offlineAttendanceId = offlineAttendanceId,
                employeeId = employeeId,
                capturedAtIso = capturedAt,
                attendanceDate = attendanceDateFor(capturedAt),
                verificationMode = "OFFLINE",
                verificationStatus = "PENDING_VERIFICATION",
                syncStatus = "PENDING_SYNC",
                gpsLat = location.lat,
                gpsLng = location.lng,
                gpsAccuracyM = location.accuracyM,
                mockLocationReported = location.mockLocationReported,
                rootRiskReported = rootRisk,
                developerOptionsReported = false,
                photoLocalPath = photoLocalPath,
                deviceId = deviceId,
                appVersion = BuildConfig.VERSION_NAME,
                createdAtIso = Instant.now().toString(),
                eventType = eventType,
                leaveType = leaveType,
                livenessVerified = livenessVerified,
            )
        )
        return CheckInOutcome.SavedOffline
    }

    private fun attendanceDateFor(capturedAtIso: String): String =
        Instant.parse(capturedAtIso).atZone(IST_ZONE).format(DATE_FORMATTER)

    /**
     * Called by [com.saaserp.attendance.sync.AttendanceSyncWorker]. Every
     * record here is idempotent by offline_attendance_id — a partial
     * failure (some records sync, others don't) is fine; the worker will
     * simply retry the remainder on the next run.
     */
    suspend fun syncPendingRecords(): SyncOutcome {
        val pending = dao.pendingSync()
        if (pending.isEmpty()) return SyncOutcome(attempted = 0, succeeded = 0, failed = 0)

        val accessToken = authRepository.currentAccessToken() ?: return SyncOutcome(pending.size, 0, pending.size)
        val employeeId = authRepository.employeeId

        // Upload any not-yet-uploaded photos first (best effort — a missing
        // photo_url doesn't block sync, the server just records it as null).
        val withPhotos = pending.map { record ->
            if (record.photoUrl == null && record.photoLocalPath != null && employeeId != null) {
                val url = photoUploader.upload(record.photoLocalPath, employeeId, accessToken, onTokenExpired = { authRepository.refreshAccessToken() })
                record.copy(photoUrl = url)
            } else record
        }

        val requestRecords = withPhotos.map {
            SyncRecordRequest(
                offlineAttendanceId = it.offlineAttendanceId,
                capturedAt = it.capturedAtIso,
                gpsLat = it.gpsLat,
                gpsLng = it.gpsLng,
                gpsAccuracyM = it.gpsAccuracyM,
                mockLocationReported = it.mockLocationReported,
                rootRiskReported = it.rootRiskReported,
                developerOptionsReported = it.developerOptionsReported,
                photoUrl = it.photoUrl,
                deviceId = it.deviceId,
                appVersion = it.appVersion,
                eventType = it.eventType,
                leaveType = it.leaveType,
                livenessVerified = it.livenessVerified,
            )
        }

        val response = try {
            api.sync(SyncRequest(requestRecords))
        } catch (e: Exception) {
            Log.e(TAG, "Sync request failed (network/host unreachable)", e)
            return SyncOutcome(pending.size, 0, pending.size)
        }

        val body = response.body()
        if (!response.isSuccessful || body == null) {
            return SyncOutcome(pending.size, 0, pending.size)
        }

        var succeeded = 0
        var failed = 0
        for (result in body.results) {
            val local = withPhotos.find { it.offlineAttendanceId == result.offlineAttendanceId } ?: continue
            if (result.record != null) {
                dao.update(
                    local.copy(
                        verificationStatus = result.record.verificationStatus ?: local.verificationStatus,
                        syncStatus = "SYNCED",
                        verifiedAtIso = result.record.verifiedAt,
                        rejectionReason = result.record.rejectionReason,
                        lastSyncError = null,
                    )
                )
                succeeded++
            } else {
                dao.update(local.copy(syncAttempts = local.syncAttempts + 1, lastSyncError = result.error))
                failed++
            }
        }
        return SyncOutcome(pending.size, succeeded, failed)
    }

    data class SyncOutcome(val attempted: Int, val succeeded: Int, val failed: Int)

    companion object {
        private const val TAG = "AttendanceRepository"
        private val IST_ZONE = ZoneId.of("Asia/Kolkata")
        private val DATE_FORMATTER = DateTimeFormatter.ISO_LOCAL_DATE
    }
}
