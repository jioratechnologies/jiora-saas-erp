package com.saaserp.attendance.ui.history

import android.app.DatePickerDialog
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.ui.window.Dialog
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.automirrored.filled.ArrowForwardIos
import androidx.compose.material.icons.automirrored.filled.Login
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.foundation.lazy.itemsIndexed
import com.saaserp.attendance.ui.tour.coachTarget
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.DeleteOutline
import androidx.compose.material.icons.filled.EventBusy
import androidx.compose.material.icons.filled.Error
import androidx.compose.material.icons.filled.FilterAlt
import androidx.compose.material.icons.filled.FilterAltOff
import androidx.compose.material.icons.filled.HourglassTop
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Sync
import androidx.compose.material.icons.filled.Warning
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.layout.ContentScale
import com.saaserp.attendance.util.UrlResolver
import java.io.File
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.saaserp.attendance.BuildConfig
import com.saaserp.attendance.data.local.AttendanceEntity
import com.saaserp.attendance.sync.SyncScheduler
import com.saaserp.attendance.ui.components.GlassSurface
import com.saaserp.attendance.ui.theme.AmberGold
import com.saaserp.attendance.ui.theme.DarkDialogSurface
import com.saaserp.attendance.ui.theme.DarkIconButtonBg
import com.saaserp.attendance.ui.theme.LightCreamCard
import com.saaserp.attendance.ui.theme.Saffron500
import com.saaserp.attendance.ui.theme.Saffron600
import com.saaserp.attendance.ui.theme.StatusFlaggedOrange
import com.saaserp.attendance.ui.theme.StatusPendingAmber
import com.saaserp.attendance.ui.theme.StatusRejectedRed
import com.saaserp.attendance.ui.theme.StatusVerifiedGreen
import com.saaserp.attendance.util.s
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Calendar
import java.util.Locale

/** History has two tabs: the signed-in user's own punches, and punches they made on behalf of colleagues. */
@Composable
fun HistoryScreen(onMarkOutColleague: (com.saaserp.attendance.data.remote.ColleagueDto) -> Unit = {}) {
    var tab by androidx.compose.runtime.saveable.rememberSaveable { mutableStateOf(0) }
    Column(Modifier.fillMaxSize()) {
        androidx.compose.material3.TabRow(
            selectedTabIndex = tab,
            containerColor = androidx.compose.ui.graphics.Color.Transparent,
            contentColor = Saffron600,
        ) {
            androidx.compose.material3.Tab(
                selected = tab == 0,
                onClick = { tab = 0 },
                text = { Text(s("My History", "मेरा इतिहास"), fontWeight = FontWeight.Bold) },
            )
            androidx.compose.material3.Tab(
                modifier = Modifier.coachTarget("history_marked_tab"),
                selected = tab == 1,
                onClick = { tab = 1 },
                text = { Text(s("Marked by Me", "मेरे द्वारा दर्ज"), fontWeight = FontWeight.Bold) },
            )
        }
        Box(Modifier.weight(1f).fillMaxWidth()) {
            if (tab == 0) MyHistoryContent() else MarkedByMeScreen(onMarkOut = onMarkOutColleague)
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun MyHistoryContent(viewModel: HistoryViewModel = viewModel()) {
    val records by viewModel.records.collectAsState()
    val filterState by viewModel.filterState.collectAsState()
    val summary by viewModel.summary.collectAsState()
    val context = LocalContext.current
    val isDark = isSystemInDarkTheme()

    val hasPending = records.any { it.syncStatus == "PENDING_SYNC" }
    var discardTarget by remember { mutableStateOf<AttendanceEntity?>(null) }
    var selectedDayForDetails by remember { mutableStateOf<Pair<String, List<AttendanceEntity>>?>(null) }
    var resetMessage by remember { mutableStateOf<String?>(null) }

    var showFromPicker by remember { mutableStateOf(false) }
    var showToPicker by remember { mutableStateOf(false) }
    if (showFromPicker) {
        com.saaserp.attendance.ui.components.AppDatePickerDialog(
            title = s("From date", "प्रारंभ तिथि"),
            initial = runCatching { java.time.LocalDate.parse(filterState.fromDate) }.getOrNull(),
            maxDate = java.time.LocalDate.now(),
            onConfirm = { viewModel.setFromDate(it.toString()); showFromPicker = false },
            onDismiss = { showFromPicker = false },
        )
    }
    if (showToPicker) {
        com.saaserp.attendance.ui.components.AppDatePickerDialog(
            title = s("To date", "अंतिम तिथि"),
            initial = runCatching { java.time.LocalDate.parse(filterState.toDate) }.getOrNull(),
            minDate = runCatching { java.time.LocalDate.parse(filterState.fromDate) }.getOrNull(),
            maxDate = java.time.LocalDate.now(),
            onConfirm = { viewModel.setToDate(it.toString()); showToPicker = false },
            onDismiss = { showToPicker = false },
        )
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp, vertical = 8.dp)
    ) {
        // Header Bar
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column {
                Text(
                    s("Attendance History", "उपस्थिति इतिहास"),
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onBackground,
                )
                Text(
                    s("Day-wise records & verification status", "दिन-वार रिकॉर्ड और सत्यापन स्थिति"),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(
                    onClick = { viewModel.refreshHistory() },
                    modifier = Modifier
                        .size(38.dp)
                        .clip(CircleShape)
                        .background(if (isDark) DarkIconButtonBg else LightCreamCard)
                        .border(1.dp, Saffron500.copy(alpha = 0.3f), CircleShape),
                ) {
                    if (filterState.isRefreshing) {
                        CircularProgressIndicator(color = Saffron600, modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                    } else {
                        Icon(Icons.Filled.Refresh, contentDescription = "Refresh", tint = Saffron600)
                    }
                }

                if (hasPending) {
                    Spacer(Modifier.width(8.dp))
                    Button(
                        onClick = { SyncScheduler.triggerImmediateSync(context) },
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Saffron600),
                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
                    ) {
                        Icon(Icons.Filled.Sync, contentDescription = null, modifier = Modifier.size(14.dp))
                        Spacer(Modifier.width(4.dp))
                        Text(s("Sync", "सिंक करें"), style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }

        // Summary KPI Metrics
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            SummaryKpiCard(
                label = s("Total Days", "कुल दिन"),
                count = summary.total,
                color = Saffron600,
                modifier = Modifier.weight(1f),
            )
            SummaryKpiCard(
                label = s("Verified", "सत्यापित"),
                count = summary.verified,
                color = StatusVerifiedGreen,
                modifier = Modifier.weight(1f),
            )
            SummaryKpiCard(
                label = s("Pending", "लंबित"),
                count = summary.pending,
                color = StatusPendingAmber,
                modifier = Modifier.weight(1f),
            )
            if (summary.flaggedOrRejected > 0) {
                SummaryKpiCard(
                    label = s("Flagged", "चिह्नित"),
                    count = summary.flaggedOrRejected,
                    color = StatusRejectedRed,
                    modifier = Modifier.weight(1f),
                )
            }
        }

        // Date Range & Quick Filter Section.
        // Single padding layer (contentPadding = 0 here, inner Column owns the
        // 12.dp inset): the previous double padding (20.dp glass + 12.dp inner)
        // left a wide glass band whose tint never matches the backdrop, i.e. a
        // visible seam around the whole filter block.
        // Compact Date Range & Quick Filter Section
        GlassSurface(
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 6.dp),
            shape = RoundedCornerShape(14.dp),
            contentPadding = 0.dp,
        ) {
            Column(modifier = Modifier.padding(horizontal = 10.dp, vertical = 8.dp)) {
                // Quick Date Filter Chips — single horizontally scrollable strip
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    QuickDateFilter.values().forEach { filterOption ->
                        val isSelected = filterState.quickFilter == filterOption
                        FilterChip(
                            selected = isSelected,
                            onClick = { viewModel.setQuickFilter(filterOption) },
                            label = {
                                Text(
                                    quickDateFilterLabel(filterOption),
                                    fontSize = 11.sp,
                                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                                )
                            },
                            modifier = Modifier.height(28.dp),
                            colors = FilterChipDefaults.filterChipColors(
                                containerColor = Color.Transparent,
                                labelColor = MaterialTheme.colorScheme.onSurfaceVariant,
                                selectedContainerColor = Saffron600,
                                selectedLabelColor = Color.White,
                            ),
                            border = FilterChipDefaults.filterChipBorder(
                                enabled = true,
                                selected = isSelected,
                                borderColor = Saffron500.copy(alpha = 0.35f),
                                selectedBorderColor = Saffron600,
                            ),
                            shape = RoundedCornerShape(14.dp),
                        )
                    }
                }

                Spacer(Modifier.height(6.dp))

                // Compact Date Range Selector Strip ("From" -> "To" + Clear)
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    // From Date Pill
                    Surface(
                        shape = RoundedCornerShape(8.dp),
                        border = BorderStroke(1.dp, Saffron500.copy(alpha = 0.35f)),
                        color = Color.Transparent,
                        modifier = Modifier
                            .weight(1f)
                            .height(28.dp)
                            .clickable { showFromPicker = true },
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.padding(horizontal = 8.dp),
                        ) {
                            Icon(
                                Icons.Filled.CalendarMonth,
                                contentDescription = null,
                                tint = Saffron600,
                                modifier = Modifier.size(13.dp),
                            )
                            Spacer(Modifier.width(4.dp))
                            Text(
                                text = filterState.fromDate?.let { "${s("From", "से")}: $it" } ?: s("From: Any", "से: कोई भी"),
                                style = MaterialTheme.typography.labelSmall.copy(fontSize = 10.5.sp, fontWeight = FontWeight.Medium),
                                color = if (filterState.fromDate != null) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurfaceVariant,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                                modifier = Modifier.weight(1f),
                            )
                            if (filterState.fromDate != null) {
                                Icon(
                                    Icons.Filled.Close,
                                    contentDescription = "Clear",
                                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                    modifier = Modifier
                                        .size(13.dp)
                                        .clickable { viewModel.setFromDate(null) },
                                )
                            }
                        }
                    }

                    // Divider Arrow
                    Icon(
                        Icons.AutoMirrored.Filled.ArrowForward,
                        contentDescription = null,
                        tint = Saffron600.copy(alpha = 0.6f),
                        modifier = Modifier.size(12.dp),
                    )

                    // To Date Pill
                    Surface(
                        shape = RoundedCornerShape(8.dp),
                        border = BorderStroke(1.dp, Saffron500.copy(alpha = 0.35f)),
                        color = Color.Transparent,
                        modifier = Modifier
                            .weight(1f)
                            .height(28.dp)
                            .clickable { showToPicker = true },
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.padding(horizontal = 8.dp),
                        ) {
                            Icon(
                                Icons.Filled.CalendarMonth,
                                contentDescription = null,
                                tint = Saffron600,
                                modifier = Modifier.size(13.dp),
                            )
                            Spacer(Modifier.width(4.dp))
                            Text(
                                text = filterState.toDate?.let { "${s("To", "तक")}: $it" } ?: s("To: Today", "तक: आज"),
                                style = MaterialTheme.typography.labelSmall.copy(fontSize = 10.5.sp, fontWeight = FontWeight.Medium),
                                color = if (filterState.toDate != null) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurfaceVariant,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                                modifier = Modifier.weight(1f),
                            )
                            if (filterState.toDate != null) {
                                Icon(
                                    Icons.Filled.Close,
                                    contentDescription = "Clear",
                                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                    modifier = Modifier
                                        .size(13.dp)
                                        .clickable { viewModel.setToDate(null) },
                                )
                            }
                        }
                    }

                    // Clear Filter Button if custom dates or status is active
                    if (filterState.fromDate != null || filterState.toDate != null || filterState.status != "ALL") {
                        IconButton(
                            onClick = { viewModel.clearFilters() },
                            modifier = Modifier.size(26.dp),
                        ) {
                            Icon(
                                Icons.Filled.FilterAltOff,
                                contentDescription = s("Clear Filters", "फ़िल्टर हटाएं"),
                                tint = MaterialTheme.colorScheme.error,
                                modifier = Modifier.size(15.dp),
                            )
                        }
                    }
                }
            }
        }

        // Dev/testing helper only
        if (BuildConfig.ATTENDANCE_MODE == "dev") {
            OutlinedButton(
                onClick = {
                    viewModel.resetTodayForTesting { success ->
                        resetMessage = if (success) "Today's attendance reset — you can check in again."
                        else "Reset failed — check network/logs."
                    }
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 8.dp),
                shape = RoundedCornerShape(12.dp),
            ) {
                Text("Reset Today's Attendance (Dev Mode)", fontSize = 11.sp)
            }
            resetMessage?.let {
                Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(bottom = 8.dp))
            }
        }

        // Attendance List
        if (records.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f),
                contentAlignment = Alignment.Center,
            ) {
                GlassSurface(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(20.dp),
                    contentPadding = 0.dp,
                ) {
                    Column(
                        modifier = Modifier.padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Icon(Icons.Filled.FilterAlt, contentDescription = null, tint = Saffron600, modifier = Modifier.size(36.dp))
                        Spacer(Modifier.height(10.dp))
                        Text(
                            s("No attendance records found", "कोई उपस्थिति रिकॉर्ड नहीं मिला"),
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onBackground,
                        )
                        Spacer(Modifier.height(6.dp))
                        Text(
                            s("No check-ins recorded for the selected date filter range.", "चयनित तिथि सीमा के लिए कोई चेक-इन दर्ज नहीं है।"),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            fontSize = 12.sp,
                        )
                        if (filterState.fromDate != null || filterState.toDate != null) {
                            Spacer(Modifier.height(12.dp))
                            Button(
                                onClick = { viewModel.clearFilters() },
                                shape = RoundedCornerShape(12.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = Saffron600),
                            ) {
                                Text("View All Attendance", fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }
        } else {
            // Grouped by day — records already arrive sorted by date desc,
            // so a single pass keeps each day's events (now IN and,
            // separately, OUT — migration 020) together in encounter order.
            val dayGroups = remember(records) {
                val groups = LinkedHashMap<String, MutableList<AttendanceEntity>>()
                for (r in records) {
                    groups.getOrPut(r.attendanceDate.ifBlank { "Unknown date" }) { mutableListOf() }.add(r)
                }
                groups.map { (date, events) -> date to events.sortedBy { it.capturedAtIso } }
            }

            LazyColumn(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(8.dp),
                contentPadding = PaddingValues(bottom = 16.dp),
            ) {
                itemsIndexed(dayGroups, key = { _, group -> group.first }) { index, (date, events) ->
                    Box(if (index == 0) Modifier.coachTarget("history_day") else Modifier) {
                    DayGroupCard(
                        date = date,
                        events = events,
                        onClick = { selectedDayForDetails = date to events },
                        onDiscard = { discardTarget = it },
                    )
                    }
                }
            }
        }
    }

    selectedDayForDetails?.let { (date, events) ->
        DayAttendanceDetailSheet(
            date = date,
            events = events,
            onDismiss = { selectedDayForDetails = null },
            onDiscard = {
                selectedDayForDetails = null
                discardTarget = it
            },
        )
    }

    discardTarget?.let { target ->
        AlertDialog(
            onDismissRequest = { discardTarget = null },
            title = { Text("Discard this attendance?") },
            text = { Text("This pending record hasn't been verified yet. Discarding it removes today's block so you can check in again.") },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.discardPending(target)
                    discardTarget = null
                }) { Text("Discard", color = StatusRejectedRed, fontWeight = FontWeight.Bold) }
            },
            dismissButton = {
                TextButton(onClick = { discardTarget = null }) { Text("Cancel") }
            },
            shape = RoundedCornerShape(20.dp),
        )
    }
}

@Composable
private fun SummaryKpiCard(
    label: String,
    count: Int,
    color: Color,
    modifier: Modifier = Modifier,
) {
    val isDark = isSystemInDarkTheme()
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(12.dp))
            .background(if (isDark) DarkDialogSurface else LightCreamCard)
            .border(1.dp, color.copy(alpha = 0.35f), RoundedCornerShape(12.dp))
            .padding(vertical = 6.dp, horizontal = 4.dp),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                count.toString(),
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold,
                color = color,
            )
            Text(
                label,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                fontSize = 9.sp,
                fontWeight = FontWeight.SemiBold,
            )
        }
    }
}

private data class StatusVisual(val label: String, val color: Color, val icon: ImageVector)

@Composable
private fun quickDateFilterLabel(filter: QuickDateFilter): String = when (filter) {
    QuickDateFilter.ALL -> s("All Time", "सभी समय")
    QuickDateFilter.THIS_MONTH -> s("This Month", "इस माह")
    QuickDateFilter.LAST_30_DAYS -> s("Last 30 Days", "पिछले 30 दिन")
    QuickDateFilter.LAST_7_DAYS -> s("Last 7 Days", "पिछले 7 दिन")
    QuickDateFilter.TODAY -> s("Today", "आज")
    QuickDateFilter.CUSTOM -> s("Custom Range", "कस्टम सीमा")
}

private val DISPLAY_FORMATTER = java.time.format.DateTimeFormatter
    .ofPattern("dd MMM yyyy, hh:mm a")
    .withZone(java.time.ZoneId.systemDefault())

private fun formatTimestamp(iso: String): String =
    try {
        DISPLAY_FORMATTER.format(java.time.Instant.parse(iso))
    } catch (e: Exception) {
        iso
    }

private fun statusVisual(record: AttendanceEntity): StatusVisual = when {
    record.verificationMode == "ONLINE" && record.verificationStatus == "VERIFIED" ->
        StatusVisual("Attendance Verified", StatusVerifiedGreen, Icons.Filled.CheckCircle)

    record.verificationMode == "OFFLINE" && record.syncStatus == "PENDING_SYNC" ->
        StatusVisual("Saved Offline — Pending Sync", StatusPendingAmber, Icons.Filled.HourglassTop)

    record.verificationMode == "OFFLINE" && record.syncStatus == "SYNCED" && record.verificationStatus == "VERIFIED" ->
        StatusVisual("Attendance Verified (Synced)", StatusVerifiedGreen, Icons.Filled.CheckCircle)

    record.verificationStatus == "FLAGGED" ->
        StatusVisual("Flagged for Review", StatusFlaggedOrange, Icons.Filled.Warning)

    record.verificationStatus == "REJECTED" ->
        StatusVisual("Rejected", StatusRejectedRed, Icons.Filled.Error)

    else -> StatusVisual("Pending Verification", StatusPendingAmber, Icons.Filled.HourglassTop)
}

private data class DayAttendanceSession(
    val sessionIndex: Int,
    val inEvent: AttendanceEntity?,
    val outEvent: AttendanceEntity?,
)

private fun buildDaySessions(events: List<AttendanceEntity>): List<DayAttendanceSession> {
    val sorted = events.sortedBy { it.capturedAtIso }
    val sessions = mutableListOf<DayAttendanceSession>()
    var currentIn: AttendanceEntity? = null
    var sessionNumber = 1

    for (e in sorted) {
        if (e.eventType == "IN") {
            if (currentIn != null) {
                sessions.add(DayAttendanceSession(sessionNumber++, currentIn, null))
            }
            currentIn = e
        } else {
            sessions.add(DayAttendanceSession(sessionNumber++, currentIn, e))
            currentIn = null
        }
    }
    if (currentIn != null) {
        sessions.add(DayAttendanceSession(sessionNumber++, currentIn, null))
    }
    return if (sessions.isEmpty()) {
        listOf(DayAttendanceSession(1, null, null))
    } else {
        sessions
    }
}

private val SHORT_TIME_FORMATTER = java.time.format.DateTimeFormatter
    .ofPattern("hh:mm a")
    .withZone(java.time.ZoneId.systemDefault())

private fun formatShortTime(iso: String): String =
    try {
        SHORT_TIME_FORMATTER.format(java.time.Instant.parse(iso))
    } catch (e: Exception) {
        iso
    }

private fun formatDisplayDate(dateIso: String): String =
    try {
        val parsed = java.time.LocalDate.parse(dateIso)
        parsed.format(java.time.format.DateTimeFormatter.ofPattern("dd MMM yyyy, EEE"))
    } catch (e: Exception) {
        dateIso
    }

private data class DayOverallStatus(
    val label: String,
    val textColor: Color,
    val bgColor: Color,
    val borderColor: Color,
)

@Composable
private fun getDayOverallStatus(events: List<AttendanceEntity>): DayOverallStatus {
    return when {
        events.any { it.verificationStatus == "FLAGGED" } -> DayOverallStatus(
            label = s("Flagged", "चिह्नित"),
            textColor = StatusFlaggedOrange,
            bgColor = StatusFlaggedOrange.copy(alpha = 0.12f),
            borderColor = StatusFlaggedOrange.copy(alpha = 0.35f),
        )
        events.any { it.verificationStatus == "REJECTED" } -> DayOverallStatus(
            label = s("Rejected", "अस्वीकृत"),
            textColor = StatusRejectedRed,
            bgColor = StatusRejectedRed.copy(alpha = 0.12f),
            borderColor = StatusRejectedRed.copy(alpha = 0.35f),
        )
        events.any { it.verificationStatus == "PENDING_VERIFICATION" || it.syncStatus == "PENDING_SYNC" } -> DayOverallStatus(
            label = s("Pending", "लंबित"),
            textColor = StatusPendingAmber,
            bgColor = StatusPendingAmber.copy(alpha = 0.12f),
            borderColor = StatusPendingAmber.copy(alpha = 0.35f),
        )
        events.all { it.verificationStatus == "VERIFIED" } && events.isNotEmpty() -> DayOverallStatus(
            label = s("Verified", "सत्यापित"),
            textColor = StatusVerifiedGreen,
            bgColor = StatusVerifiedGreen.copy(alpha = 0.12f),
            borderColor = StatusVerifiedGreen.copy(alpha = 0.35f),
        )
        else -> DayOverallStatus(
            label = s("Logged", "दर्ज"),
            textColor = Saffron600,
            bgColor = Saffron600.copy(alpha = 0.12f),
            borderColor = Saffron600.copy(alpha = 0.35f),
        )
    }
}

/**
 * Concise Day Summary Card:
 * Features a clean compact header, shifts timing breakdown, status badge,
 * an inline collapsible toggle arrow, and opens a complete modal bottom
 * sheet detail popup on click (identical to Admin Roster).
 */
@Composable
private fun DayGroupCard(
    date: String,
    events: List<AttendanceEntity>,
    onClick: () -> Unit,
    onDiscard: (AttendanceEntity) -> Unit,
) {
    val isDark = isSystemInDarkTheme()
    val sessions = remember(events) { buildDaySessions(events) }
    val isMultiSession = sessions.size > 1
    val dayStatus = getDayOverallStatus(events)
    var isExpanded by remember { mutableStateOf(false) }

    GlassSurface(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .clickable { onClick() },
        shape = RoundedCornerShape(16.dp),
        contentPadding = 12.dp,
    ) {
        Column {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.weight(1f),
                ) {
                    Box(
                        modifier = Modifier
                            .size(34.dp)
                            .clip(CircleShape)
                            .background(Saffron500.copy(alpha = 0.12f)),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(
                            Icons.Filled.CalendarMonth,
                            contentDescription = null,
                            tint = Saffron600,
                            modifier = Modifier.size(17.dp),
                        )
                    }
                    Spacer(Modifier.width(10.dp))
                    Column {
                        Text(
                            text = formatDisplayDate(date),
                            style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
                            color = MaterialTheme.colorScheme.onBackground,
                        )
                        Text(
                            text = if (isMultiSession) {
                                "${sessions.size} ${s("Shifts", "शिफ्ट")} (${events.size} ${s("Punches", "पंच")})"
                            } else {
                                "1 ${s("Shift", "शिफ्ट")} (${events.size} ${s("Punches", "पंच")})"
                            },
                            style = MaterialTheme.typography.bodySmall.copy(fontSize = 11.sp),
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    Surface(
                        shape = RoundedCornerShape(8.dp),
                        color = dayStatus.bgColor,
                        border = BorderStroke(1.dp, dayStatus.borderColor),
                    ) {
                        Text(
                            text = dayStatus.label,
                            style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold, fontSize = 10.5.sp),
                            color = dayStatus.textColor,
                            modifier = Modifier.padding(horizontal = 7.dp, vertical = 3.dp),
                        )
                    }

                    IconButton(
                        onClick = { isExpanded = !isExpanded },
                        modifier = Modifier.size(28.dp),
                    ) {
                        Icon(
                            if (isExpanded) Icons.Filled.KeyboardArrowUp else Icons.Filled.KeyboardArrowDown,
                            contentDescription = if (isExpanded) "Collapse" else "Expand",
                            tint = Saffron600,
                            modifier = Modifier.size(20.dp),
                        )
                    }
                }
            }

            Spacer(Modifier.height(6.dp))

            // Timing summary strip
            Surface(
                shape = RoundedCornerShape(8.dp),
                color = if (isDark) Color.White.copy(alpha = 0.03f) else Saffron500.copy(alpha = 0.05f),
                border = BorderStroke(0.5.dp, Saffron500.copy(alpha = 0.2f)),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(modifier = Modifier.padding(horizontal = 8.dp, vertical = 5.dp)) {
                    sessions.forEach { session ->
                        val inTime = session.inEvent?.let { formatShortTime(it.capturedAtIso) } ?: "—"
                        val outTime = session.outEvent?.let { formatShortTime(it.capturedAtIso) } ?: "—"
                        val shiftPrefix = if (isMultiSession) "S${session.sessionIndex}: " else ""
                        Text(
                            text = "$shiftPrefix${s("In", "इन")} $inTime → ${s("Out", "आउट")} $outTime",
                            style = MaterialTheme.typography.labelSmall.copy(fontSize = 11.sp, fontWeight = FontWeight.Medium),
                            color = MaterialTheme.colorScheme.onSurface,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                }
            }

            // Inline collapsible punch cards
            AnimatedVisibility(
                visible = isExpanded,
                enter = expandVertically() + fadeIn(),
                exit = shrinkVertically() + fadeOut(),
            ) {
                Column(modifier = Modifier.padding(top = 10.dp)) {
                    sessions.forEachIndexed { idx, session ->
                        if (isMultiSession) {
                            if (idx > 0) Spacer(Modifier.height(8.dp))
                            Text(
                                text = s("Shift ${session.sessionIndex}", "शिफ्ट ${session.sessionIndex}"),
                                style = MaterialTheme.typography.labelSmall,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.padding(bottom = 4.dp),
                            )
                        }

                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            EventSubCard(
                                modifier = Modifier.weight(1f),
                                label = s("Check In", "चेक इन"),
                                icon = Icons.AutoMirrored.Filled.Login,
                                accentColor = StatusVerifiedGreen,
                                event = session.inEvent,
                                placeholder = s("No check-in", "कोई चेक-इन नहीं"),
                                onDiscard = onDiscard,
                            )
                            EventSubCard(
                                modifier = Modifier.weight(1f),
                                label = s("Check Out", "चेक आउट"),
                                icon = Icons.AutoMirrored.Filled.Logout,
                                accentColor = StatusFlaggedOrange,
                                event = session.outEvent,
                                placeholder = if (session.inEvent != null) s("Not checked out yet", "अभी चेक आउट नहीं हुआ") else "—",
                                onDiscard = onDiscard,
                            )
                        }
                    }

                    Spacer(Modifier.height(8.dp))

                    OutlinedButton(
                        onClick = onClick,
                        shape = RoundedCornerShape(10.dp),
                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp),
                        modifier = Modifier.fillMaxWidth().height(32.dp),
                    ) {
                        Text(
                            s("View Full Punch Logs & Details", "पूर्ण पंच विवरण देखें"),
                            style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold, fontSize = 11.sp),
                        )
                        Spacer(Modifier.width(4.dp))
                        Icon(
                            Icons.AutoMirrored.Filled.ArrowForwardIos,
                            contentDescription = null,
                            modifier = Modifier.size(11.dp),
                        )
                    }
                }
            }
        }
    }
}

/**
 * Bottom Sheet Detail Popup (matching the Admin Roster inspection sheet)
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DayAttendanceDetailSheet(
    date: String,
    events: List<AttendanceEntity>,
    onDismiss: () -> Unit,
    onDiscard: (AttendanceEntity) -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val isDark = isSystemInDarkTheme()
    val sessions = remember(events) { buildDaySessions(events) }
    val dayStatus = getDayOverallStatus(events)

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        shape = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp),
        containerColor = if (isDark) DarkDialogSurface else LightCreamCard,
        dragHandle = {
            Box(
                modifier = Modifier
                    .padding(vertical = 10.dp)
                    .width(36.dp)
                    .height(4.dp)
                    .clip(CircleShape)
                    .background(MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.4f))
            )
        },
    ) {
        LazyColumn(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp),
            contentPadding = PaddingValues(bottom = 32.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            // Header: Date & Close
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column {
                        Text(
                            text = formatDisplayDate(date),
                            style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                            color = MaterialTheme.colorScheme.onSurface,
                        )
                        Text(
                            text = s("Day Attendance & Punch Breakdown", "दैनिक उपस्थिति और पंच विवरण"),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    IconButton(
                        onClick = onDismiss,
                        modifier = Modifier
                            .size(32.dp)
                            .clip(CircleShape)
                            .background(MaterialTheme.colorScheme.onSurface.copy(alpha = 0.08f)),
                    ) {
                        Icon(Icons.Filled.Close, contentDescription = "Close", modifier = Modifier.size(18.dp))
                    }
                }
            }

            // Summary Banner
            item {
                Surface(
                    shape = RoundedCornerShape(14.dp),
                    color = dayStatus.bgColor,
                    border = BorderStroke(1.dp, dayStatus.borderColor),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 14.dp, vertical = 10.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Column {
                            Text(
                                s("Overall Status", "समग्र स्थिति"),
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                            Text(
                                dayStatus.label,
                                style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
                                color = dayStatus.textColor,
                            )
                        }
                        Column(horizontalAlignment = Alignment.End) {
                            Text(
                                "${events.size} ${s("Total Punches", "कुल पंच")}",
                                style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold),
                                color = MaterialTheme.colorScheme.onSurface,
                            )
                            Text(
                                "${sessions.size} ${s("Shifts Recorded", "शिफ्ट रिकॉर्ड")}",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                }
            }

            // Detailed Punch Logs Title
            item {
                Text(
                    text = s("Punch Activity Logs", "पंच गतिविधि रिकॉर्ड"),
                    style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
                    color = MaterialTheme.colorScheme.onSurface,
                )
            }

            // Individual Punch Detail Cards (sorted chronologically)
            items(events.sortedBy { it.capturedAtIso }, key = { it.offlineAttendanceId }) { event ->
                val sessionIndex = sessions.find { it.inEvent?.offlineAttendanceId == event.offlineAttendanceId || it.outEvent?.offlineAttendanceId == event.offlineAttendanceId }?.sessionIndex
                HistoryPunchDetailCard(
                    event = event,
                    shiftNumber = sessionIndex,
                    onDiscard = onDiscard,
                )
            }
        }
    }
}

@Composable
private fun HistoryPunchDetailCard(
    event: AttendanceEntity,
    shiftNumber: Int?,
    onDiscard: (AttendanceEntity) -> Unit,
) {
    val isDark = isSystemInDarkTheme()
    val isCheckIn = event.eventType == "IN"
    val isVerified = event.verificationStatus == "VERIFIED"
    val isFlagged = event.verificationStatus == "FLAGGED"
    val isRejected = event.verificationStatus == "REJECTED"

    val statusBg = when {
        isVerified -> StatusVerifiedGreen.copy(alpha = 0.12f)
        isFlagged -> StatusFlaggedOrange.copy(alpha = 0.12f)
        isRejected -> StatusRejectedRed.copy(alpha = 0.12f)
        else -> StatusPendingAmber.copy(alpha = 0.12f)
    }
    val statusColor = when {
        isVerified -> StatusVerifiedGreen
        isFlagged -> StatusFlaggedOrange
        isRejected -> StatusRejectedRed
        else -> StatusPendingAmber
    }
    val statusLabel = when (event.verificationStatus) {
        "VERIFIED" -> s("Verified", "सत्यापित")
        "FLAGGED" -> s("Flagged for Review", "समीक्षा हेतु चिह्नित")
        "REJECTED" -> s("Rejected", "अस्वीकृत")
        else -> s("Pending Sync", "लंबित सिंक")
    }

    Surface(
        shape = RoundedCornerShape(14.dp),
        color = if (isDark) Color(0xFF1E293B) else Color.White,
        border = BorderStroke(1.dp, if (isDark) Color(0xFF334155) else Color(0xFFE2E8F0)),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            // Top Row: Shift # + Type pill + Status
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    if (shiftNumber != null) {
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(6.dp))
                                .background(MaterialTheme.colorScheme.onSurface.copy(alpha = 0.08f))
                                .padding(horizontal = 6.dp, vertical = 2.dp),
                        ) {
                            Text(
                                "Shift $shiftNumber",
                                style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold, fontSize = 10.sp),
                                color = MaterialTheme.colorScheme.onSurface,
                            )
                        }
                    }

                    val typeColor = if (isCheckIn) Color(0xFF059669) else Color(0xFFD97706)
                    val typeBg = if (isCheckIn) Color(0xFF10B981).copy(alpha = 0.12f) else Color(0xFFF59E0B).copy(alpha = 0.12f)
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(6.dp))
                            .background(typeBg)
                            .padding(horizontal = 6.dp, vertical = 2.dp),
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(3.dp),
                        ) {
                            Icon(
                                if (isCheckIn) Icons.AutoMirrored.Filled.Login else Icons.AutoMirrored.Filled.Logout,
                                contentDescription = null,
                                tint = typeColor,
                                modifier = Modifier.size(12.dp),
                            )
                            Text(
                                if (isCheckIn) s("Check-In", "चेक-इन") else s("Check-Out", "चेक-आउट"),
                                style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold, fontSize = 10.sp),
                                color = typeColor,
                            )
                        }
                    }
                }

                // Status Badge
                Surface(
                    shape = RoundedCornerShape(6.dp),
                    color = statusBg,
                    border = BorderStroke(1.dp, statusColor.copy(alpha = 0.35f)),
                ) {
                    Text(
                        statusLabel,
                        style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold, fontSize = 10.sp),
                        color = statusColor,
                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                    )
                }
            }

            Spacer(Modifier.height(8.dp))

            // Timestamp Row
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    Icons.Filled.CalendarMonth,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(14.dp),
                )
                Spacer(Modifier.width(6.dp))
                Text(
                    formatTimestamp(event.capturedAtIso),
                    style = MaterialTheme.typography.bodySmall.copy(fontWeight = FontWeight.SemiBold),
                    color = MaterialTheme.colorScheme.onSurface,
                )
            }

            Spacer(Modifier.height(6.dp))

            // Mode + Sync status & Leave Type pills
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                val isOnline = event.verificationMode == "ONLINE"
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(4.dp))
                        .background(if (isOnline) Color(0xFF10B981).copy(alpha = 0.1f) else Color(0xFF6B7280).copy(alpha = 0.1f))
                        .padding(horizontal = 5.dp, vertical = 2.dp),
                ) {
                    Text(
                        "${event.verificationMode} · ${event.syncStatus}",
                        style = MaterialTheme.typography.labelSmall.copy(fontSize = 9.5.sp, fontWeight = FontWeight.Medium),
                        color = if (isOnline) Color(0xFF059669) else Color(0xFF4B5563),
                    )
                }

                if (event.leaveType == "HALF_DAY") {
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(4.dp))
                            .background(Color(0xFF8B5CF6).copy(alpha = 0.12f))
                            .padding(horizontal = 5.dp, vertical = 2.dp),
                    ) {
                        Text(
                            s("Half-Day Declared", "हाफ डे घोषित"),
                            style = MaterialTheme.typography.labelSmall.copy(fontSize = 9.5.sp, fontWeight = FontWeight.Bold),
                            color = Color(0xFF7C3AED),
                        )
                    }
                }
            }

            // GPS of the punch — opens the map dialog. (0,0 is what a record with no fix is stored as.)
            if (event.gpsLat != 0.0 || event.gpsLng != 0.0) {
                var showMap by remember { mutableStateOf(false) }
                if (showMap) {
                    com.saaserp.attendance.ui.admin.LocationMapDialog(
                        lat = event.gpsLat,
                        lng = event.gpsLng,
                        accuracyM = event.gpsAccuracyM,
                        distanceFromCampusM = null,
                        onDismiss = { showMap = false },
                    )
                }
                Spacer(Modifier.height(8.dp))
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(8.dp))
                        .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f))
                        .clickable { showMap = true }
                        .padding(8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(Icons.Filled.LocationOn, contentDescription = null, tint = Saffron600, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(6.dp))
                    Column(Modifier.weight(1f)) {
                        Text(
                            "GPS: ${String.format(java.util.Locale.US, "%.5f, %.5f", event.gpsLat, event.gpsLng)}" +
                                (event.gpsAccuracyM?.let { " (±${it.toInt()}m)" } ?: ""),
                            style = MaterialTheme.typography.labelSmall.copy(textDecoration = androidx.compose.ui.text.style.TextDecoration.Underline),
                            color = Saffron600,
                        )
                        Text(
                            s("Tap to view on map", "मानचित्र पर देखने के लिए दबाएँ"),
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }

            // Photo preview if available (local disk file or resolved remote URL)
            val localFile = remember(event.photoLocalPath) {
                event.photoLocalPath?.let { File(it) }?.takeIf { it.exists() }
            }
            val resolvedRemote = remember(event.photoUrl) {
                UrlResolver.resolve(event.photoUrl)
            }
            val imageModel: Any? = remember(localFile, resolvedRemote) {
                when {
                    localFile != null -> localFile
                    !resolvedRemote.isNullOrBlank() -> UrlResolver.toCoilModel(resolvedRemote)
                    else -> null
                }
            }

            if (imageModel != null) {
                Spacer(Modifier.height(8.dp))
                var showFullImage by remember { mutableStateOf(false) }

                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(130.dp)
                        .clip(RoundedCornerShape(10.dp))
                        .background(Color.Black.copy(alpha = 0.05f))
                        .clickable { showFullImage = true },
                    contentAlignment = Alignment.Center,
                ) {
                    coil.compose.SubcomposeAsyncImage(
                        model = imageModel,
                        contentDescription = "Punch Photo",
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize(),
                        loading = {
                            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp, color = Saffron600)
                            }
                        },
                        error = {
                            Box(
                                Modifier
                                    .fillMaxSize()
                                    .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)),
                                contentAlignment = Alignment.Center,
                            ) {
                                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                    Icon(
                                        Icons.Filled.Warning,
                                        contentDescription = null,
                                        tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f),
                                        modifier = Modifier.size(20.dp),
                                    )
                                    Spacer(Modifier.height(4.dp))
                                    Text(
                                        s("Photo unavailable", "फोटो अनुपलब्ध"),
                                        style = MaterialTheme.typography.labelSmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    )
                                }
                            }
                        },
                    )
                }

                if (showFullImage) {
                    Dialog(onDismissRequest = { showFullImage = false }) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(16.dp))
                                .background(Color.Black)
                                .padding(8.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            coil.compose.SubcomposeAsyncImage(
                                model = imageModel,
                                contentDescription = "Enlarged Punch Photo",
                                contentScale = ContentScale.Fit,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .wrapContentHeight(),
                            )
                        }
                    }
                }
            }


            // Rejection reason warning if any
            if (!event.rejectionReason.isNullOrBlank()) {
                Spacer(Modifier.height(6.dp))
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(6.dp))
                        .background(StatusRejectedRed.copy(alpha = 0.08f))
                        .border(1.dp, StatusRejectedRed.copy(alpha = 0.25f), RoundedCornerShape(6.dp))
                        .padding(horizontal = 8.dp, vertical = 4.dp),
                ) {
                    Text(
                        "${s("Reason", "कारण")}: ${event.rejectionReason}",
                        style = MaterialTheme.typography.bodySmall.copy(fontSize = 11.sp),
                        color = StatusRejectedRed,
                    )
                }
            }
        }
    }
}

@Composable
private fun EventSubCard(
    modifier: Modifier = Modifier,
    label: String,
    icon: ImageVector,
    accentColor: Color,
    event: AttendanceEntity?,
    placeholder: String,
    onDiscard: (AttendanceEntity) -> Unit,
) {
    val isDark = isSystemInDarkTheme()

    if (event == null) {
        Column(
            modifier = modifier
                .clip(RoundedCornerShape(14.dp))
                .background((if (isDark) DarkDialogSurface else LightCreamCard).copy(alpha = 0.5f))
                .border(1.dp, MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.15f), RoundedCornerShape(14.dp))
                .padding(10.dp),
        ) {
            Icon(icon, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f), modifier = Modifier.size(18.dp))
            Spacer(Modifier.height(6.dp))
            Text(label, style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(placeholder, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f), fontSize = 10.sp)
        }
        return
    }

    val visual = statusVisual(event)
    val isPending = event.syncStatus == "PENDING_SYNC"
    val isHalfDay = event.leaveType == "HALF_DAY"

    Column(
        modifier = modifier
            .clip(RoundedCornerShape(14.dp))
            .background(accentColor.copy(alpha = 0.08f))
            .border(1.dp, accentColor.copy(alpha = 0.3f), RoundedCornerShape(14.dp))
            .padding(10.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
            Icon(icon, contentDescription = null, tint = accentColor, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(6.dp))
            Text(label, style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold, color = accentColor, modifier = Modifier.weight(1f))
            if (isPending) {
                IconButton(onClick = { onDiscard(event) }, modifier = Modifier.size(20.dp)) {
                    Icon(Icons.Filled.DeleteOutline, contentDescription = "Discard pending attendance", tint = StatusRejectedRed, modifier = Modifier.size(16.dp))
                }
            }
        }

        Spacer(Modifier.height(4.dp))

        Text(
            formatTimestamp(event.capturedAtIso),
            style = MaterialTheme.typography.bodySmall,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onBackground,
        )

        Spacer(Modifier.height(4.dp))

        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(visual.icon, contentDescription = null, tint = visual.color, modifier = Modifier.size(12.dp))
            Spacer(Modifier.width(4.dp))
            Text(
                visual.label,
                style = MaterialTheme.typography.labelSmall,
                color = visual.color,
                fontWeight = FontWeight.Bold,
                fontSize = 10.sp,
            )
        }

        if (isHalfDay) {
            Spacer(Modifier.height(4.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Filled.EventBusy, contentDescription = null, tint = Color(0xFFA855F7), modifier = Modifier.size(12.dp))
                Spacer(Modifier.width(4.dp))
                Text("Half Day", style = MaterialTheme.typography.labelSmall, color = Color(0xFFA855F7), fontWeight = FontWeight.Bold, fontSize = 10.sp)
            }
        }

        Spacer(Modifier.height(4.dp))
        Text(
            "${event.verificationMode} · ${if (event.syncStatus == "SYNCED") "Synced" else "Local Draft"}",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            fontSize = 9.sp,
        )

        event.rejectionReason?.let {
            Spacer(Modifier.height(4.dp))
            Text(
                it,
                style = MaterialTheme.typography.labelSmall,
                color = StatusRejectedRed,
                fontWeight = FontWeight.SemiBold,
                fontSize = 9.sp,
            )
        }
    }
}
