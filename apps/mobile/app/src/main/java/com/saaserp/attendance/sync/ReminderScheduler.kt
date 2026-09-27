package com.saaserp.attendance.sync

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.saaserp.attendance.di.ServiceLocator
import com.saaserp.attendance.util.OrganizationHours
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.LocalTime
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter

/**
 * Schedules the daily local "mark in" (organization start) and "mark out"
 * (organization end) notifications from the cached [OrganizationHours]. Alarms are
 * one-shot: [ReminderReceiver] re-arms tomorrow's after each fires, and
 * [CheckoutReminderWorker] / app launch / boot re-arm everything, which
 * also picks up admin changes to the hours.
 *
 * Uses setAndAllowWhileIdle (no exact-alarm permission needed) — Android
 * may deliver it a few minutes late under Doze, which is fine for a reminder.
 */
object ReminderScheduler {
    private const val EXTRA_KIND = "kind"

    fun scheduleAll(context: Context) {
        val hours = OrganizationHours.cached(context)
        schedule(context, ReminderNotifier.ACTION_MARK_IN, hours.start)
        schedule(context, ReminderNotifier.ACTION_MARK_OUT, hours.end)
    }

    fun schedule(context: Context, kind: String, time: LocalTime?) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val pending = pendingIntent(context, kind)
        if (time == null) {
            alarmManager.cancel(pending)
            return
        }
        val now = ZonedDateTime.now(OrganizationHours.IST)
        var next = now.with(time)
        if (!next.isAfter(now)) next = next.plusDays(1)
        // Skip days the organization is closed (Sundays / holidays per admin settings).
        var guard = 0
        while (OrganizationHours.isClosedOn(context, next.toLocalDate()) && guard++ < 7) next = next.plusDays(1)
        alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next.toInstant().toEpochMilli(), pending)
    }

    private fun pendingIntent(context: Context, kind: String): PendingIntent = PendingIntent.getBroadcast(
        context,
        if (kind == ReminderNotifier.ACTION_MARK_IN) 11 else 12,
        Intent(context, ReminderReceiver::class.java).putExtra(EXTRA_KIND, kind),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    internal fun kindOf(intent: Intent): String? = intent.getStringExtra(EXTRA_KIND)
}

class ReminderReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val kind = ReminderScheduler.kindOf(intent) ?: return
        val pendingResult = goAsync()
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val hours = OrganizationHours.cached(context)
                val employeeId = ServiceLocator.authRepository(context).employeeId
                val organizationClosedToday = OrganizationHours.isClosedOn(context, java.time.LocalDate.now(OrganizationHours.IST))
                if (employeeId != null && !organizationClosedToday) {
                    val today = DateTimeFormatter.ofPattern("yyyy-MM-dd").withZone(OrganizationHours.IST).format(Instant.now())
                    val events = ServiceLocator.attendanceRepository(context).todayEventsFor(employeeId, today)
                    val sessionOpen = events.lastOrNull()?.eventType == "IN"
                    // Only nudge when the action is actually still pending.
                    val needed = if (kind == ReminderNotifier.ACTION_MARK_IN) events.isEmpty() else sessionOpen
                    if (needed) {
                        ReminderNotifier.show(context, kind, if (kind == ReminderNotifier.ACTION_MARK_IN) hours.start else hours.end)
                    }
                }
                // Re-arm tomorrow's.
                ReminderScheduler.schedule(context, kind, if (kind == ReminderNotifier.ACTION_MARK_IN) hours.start else hours.end)
            } catch (_: Exception) {
            } finally {
                pendingResult.finish()
            }
        }
    }
}

/** Alarms are cleared on reboot / app update — re-arm them. */
class ReminderBootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        ReminderScheduler.scheduleAll(context)
    }
}
