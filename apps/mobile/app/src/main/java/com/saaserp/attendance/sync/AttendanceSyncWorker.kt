package com.saaserp.attendance.sync

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.saaserp.attendance.di.ServiceLocator

/**
 * Reconciles every PENDING_SYNC record with the server. Safe to run
 * repeatedly and concurrently-ish (WorkManager itself de-dupes by unique
 * work name — see [SyncScheduler]) because the server-side upsert on
 * offline_attendance_id is the real idempotency guarantee, not anything
 * happening on-device.
 */
class AttendanceSyncWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val repository = ServiceLocator.attendanceRepository(applicationContext)
        return try {
            val outcome = repository.syncPendingRecords()
            if (outcome.failed > 0 && outcome.succeeded == 0) {
                Result.retry()
            } else {
                Result.success()
            }
        } catch (e: Exception) {
            Result.retry()
        }
    }
}
