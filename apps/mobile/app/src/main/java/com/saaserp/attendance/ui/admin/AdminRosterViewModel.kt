package com.saaserp.attendance.ui.admin

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.saaserp.attendance.data.remote.AdminAttendanceRowDto
import com.saaserp.attendance.data.remote.AdminAttendanceSummaryDto
import com.saaserp.attendance.data.repository.AdminAttendanceResult
import com.saaserp.attendance.di.ServiceLocator
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.io.File
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

private val IST_DATE_FORMAT: DateTimeFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd").withZone(ZoneId.of("Asia/Kolkata"))

fun todayIstDate(): String = IST_DATE_FORMAT.format(Instant.now())

data class AdminRosterUiState(
    val date: String = todayIstDate(),
    val isLoading: Boolean = true,
    val canViewRoster: Boolean = false,
    val rows: List<AdminAttendanceRowDto> = emptyList(),
    val summary: AdminAttendanceSummaryDto? = null,
    val error: String? = null,
    val isExporting: Boolean = false,
    val exportError: String? = null,
    val exportedFile: File? = null,
)

class AdminRosterViewModel(application: Application) : AndroidViewModel(application) {
    private val repository = ServiceLocator.adminAttendanceRepository(application)

    private val _uiState = MutableStateFlow(AdminRosterUiState())
    val uiState: StateFlow<AdminRosterUiState> = _uiState.asStateFlow()

    init {
        loadDate(todayIstDate())
    }

    fun loadDate(date: String) {
        // Stale-while-revalidate: show the last copy immediately (it's
        // already fetched at app launch for the roster-tab visibility
        // check), then refresh quietly instead of a full-screen spinner.
        val cached = repository.cachedRoster(date)
        _uiState.value = if (cached != null) {
            _uiState.value.copy(
                date = date, isLoading = false, error = null,
                canViewRoster = cached.canViewRoster, rows = cached.rows, summary = cached.summary,
            )
        } else {
            _uiState.value.copy(date = date, isLoading = true, error = null)
        }
        viewModelScope.launch {
            when (val result = repository.getRoster(date)) {
                is AdminAttendanceResult.Success -> {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        canViewRoster = result.data.canViewRoster,
                        rows = result.data.rows,
                        summary = result.data.summary,
                    )
                }
                is AdminAttendanceResult.Error -> {
                    // Keep showing the cached copy if we had one; only surface the error on an empty screen.
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = if (cached != null) null else result.message,
                    )
                }
            }
        }
    }

    fun exportRange(from: String, to: String, format: String, employeeId: String?) {
        _uiState.value = _uiState.value.copy(isExporting = true, exportError = null, exportedFile = null)
        viewModelScope.launch {
            when (val result = repository.exportFile(getApplication(), from, to, format, employeeId)) {
                is AdminAttendanceResult.Success -> {
                    _uiState.value = _uiState.value.copy(isExporting = false, exportedFile = result.data)
                }
                is AdminAttendanceResult.Error -> {
                    _uiState.value = _uiState.value.copy(isExporting = false, exportError = result.message)
                }
            }
        }
    }

    fun dismissExportError() {
        _uiState.value = _uiState.value.copy(exportError = null)
    }

    fun consumeExportedFile() {
        _uiState.value = _uiState.value.copy(exportedFile = null)
    }
}
