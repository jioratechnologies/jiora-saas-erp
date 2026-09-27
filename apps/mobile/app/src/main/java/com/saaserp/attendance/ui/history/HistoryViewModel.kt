package com.saaserp.attendance.ui.history

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.saaserp.attendance.data.local.AttendanceEntity
import com.saaserp.attendance.di.ServiceLocator
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.format.DateTimeFormatter

enum class QuickDateFilter(val label: String) {
    ALL("All Time"),
    THIS_MONTH("This Month"),
    LAST_30_DAYS("Last 30 Days"),
    LAST_7_DAYS("Last 7 Days"),
    TODAY("Today"),
    CUSTOM("Custom Range"),
}

data class HistoryFilterState(
    val fromDate: String? = null,
    val toDate: String? = null,
    val status: String = "ALL",
    val quickFilter: QuickDateFilter = QuickDateFilter.ALL,
    val isRefreshing: Boolean = false,
)

data class AttendanceSummary(
    val total: Int = 0,
    val verified: Int = 0,
    val pending: Int = 0,
    val flaggedOrRejected: Int = 0,
)

@OptIn(ExperimentalCoroutinesApi::class)
class HistoryViewModel(application: Application) : AndroidViewModel(application) {
    private val repository = ServiceLocator.attendanceRepository(application)
    private val authRepository = ServiceLocator.authRepository(application)

    private val employeeId = MutableStateFlow(authRepository.employeeId)
    private val _filterState = MutableStateFlow(HistoryFilterState())
    val filterState: StateFlow<HistoryFilterState> = _filterState.asStateFlow()

    init {
        refreshHistory()
    }

    val records: StateFlow<List<AttendanceEntity>> = combine(
        employeeId,
        _filterState,
    ) { id, filter ->
        Pair(id, filter)
    }.flatMapLatest { (id, filter) ->
        if (id != null) {
            repository.observeHistory(
                employeeId = id,
                fromDate = filter.fromDate,
                toDate = filter.toDate,
                status = filter.status,
            )
        } else {
            flowOf(emptyList())
        }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val summary: StateFlow<AttendanceSummary> = records.combine(_filterState) { list, _ ->
        val verified = list.count { it.verificationStatus == "VERIFIED" }
        val pending = list.count { it.verificationStatus == "PENDING_VERIFICATION" || it.syncStatus == "PENDING_SYNC" }
        val flaggedOrRejected = list.count { it.verificationStatus in setOf("FLAGGED", "REJECTED") }
        AttendanceSummary(
            total = list.size,
            verified = verified,
            pending = pending,
            flaggedOrRejected = flaggedOrRejected,
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), AttendanceSummary())

    fun setQuickFilter(filter: QuickDateFilter) {
        val today = LocalDate.now()
        val formatter = DateTimeFormatter.ISO_LOCAL_DATE
        when (filter) {
            QuickDateFilter.ALL -> {
                _filterState.update { it.copy(quickFilter = filter, fromDate = null, toDate = null) }
            }
            QuickDateFilter.THIS_MONTH -> {
                val startOfMonth = today.withDayOfMonth(1)
                _filterState.update {
                    it.copy(
                        quickFilter = filter,
                        fromDate = startOfMonth.format(formatter),
                        toDate = today.format(formatter),
                    )
                }
            }
            QuickDateFilter.LAST_30_DAYS -> {
                val thirtyDaysAgo = today.minusDays(30)
                _filterState.update {
                    it.copy(
                        quickFilter = filter,
                        fromDate = thirtyDaysAgo.format(formatter),
                        toDate = today.format(formatter),
                    )
                }
            }
            QuickDateFilter.LAST_7_DAYS -> {
                val sevenDaysAgo = today.minusDays(7)
                _filterState.update {
                    it.copy(
                        quickFilter = filter,
                        fromDate = sevenDaysAgo.format(formatter),
                        toDate = today.format(formatter),
                    )
                }
            }
            QuickDateFilter.TODAY -> {
                val todayStr = today.format(formatter)
                _filterState.update {
                    it.copy(
                        quickFilter = filter,
                        fromDate = todayStr,
                        toDate = todayStr,
                    )
                }
            }
            QuickDateFilter.CUSTOM -> {
                _filterState.update { it.copy(quickFilter = filter) }
            }
        }
        refreshHistory()
    }

    fun setFromDate(date: String?) {
        _filterState.update { it.copy(fromDate = date, quickFilter = QuickDateFilter.CUSTOM) }
        refreshHistory()
    }

    fun setToDate(date: String?) {
        _filterState.update { it.copy(toDate = date, quickFilter = QuickDateFilter.CUSTOM) }
        refreshHistory()
    }

    fun setStatusFilter(status: String) {
        _filterState.update { it.copy(status = status) }
        refreshHistory()
    }

    fun clearFilters() {
        _filterState.update {
            it.copy(
                fromDate = null,
                toDate = null,
                status = "ALL",
                quickFilter = QuickDateFilter.ALL,
            )
        }
        refreshHistory()
    }

    fun refreshHistory() {
        viewModelScope.launch {
            _filterState.update { it.copy(isRefreshing = true) }
            val state = _filterState.value
            repository.refreshRemoteHistory(
                fromDate = state.fromDate,
                toDate = state.toDate,
                status = state.status,
            )
            _filterState.update { it.copy(isRefreshing = false) }
        }
    }

    /** Clears a still-PENDING record so today's one-check-in slot opens up again. */
    fun discardPending(record: AttendanceEntity) {
        viewModelScope.launch { repository.discardPending(record) }
    }

    /** TESTING ONLY — see AttendanceRepository.resetTodayForTesting(). */
    fun resetTodayForTesting(onDone: (Boolean) -> Unit) {
        viewModelScope.launch { onDone(repository.resetTodayForTesting()) }
    }
}
