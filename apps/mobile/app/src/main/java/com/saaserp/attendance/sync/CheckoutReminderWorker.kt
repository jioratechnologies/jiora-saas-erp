package com.saaserp.attendance.sync

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.saaserp.attendance.di.ServiceLocator
import com.saaserp.attendance.util.OrganizationHours
import java.time.Instant
import java.time.format.DateTimeFormatter
import java.util.concurrent.TimeUnit

/**
 * Runs every ~15 min as the safety net behind [ReminderScheduler]'s alarms:
 * (1) refreshes organization start/end time from the server every few hours and
 * re-arms the daily alarms, (2) after organization closing time, if the signed-in
 * employee is still checked in, re-posts the "mark out" reminder so it
 * repeats until they check out (stops at 9 PM IST — the server's
 * auto-checkout cron closes any leftover session).
 */
class CheckoutReminderWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        try {
            val auth = ServiceLocator.authRepository(applicationContext)
            val employeeId = auth.employeeId ?: return Result.success()

            if (OrganizationHours.ageMs(applicationContext) > REFRESH_INTERVAL_MS) {
                OrganizationHours.refresh(applicationContext)
            }
            ReminderScheduler.scheduleAll(applicationContext)

            if (OrganizationHours.isClosedOn(applicationContext, java.time.LocalDate.now(OrganizationHours.IST))) return Result.success()

            val endTime = OrganizationHours.cachedEndTime(applicationContext)
            if (!OrganizationHours.isPastEndTime(endTime)) return Result.success()
            if (Instant.now().atZone(OrganizationHours.IST).hour >= CUTOFF_HOUR_IST) return Result.success()

            val today = DateTimeFormatter.ofPattern("yyyy-MM-dd").withZone(OrganizationHours.IST).format(Instant.now())
            val events = ServiceLocator.attendanceRepository(applicationContext).todayEventsFor(employeeId, today)
            if (events.lastOrNull()?.eventType == "IN") {
                ReminderNotifier.show(applicationContext, ReminderNotifier.ACTION_MARK_OUT, endTime)
            }
        } catch (_: Exception) {
            // Best-effort — never fail/retry-storm over a reminder.
        }
        return Result.success()
    }

    companion object {
        private const val WORK_NAME = "checkout_reminder"
        private const val CUTOFF_HOUR_IST = 21
        private val REFRESH_INTERVAL_MS = TimeUnit.HOURS.toMillis(4)

        fun schedule(context: Context) {
            val request = PeriodicWorkRequestBuilder<CheckoutReminderWorker>(15, TimeUnit.MINUTES).build()
            WorkManager.getInstance(context)
                .enqueueUniquePeriodicWork(WORK_NAME, ExistingPeriodicWorkPolicy.KEEP, request)
        }

        fun cancelReminder(context: Context) = ReminderNotifier.cancelAll(context)
    }
}
