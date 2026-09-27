package com.saaserp.attendance.ui.admin

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.PictureAsPdf
import androidx.compose.material.icons.filled.TableChart
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.People
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SelectableDates
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.saaserp.attendance.data.remote.AdminAttendanceRowDto
import com.saaserp.attendance.ui.theme.Saffron500
import com.saaserp.attendance.ui.theme.Saffron600
import com.saaserp.attendance.util.s
import java.time.DayOfWeek
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit
import java.time.temporal.TemporalAdjusters
import java.util.Locale

private val DISPLAY_DATE = DateTimeFormatter.ofPattern("dd MMM yyyy", Locale.ENGLISH)

private data class ExportFormat(val key: String, val label: String, val hint: String, val icon: ImageVector)

private val FORMATS = listOf(
    ExportFormat("pdf", "PDF", "Print-ready", Icons.Filled.PictureAsPdf),
    ExportFormat("xlsx", "Excel", "Spreadsheet", Icons.Filled.TableChart),
    ExportFormat("csv", "CSV", "Plain data", Icons.Filled.Description),
)

/**
 * Export attendance: quick ranges + real calendars for From/To, a
 * staff selector, and format chips (PDF by default).
 */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun ExportDialog(
    rows: List<AdminAttendanceRowDto>,
    isExporting: Boolean,
    defaultDate: String,
    onDismiss: () -> Unit,
    onExport: (from: String, to: String, format: String, employeeId: String?) -> Unit,
) {
    val today = remember { LocalDate.now(java.time.ZoneId.of("Asia/Kolkata")) }
    val anchor = remember(defaultDate) { runCatching { LocalDate.parse(defaultDate) }.getOrDefault(today) }
    var from by remember { mutableStateOf(anchor.withDayOfMonth(1)) }
    var to by remember { mutableStateOf(anchor) }
    var format by remember { mutableStateOf("pdf") }
    var picking by remember { mutableStateOf<String?>(null) } // "from" | "to"
    val allStaffLabel = s("All Staff", "सभी स्टाफ")
    var selectedEmployeeId by remember { mutableStateOf<String?>(null) }
    var selectedEmployeeName by remember { mutableStateOf<String?>(null) }
    var staffMenuOpen by remember { mutableStateOf(false) }

    val days = ChronoUnit.DAYS.between(from, to).toInt() + 1

    fun setRange(f: LocalDate, t: LocalDate) {
        from = f
        to = t
    }

    Dialog(onDismissRequest = onDismiss, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Surface(
            shape = RoundedCornerShape(28.dp),
            color = MaterialTheme.colorScheme.surface,
            modifier = Modifier.padding(horizontal = 16.dp).fillMaxWidth().heightIn(max = 640.dp),
        ) {
            Column(modifier = Modifier.verticalScroll(rememberScrollState()).padding(20.dp)) {
                // Header
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier.size(44.dp).clip(CircleShape).background(Saffron500.copy(alpha = 0.16f)),
                        contentAlignment = Alignment.Center,
                    ) { Icon(Icons.Filled.Download, contentDescription = null, tint = Saffron600) }
                    Spacer(Modifier.width(12.dp))
                    Column {
                        Text(
                            s("Export Attendance", "उपस्थिति एक्सपोर्ट करें"),
                            style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                        )
                        Text(
                            s("Choose a period, staff and file format.", "अवधि, स्टाफ और फ़ाइल प्रारूप चुनें।"),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }

                // Quick ranges
                SectionLabel(s("Quick range", "त्वरित अवधि"))
                val monthStart = today.withDayOfMonth(1)
                val ranges = listOf(
                    Triple(s("Today", "आज"), today, today),
                    Triple(s("Last 7 days", "पिछले 7 दिन"), today.minusDays(6), today),
                    Triple(s("This week", "इस सप्ताह"), today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)), today),
                    Triple(s("This month", "इस माह"), monthStart, today),
                    Triple(s("Last month", "पिछला माह"), monthStart.minusMonths(1), monthStart.minusDays(1)),
                )
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    ranges.forEach { (label, f, t) ->
                        FilterChip(
                            selected = from == f && to == t,
                            onClick = { setRange(f, t) },
                            label = { Text(label) },
                            colors = chipColors(),
                        )
                    }
                }

                // Calendars
                SectionLabel(s("Date range", "तारीख सीमा"))
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    DateCard(s("From", "से"), from, Modifier.weight(1f)) { picking = "from" }
                    DateCard(s("To", "तक"), to, Modifier.weight(1f)) { picking = "to" }
                }
                Text(
                    s("$days day(s) selected", "$days दिन चुने गए"),
                    style = MaterialTheme.typography.labelMedium,
                    color = Saffron600,
                    modifier = Modifier.padding(top = 6.dp),
                )

                // Staff
                SectionLabel(s("Staff", "स्टाफ"))
                Box {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(14.dp))
                            .border(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.4f), RoundedCornerShape(14.dp))
                            .clickable { staffMenuOpen = true }
                            .padding(horizontal = 14.dp, vertical = 12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(
                            if (selectedEmployeeId == null) Icons.Filled.People else Icons.Filled.Person,
                            contentDescription = null, tint = Saffron600, modifier = Modifier.size(20.dp),
                        )
                        Spacer(Modifier.width(10.dp))
                        Text(selectedEmployeeName ?: allStaffLabel, modifier = Modifier.weight(1f), fontWeight = FontWeight.SemiBold)
                        Icon(Icons.Filled.ArrowDropDown, contentDescription = null)
                    }
                    DropdownMenu(
                        expanded = staffMenuOpen,
                        onDismissRequest = { staffMenuOpen = false },
                        modifier = Modifier.heightIn(max = 320.dp),
                    ) {
                        DropdownMenuItem(text = { Text(allStaffLabel) }, onClick = {
                            selectedEmployeeId = null; selectedEmployeeName = null; staffMenuOpen = false
                        })
                        rows.forEach { row ->
                            DropdownMenuItem(text = { Text(row.employee.full_name) }, onClick = {
                                selectedEmployeeId = row.employee.id; selectedEmployeeName = row.employee.full_name; staffMenuOpen = false
                            })
                        }
                    }
                }

                // Format chips
                SectionLabel(s("Format", "प्रारूप"))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FORMATS.forEach { f ->
                        FilterChip(
                            selected = format == f.key,
                            onClick = { format = f.key },
                            label = { Text("${f.label}") },
                            leadingIcon = {
                                Icon(
                                    if (format == f.key) Icons.Filled.Check else f.icon,
                                    contentDescription = null,
                                    modifier = Modifier.size(FilterChipDefaults.IconSize),
                                )
                            },
                            colors = chipColors(),
                        )
                    }
                }
                Text(
                    FORMATS.first { it.key == format }.hint,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 4.dp),
                )

                Spacer(Modifier.height(20.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    TextButton(onClick = onDismiss, modifier = Modifier.weight(1f)) { Text(s("Cancel", "रद्द करें")) }
                    Button(
                        onClick = { onExport(from.toString(), to.toString(), format, selectedEmployeeId) },
                        enabled = !isExporting && !from.isAfter(to),
                        shape = RoundedCornerShape(16.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Saffron600, contentColor = Color.White),
                        modifier = Modifier.weight(2f).height(48.dp),
                    ) {
                        if (isExporting) {
                            CircularProgressIndicator(modifier = Modifier.size(18.dp), color = Color.White, strokeWidth = 2.dp)
                        } else {
                            Icon(Icons.Filled.Download, contentDescription = null, modifier = Modifier.size(18.dp))
                            Spacer(Modifier.width(8.dp))
                            Text(s("Export ${format.uppercase()}", "${format.uppercase()} एक्सपोर्ट"), fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
    }

    picking?.let { which ->
        com.saaserp.attendance.ui.components.AppDatePickerDialog(
            title = if (which == "from") s("From date", "प्रारंभ तिथि") else s("To date", "अंतिम तिथि"),
            initial = if (which == "from") from else to,
            maxDate = today,
            onConfirm = { d ->
                if (which == "from") {
                    from = d
                    if (to.isBefore(d)) to = d
                } else {
                    to = d
                    if (from.isAfter(d)) from = d
                }
                picking = null
            },
            onDismiss = { picking = null },
        )
    }
}

@Composable
private fun SectionLabel(text: String) {
    Text(
        text.uppercase(),
        style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold, letterSpacing = 0.8.sp),
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.padding(top = 18.dp, bottom = 8.dp),
    )
}

@Composable
private fun DateCard(label: String, date: LocalDate, modifier: Modifier, onClick: () -> Unit) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(16.dp))
            .background(Saffron500.copy(alpha = 0.08f))
            .border(BorderStroke(1.dp, Saffron500.copy(alpha = 0.35f)), RoundedCornerShape(16.dp))
            .clickable(onClick = onClick)
            .padding(12.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Filled.CalendarMonth, contentDescription = null, tint = Saffron600, modifier = Modifier.size(16.dp))
            Spacer(Modifier.width(6.dp))
            Text(label, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Spacer(Modifier.height(4.dp))
        Text(date.format(DISPLAY_DATE), style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold))
    }
}

@Composable
private fun chipColors() = FilterChipDefaults.filterChipColors(
    selectedContainerColor = Saffron500.copy(alpha = 0.22f),
    selectedLabelColor = Saffron600,
    selectedLeadingIconColor = Saffron600,
)
