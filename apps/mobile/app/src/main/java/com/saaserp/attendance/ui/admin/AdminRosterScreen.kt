package com.saaserp.attendance.ui.admin

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import android.app.DatePickerDialog
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.draw.clip
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Login
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.ChevronLeft
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.Error
import androidx.compose.material.icons.filled.FilterAlt
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.runtime.Composable
import androidx.compose.foundation.lazy.itemsIndexed
import com.saaserp.attendance.ui.tour.coachTarget
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.FileProvider
import androidx.lifecycle.viewmodel.compose.viewModel
import com.saaserp.attendance.data.remote.AdminAttendanceEventDto
import com.saaserp.attendance.data.remote.AdminAttendanceRowDto
import com.saaserp.attendance.ui.theme.Saffron600
import com.saaserp.attendance.util.UrlResolver
import com.saaserp.attendance.util.s
import java.time.LocalDate
import java.time.format.DateTimeFormatter

@androidx.compose.runtime.Composable
private fun dayTypeLabel(key: String): String = when (key) {
    "NOT_MARKED" -> s("Not Marked", "अंकित नहीं")
    "IN_PROGRESS" -> s("In Progress", "जारी")
    "FULL_DAY" -> s("Full Day", "पूर्ण दिन")
    "HALF_DAY" -> s("Half Day", "आधा दिन")
    "EARLY_LEAVE" -> s("Early Leave", "जल्दी प्रस्थान")
    else -> key
}

private fun formatTime(iso: String?): String {
    if (iso.isNullOrBlank()) return "—"
    return try {
        java.time.Instant.parse(iso)
            .atZone(java.time.ZoneId.of("Asia/Kolkata"))
            .format(DateTimeFormatter.ofPattern("hh:mm a"))
    } catch (e: Exception) {
        "—"
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AdminRosterScreen(viewModel: AdminRosterViewModel = viewModel()) {
    val uiState by viewModel.uiState.collectAsState()
    val context = LocalContext.current
    var showExportSheet by remember { mutableStateOf(false) }
    var selectedRow by remember { mutableStateOf<AdminAttendanceRowDto?>(null) }
    val openExportLabel = s("Open attendance export", "उपस्थिति एक्सपोर्ट खोलें")
    val shareExportLabel = s("Share attendance export", "उपस्थिति एक्सपोर्ट साझा करें")

    LaunchedEffect(uiState.exportedFile) {
        val file = uiState.exportedFile ?: return@LaunchedEffect
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
        val mimeType = context.contentResolver.getType(uri) ?: "application/octet-stream"
        // Open directly in whatever PDF/Excel/CSV app the phone already has,
        // same as tapping a real downloaded file — ACTION_SEND alone only
        // ever offered "share to another app," never "open this file."
        val viewIntent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, mimeType)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        try {
            context.startActivity(Intent.createChooser(viewIntent, openExportLabel))
        } catch (e: Exception) {
            val shareIntent = Intent(Intent.ACTION_SEND).apply {
                type = mimeType
                putExtra(Intent.EXTRA_STREAM, uri)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            context.startActivity(Intent.createChooser(shareIntent, shareExportLabel))
        }
        viewModel.consumeExportedFile()
    }

    var showDatePicker by remember { mutableStateOf(false) }
    if (showDatePicker) {
        com.saaserp.attendance.ui.components.AppDatePickerDialog(
            title = s("Roster date", "रोस्टर तिथि"),
            initial = runCatching { LocalDate.parse(uiState.date) }.getOrNull(),
            maxDate = LocalDate.parse(todayIstDate()),
            onConfirm = { viewModel.loadDate(it.toString()); showDatePicker = false },
            onDismiss = { showDatePicker = false },
        )
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp, vertical = 6.dp)
    ) {
        // Header + export merged into one row — a separate full-width Export
        // bar plus its own spacer was pure vertical space this screen didn't
        // need; the icon button here does the same job in the same row as
        // the title.
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    s("Staff Roster", "स्टाफ रोस्टर"),
                    style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                    color = MaterialTheme.colorScheme.onBackground,
                )
                Text(
                    s("Who checked in today and how it was verified.", "आज किसने चेक-इन किया और यह कैसे सत्यापित हुआ।"),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            IconButton(
                onClick = { showExportSheet = true },
                enabled = !uiState.isExporting,
                modifier = Modifier.coachTarget("roster_export"),
            ) {
                if (uiState.isExporting) {
                    CircularProgressIndicator(modifier = Modifier.size(18.dp), color = Saffron600, strokeWidth = 2.dp)
                } else {
                    Icon(
                        Icons.Filled.Download,
                        contentDescription = s("Export Attendance", "उपस्थिति एक्सपोर्ट करें"),
                        tint = Saffron600,
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(4.dp))

        // ── Date navigator with custom Date Picker ──
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            IconButton(
                onClick = {
                    val prev = LocalDate.parse(uiState.date).minusDays(1)
                    viewModel.loadDate(prev.toString())
                },
                modifier = Modifier.size(36.dp),
            ) {
                Icon(Icons.Filled.ChevronLeft, contentDescription = "Previous day", tint = MaterialTheme.colorScheme.onSurface)
            }

            Surface(
                modifier = Modifier.coachTarget("roster_date"),
                onClick = { showDatePicker = true },
                shape = RoundedCornerShape(20.dp),
                color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.45f),
                border = BorderStroke(1.dp, Saffron600.copy(alpha = 0.35f)),
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.padding(horizontal = 14.dp, vertical = 6.dp),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    Icon(
                        Icons.Filled.CalendarMonth,
                        contentDescription = "Pick Date",
                        tint = Saffron600,
                        modifier = Modifier.size(16.dp),
                    )
                    Text(
                        uiState.date,
                        style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold),
                        color = MaterialTheme.colorScheme.onBackground,
                    )
                    if (uiState.date == todayIstDate()) {
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(6.dp))
                                .background(Saffron600.copy(alpha = 0.15f))
                                .padding(horizontal = 5.dp, vertical = 1.dp)
                        ) {
                            Text(
                                s("Today", "आज"),
                                style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold, fontSize = 9.sp),
                                color = Saffron600,
                            )
                        }
                    }
                }
            }

            IconButton(
                onClick = {
                    val next = LocalDate.parse(uiState.date).plusDays(1)
                    if (next.toString() <= todayIstDate()) viewModel.loadDate(next.toString())
                },
                enabled = uiState.date < todayIstDate(),
                modifier = Modifier.size(36.dp),
            ) {
                Icon(
                    Icons.Filled.ChevronRight,
                    contentDescription = "Next day",
                    tint = if (uiState.date < todayIstDate()) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.3f),
                )
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        when {
            uiState.isLoading -> Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = Saffron600)
            }
            uiState.error != null -> Box(modifier = Modifier.fillMaxWidth().padding(top = 40.dp), contentAlignment = Alignment.Center) {
                Text(uiState.error ?: "", color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyMedium)
            }
            !uiState.canViewRoster -> Box(modifier = Modifier.fillMaxWidth().padding(top = 40.dp), contentAlignment = Alignment.Center) {
                Text(
                    s("You don't have roster access for this date.", "आपके पास इस तिथि के लिए रोस्टर एक्सेस नहीं है।"),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            uiState.rows.isEmpty() -> Box(modifier = Modifier.fillMaxWidth().padding(top = 40.dp), contentAlignment = Alignment.Center) {
                Text(s("No staff found.", "कोई स्टाफ नहीं मिला।"), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            else -> LazyColumn(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(10.dp),
                contentPadding = PaddingValues(bottom = 8.dp),
            ) {
                itemsIndexed(uiState.rows, key = { _, it -> it.employee.id }) { index, row ->
                    RosterRow(
                        row = row,
                        onClick = { selectedRow = row },
                        modifier = if (index == 0) Modifier.coachTarget("roster_list") else Modifier,
                    )
                }
            }
        }
    }

    selectedRow?.let { row ->
        StaffAttendanceDetailSheet(
            row = row,
            onDismiss = { selectedRow = null },
        )
    }

    if (showExportSheet) {
        ExportDialog(
            rows = uiState.rows,
            isExporting = uiState.isExporting,
            defaultDate = uiState.date,
            onDismiss = { showExportSheet = false },
            onExport = { from, to, format, employeeId ->
                viewModel.exportRange(from, to, format, employeeId)
                showExportSheet = false
            },
        )
    }

    uiState.exportError?.let { message ->
        AlertDialog(
            onDismissRequest = viewModel::dismissExportError,
            icon = { Icon(Icons.Filled.Error, contentDescription = null) },
            title = { Text(s("Export Failed", "एक्सपोर्ट विफल")) },
            text = { Text(message) },
            confirmButton = { Button(onClick = viewModel::dismissExportError) { Text(s("OK", "ठीक है")) } },
        )
    }
}

private data class AdminRosterSession(
    val shiftNumber: Int,
    val inEvent: AdminAttendanceEventDto?,
    val outEvent: AdminAttendanceEventDto?,
)

private fun pairRosterSessions(events: List<AdminAttendanceEventDto>): List<AdminRosterSession> {
    val sorted = events.sortedBy { it.captured_at }
    val sessions = mutableListOf<AdminRosterSession>()
    var currentIn: AdminAttendanceEventDto? = null

    for (event in sorted) {
        if (event.event_type == "IN") {
            if (currentIn != null) {
                sessions.add(AdminRosterSession(sessions.size + 1, currentIn, null))
            }
            currentIn = event
        } else {
            sessions.add(AdminRosterSession(sessions.size + 1, currentIn, event))
            currentIn = null
        }
    }
    if (currentIn != null) {
        sessions.add(AdminRosterSession(sessions.size + 1, currentIn, null))
    }
    return sessions
}

@Composable
private fun RosterRow(
    row: AdminAttendanceRowDto,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val employee = row.employee
    val sessions = remember(row.events) { pairRosterSessions(row.events) }
    val needsReview = row.events.any { it.verification_status == "FLAGGED" || it.verification_status == "REJECTED" }
    val punchCount = row.events.size
    val context = LocalContext.current

    Row(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f))
            .clickable(onClick = onClick)
            .padding(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier
                .size(42.dp)
                .clip(CircleShape)
                .background(MaterialTheme.colorScheme.surfaceVariant),
            contentAlignment = Alignment.Center,
        ) {
            val resolvedPhoto = UrlResolver.resolve(employee.photo_url)
            if (!resolvedPhoto.isNullOrBlank()) {
                coil.compose.AsyncImage(
                    model = UrlResolver.toCoilModel(resolvedPhoto),
                    contentDescription = employee.full_name,
                    modifier = Modifier.fillMaxSize().clip(CircleShape),
                    contentScale = ContentScale.Crop,
                )
            } else {
                Icon(Icons.Filled.Person, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
        Spacer(modifier = Modifier.width(10.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                employee.full_name,
                style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold),
                color = MaterialTheme.colorScheme.onSurface,
            )
            if (sessions.isEmpty()) {
                Text(
                    s("No check-in", "कोई चेक-इन नहीं"),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            } else {
                val punchLabel = when (punchCount) {
                    1 -> s("1 Punch", "1 पंच")
                    else -> "$punchCount ${s("Punches", "पंच")}"
                }
                val shiftLabel = when (sessions.size) {
                    1 -> s("1 Shift", "1 शिफ्ट")
                    else -> "${sessions.size} ${s("Shifts", "शिफ्ट")}"
                }
                Text(
                    "$punchLabel · $shiftLabel",
                    style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                    color = Saffron600,
                )

                if (sessions.size == 1) {
                    val s1 = sessions[0]
                    val inStr = if (s1.inEvent != null) "${s("In", "इन")} ${formatTime(s1.inEvent.captured_at)}" else ""
                    val outStr = when {
                        s1.outEvent != null -> " · ${s("Out", "आउट")} ${formatTime(s1.outEvent.captured_at)}"
                        else -> " · ${s("Active", "सक्रिय")}"
                    }
                    Text(
                        inStr + outStr,
                        style = MaterialTheme.typography.bodySmall.copy(fontSize = 11.sp),
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                } else {
                    Column(verticalArrangement = Arrangement.spacedBy(1.dp)) {
                        sessions.forEach { sess ->
                            val inStr = if (sess.inEvent != null) "In ${formatTime(sess.inEvent.captured_at)}" else "No In"
                            val outStr = if (sess.outEvent != null) " → Out ${formatTime(sess.outEvent.captured_at)}" else " → Active"
                            Text(
                                "S${sess.shiftNumber}: $inStr$outStr",
                                style = MaterialTheme.typography.bodySmall.copy(fontSize = 11.sp),
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                }
            }
        }
        if (!employee.phone.isNullOrBlank()) {
            IconButton(onClick = {
                val intent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:${employee.phone}"))
                context.startActivity(intent)
            }) {
                Icon(Icons.Filled.Call, contentDescription = "Call ${employee.full_name}", tint = Saffron600)
            }
        }
        Column(horizontalAlignment = Alignment.End) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(horizontalAlignment = Alignment.End) {
                    Text(
                        dayTypeLabel(row.dayType),
                        style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                        color = Saffron600,
                    )
                    if (needsReview) {
                        Text(s("Needs review", "समीक्षा आवश्यक"), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.error)
                    }
                }
                Spacer(modifier = Modifier.width(2.dp))
                Icon(
                    Icons.Filled.ChevronRight,
                    contentDescription = "View Details",
                    tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f),
                    modifier = Modifier.size(18.dp),
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun StaffAttendanceDetailSheet(
    row: AdminAttendanceRowDto,
    onDismiss: () -> Unit,
) {
    val context = LocalContext.current
    val employee = row.employee
    val sessions = remember(row.events) { pairRosterSessions(row.events) }
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = false)

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        shape = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp),
        containerColor = MaterialTheme.colorScheme.surface,
    ) {
        LazyColumn(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp),
            contentPadding = PaddingValues(bottom = 36.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            // Header Profile
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box(
                        modifier = Modifier
                            .size(54.dp)
                            .clip(CircleShape)
                            .background(MaterialTheme.colorScheme.surfaceVariant),
                        contentAlignment = Alignment.Center,
                    ) {
                        val resolvedPhoto = UrlResolver.resolve(employee.photo_url)
                        if (!resolvedPhoto.isNullOrBlank()) {
                            coil.compose.AsyncImage(
                                model = UrlResolver.toCoilModel(resolvedPhoto),
                                contentDescription = employee.full_name,
                                modifier = Modifier.fillMaxSize().clip(CircleShape),
                                contentScale = ContentScale.Crop,
                            )
                        } else {
                            Icon(
                                Icons.Filled.Person,
                                contentDescription = null,
                                modifier = Modifier.size(32.dp),
                                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                    Spacer(modifier = Modifier.width(14.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            employee.full_name,
                            style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                            color = MaterialTheme.colorScheme.onSurface,
                        )
                        if (employee.email.isNotBlank()) {
                            Text(
                                employee.email,
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                        if (employee.role_key.isNotBlank()) {
                            Text(
                                employee.role_key.replace('_', ' ').uppercase(),
                                style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                                color = Saffron600,
                            )
                        }
                    }
                    if (!employee.phone.isNullOrBlank()) {
                        IconButton(
                            onClick = {
                                val intent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:${employee.phone}"))
                                context.startActivity(intent)
                            },
                        ) {
                            Icon(Icons.Filled.Call, contentDescription = "Call", tint = Saffron600)
                        }
                    }
                }
            }

            // Attendance Summary Banner
            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(14.dp))
                        .background(Saffron600.copy(alpha = 0.1f))
                        .padding(12.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column {
                        Text(
                            s("Day Attendance Status", "दैनिक उपस्थिति स्थिति"),
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Text(
                            dayTypeLabel(row.dayType),
                            style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
                            color = Saffron600,
                        )
                    }
                    Column(horizontalAlignment = Alignment.End) {
                        Text(
                            "${row.events.size} ${s("Total Punches", "कुल पंच")}",
                            style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold),
                            color = MaterialTheme.colorScheme.onSurface,
                        )
                        if (sessions.isNotEmpty()) {
                            Text(
                                "${sessions.size} ${s("Shifts Recorded", "शिफ्ट रिकॉर्ड")}",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                }
            }

            // Punch Events
            if (row.events.isEmpty()) {
                item {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 24.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            s("No attendance marked for this date.", "इस तिथि के लिए कोई उपस्थिति दर्ज नहीं की गई।"),
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            } else {
                item {
                    Text(
                        s("Detailed Punch Logs", "विस्तृत पंच रिकॉर्ड"),
                        style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                }

                items(row.events.sortedBy { it.captured_at }, key = { it.id ?: it.captured_at }) { event ->
                    PunchDetailCard(event = event, sessions = sessions, employeeId = employee.id)
                }
            }
        }
    }
}

@Composable
private fun PunchDetailCard(
    event: AdminAttendanceEventDto,
    sessions: List<AdminRosterSession>,
    employeeId: String,
) {
    val shiftNumber = sessions.find { it.inEvent?.id == event.id || it.outEvent?.id == event.id }?.shiftNumber
    val isCheckIn = event.event_type == "IN"
    val isVerified = event.verification_status == "VERIFIED"
    val isFlagged = event.verification_status == "FLAGGED"
    val isRejected = event.verification_status == "REJECTED"

    val statusBg = when {
        isVerified -> Color(0xFF10B981).copy(alpha = 0.12f)
        isFlagged -> Saffron600.copy(alpha = 0.15f)
        isRejected -> MaterialTheme.colorScheme.error.copy(alpha = 0.15f)
        else -> MaterialTheme.colorScheme.surfaceVariant
    }
    val statusColor = when {
        isVerified -> Color(0xFF059669)
        isFlagged -> Saffron600
        isRejected -> MaterialTheme.colorScheme.error
        else -> MaterialTheme.colorScheme.onSurfaceVariant
    }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.35f))
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        // Top row: Shift + Check-In/Out + Status badge + Time
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

                if (event.leave_type == "HALF_DAY") {
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(6.dp))
                            .background(Color(0xFF9333EA).copy(alpha = 0.12f))
                            .padding(horizontal = 6.dp, vertical = 2.dp),
                    ) {
                        Text(
                            s("Half Day", "आधा दिन"),
                            style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold, fontSize = 10.sp),
                            color = Color(0xFF9333EA),
                        )
                    }
                }
            }

            Text(
                formatTime(event.captured_at),
                style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold),
                color = MaterialTheme.colorScheme.onSurface,
            )
        }

        // Status & Mode row
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(12.dp))
                    .background(statusBg)
                    .padding(horizontal = 8.dp, vertical = 3.dp),
            ) {
                Text(
                    when (event.verification_status) {
                        "VERIFIED" -> s("Verified", "सत्यापित")
                        "FLAGGED" -> s("Flagged for Review", "समीक्षा हेतु चिह्नित")
                        "REJECTED" -> s("Rejected", "अस्वीकृत")
                        else -> s("Pending", "लंबित")
                    },
                    style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                    color = statusColor,
                )
            }

            if (!event.verification_mode.isNullOrBlank()) {
                Text(
                    event.verification_mode.uppercase(),
                    style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Medium),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }

        // Alerts / warnings
        if (!event.marked_by.isNullOrBlank() && event.marked_by != employeeId) {
            val markedByName = event.marked_by_profile?.full_name ?: s("colleague", "सहकर्मी")
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(8.dp))
                    .background(Saffron600.copy(alpha = 0.12f))
                    .padding(8.dp),
            ) {
                Text(
                    "${s("Marked by colleague", "सहकर्मी द्वारा अंकित")}: $markedByName",
                    style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.SemiBold),
                    color = Saffron600,
                )
            }
        }

        if (event.liveness_verified == false) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(8.dp))
                    .background(MaterialTheme.colorScheme.error.copy(alpha = 0.12f))
                    .padding(8.dp),
            ) {
                Text(
                    s("Liveness (blink) check did not pass", "जीवंतता (पलक झपकना) जांच विफल"),
                    style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.SemiBold),
                    color = MaterialTheme.colorScheme.error,
                )
            }
        }

        if (event.mock_location_reported == true) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(8.dp))
                    .background(MaterialTheme.colorScheme.error.copy(alpha = 0.12f))
                    .padding(8.dp),
            ) {
                Text(
                    s("Mock / fake GPS location detected", "नकली जीपीएस स्थान पाया गया"),
                    style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.SemiBold),
                    color = MaterialTheme.colorScheme.error,
                )
            }
        }

        if (event.root_risk_reported == true) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(8.dp))
                    .background(MaterialTheme.colorScheme.error.copy(alpha = 0.12f))
                    .padding(8.dp),
            ) {
                Text(
                    s("Compromised or rooted device risk reported", "रूटेड या असुरक्षित डिवाइस जोखिम"),
                    style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.SemiBold),
                    color = MaterialTheme.colorScheme.error,
                )
            }
        }

        if (!event.rejection_reason.isNullOrBlank()) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(8.dp))
                    .background(MaterialTheme.colorScheme.error.copy(alpha = 0.12f))
                    .padding(8.dp),
            ) {
                Text(
                    event.rejection_reason,
                    style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.SemiBold),
                    color = MaterialTheme.colorScheme.error,
                )
            }
        }

        // Captured Photo
        val resolvedPhoto = UrlResolver.resolve(event.photo_url)
        if (!resolvedPhoto.isNullOrBlank()) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(200.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(MaterialTheme.colorScheme.surfaceVariant),
            ) {
                coil.compose.AsyncImage(
                    model = UrlResolver.toCoilModel(resolvedPhoto),
                    contentDescription = "Punch verification photo",
                    modifier = Modifier.fillMaxSize(),
                    contentScale = ContentScale.Crop,
                )
            }
        }

        // GPS Location & distance
        if (event.gps_lat != null && event.gps_lng != null) {
            var showMap by remember { mutableStateOf(false) }
            if (showMap) {
                LocationMapDialog(
                    lat = event.gps_lat,
                    lng = event.gps_lng,
                    accuracyM = event.gps_accuracy_m,
                    distanceFromCampusM = event.distance_from_campus_m,
                    onDismiss = { showMap = false },
                )
            }
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(8.dp))
                    .clickable { showMap = true }
                    .background(MaterialTheme.colorScheme.surface)
                    .padding(8.dp),
                verticalArrangement = Arrangement.spacedBy(2.dp),
            ) {
                val accStr = if (event.gps_accuracy_m != null) " (±${event.gps_accuracy_m.toInt()}m)" else ""
                Text(
                    "📍 GPS: ${String.format(java.util.Locale.US, "%.5f, %.5f", event.gps_lat, event.gps_lng)}$accStr",
                    style = MaterialTheme.typography.labelSmall.copy(textDecoration = androidx.compose.ui.text.style.TextDecoration.Underline),
                    color = Saffron600,
                )
                Text(
                    s("Tap to view on map", "मानचित्र पर देखने के लिए दबाएँ"),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                if (event.distance_from_campus_m != null) {
                    Text(
                        "${event.distance_from_campus_m.toInt()}m ${s("from campus center", "परिसर केंद्र से दूरी")}",
                        style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                }
            }
        }
    }
}
