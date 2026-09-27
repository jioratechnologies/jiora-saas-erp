package com.saaserp.attendance.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDefaults
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SelectableDates
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.saaserp.attendance.ui.theme.Saffron600
import com.saaserp.attendance.util.s
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset

/**
 * The one date picker used across the app: Material 3's calendar in the
 * SaaS ERP saffron theme (selected day, today ring, year picker and confirm
 * button all brand-coloured, rounded 28dp container), replacing the
 * legacy blue android.app.DatePickerDialog.
 *
 * Dates are LocalDate at the API; Material's picker works in UTC millis,
 * converted here so callers never deal with timezones.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AppDatePickerDialog(
    title: String,
    initial: LocalDate?,
    onConfirm: (LocalDate) -> Unit,
    onDismiss: () -> Unit,
    minDate: LocalDate? = null,
    maxDate: LocalDate? = null,
) {
    fun LocalDate.toUtcMillis() = atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli()
    fun Long.toLocalDate() = Instant.ofEpochMilli(this).atZone(ZoneOffset.UTC).toLocalDate()

    val selectable = object : SelectableDates {
        override fun isSelectableDate(utcTimeMillis: Long): Boolean {
            val d = utcTimeMillis.toLocalDate()
            return (minDate == null || !d.isBefore(minDate)) && (maxDate == null || !d.isAfter(maxDate))
        }
        override fun isSelectableYear(year: Int) =
            (minDate == null || year >= minDate.year) && (maxDate == null || year <= maxDate.year)
    }
    val start = (initial ?: maxDate ?: LocalDate.now()).let { d ->
        when {
            maxDate != null && d.isAfter(maxDate) -> maxDate
            minDate != null && d.isBefore(minDate) -> minDate
            else -> d
        }
    }
    val state = rememberDatePickerState(
        initialSelectedDateMillis = start.toUtcMillis(),
        initialDisplayedMonthMillis = start.toUtcMillis(),
        selectableDates = selectable,
    )

    DatePickerDialog(
        onDismissRequest = onDismiss,
        shape = RoundedCornerShape(28.dp),
        colors = DatePickerDefaults.colors(containerColor = MaterialTheme.colorScheme.surface),
        confirmButton = {
            Button(
                onClick = { state.selectedDateMillis?.let { onConfirm(it.toLocalDate()) } },
                enabled = state.selectedDateMillis != null,
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Saffron600, contentColor = Color.White),
            ) { Text(s("OK", "ठीक है"), fontWeight = FontWeight.Bold) }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text(s("Cancel", "रद्द करें"), color = MaterialTheme.colorScheme.onSurfaceVariant) }
        },
    ) {
        DatePicker(
            state = state,
            title = {
                Row(
                    modifier = Modifier.padding(start = 24.dp, end = 12.dp, top = 20.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.Start,
                ) {
                    Icon(Icons.Filled.CalendarMonth, contentDescription = null, tint = Saffron600, modifier = Modifier.size(20.dp))
                    Spacer(Modifier.width(8.dp))
                    Text(
                        title,
                        style = MaterialTheme.typography.labelLarge.copy(fontWeight = FontWeight.Bold),
                        color = Saffron600,
                    )
                }
            },
            colors = DatePickerDefaults.colors(
                containerColor = MaterialTheme.colorScheme.surface,
                titleContentColor = Saffron600,
                headlineContentColor = MaterialTheme.colorScheme.onSurface,
                weekdayContentColor = MaterialTheme.colorScheme.onSurfaceVariant,
                subheadContentColor = MaterialTheme.colorScheme.onSurfaceVariant,
                navigationContentColor = Saffron600,
                yearContentColor = MaterialTheme.colorScheme.onSurface,
                currentYearContentColor = Saffron600,
                selectedYearContainerColor = Saffron600,
                selectedYearContentColor = Color.White,
                dayContentColor = MaterialTheme.colorScheme.onSurface,
                selectedDayContainerColor = Saffron600,
                selectedDayContentColor = Color.White,
                todayContentColor = Saffron600,
                todayDateBorderColor = Saffron600,
                disabledDayContentColor = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.3f),
            ),
        )
    }
}
