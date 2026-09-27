package com.saaserp.attendance.sync

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.saaserp.attendance.R
import com.saaserp.attendance.data.auth.ResetRequest
import com.saaserp.attendance.di.ServiceLocator
import java.util.concurrent.TimeUnit

/**
 * While a password-reset request is pending, polls the server for its
 * outcome (every ~15 min, the WorkManager minimum) and posts a local
 * notification when the admin approves or rejects it, then stops polling.
 * The login screen also refreshes on open and on demand via [notifyIfResolved].
 */
class ResetRequestWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val auth = ServiceLocator.authRepository(applicationContext)
        val request = auth.refreshResetRequest()
        if (request == null || request.status != "pending") {
            notifyIfResolved(applicationContext)
            WorkManager.getInstance(applicationContext).cancelUniqueWork(WORK_NAME)
        }
        return Result.success()
    }

    companion object {
        private const val WORK_NAME = "password_reset_status"
        private const val CHANNEL_ID = "password_reset"
        private const val NOTIFICATION_ID = 4200

        fun schedule(context: Context) {
            val request = PeriodicWorkRequestBuilder<ResetRequestWorker>(15, TimeUnit.MINUTES).build()
            WorkManager.getInstance(context).enqueueUniquePeriodicWork(WORK_NAME, ExistingPeriodicWorkPolicy.KEEP, request)
        }

        /** Shows the approved/rejected notification once for the stored request, if it has been decided and not yet announced. */
        fun notifyIfResolved(context: Context) {
            val auth = ServiceLocator.authRepository(context)
            val request = auth.currentResetRequest() ?: return
            if (request.status == "pending" || request.notified) return
            auth.saveResetRequest(request.copy(notified = true))
            show(context, request)
        }

        private fun show(context: Context, request: ResetRequest) {
            if (Build.VERSION.SDK_INT >= 33 &&
                ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
            ) return

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                (context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).createNotificationChannel(
                    NotificationChannel(CHANNEL_ID, "Password reset", NotificationManager.IMPORTANCE_HIGH)
                )
            }
            val approved = request.status == "approved"
            val title = if (approved) "Password reset approved" else "Password reset rejected"
            val body = if (approved) {
                "Your request was approved. Get your temporary password from the organization admin, sign in with it, then set a new password."
            } else {
                "Your request was rejected" + (request.rejectReason?.let { ": $it" } ?: ".") + " Contact the organization admin if you still need help."
            }
            val launch = androidx.core.app.TaskStackBuilder.create(context)
                .addNextIntent(context.packageManager.getLaunchIntentForPackage(context.packageName) ?: return)
                .getPendingIntent(0, android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_IMMUTABLE)
            val notification = NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_notification)
                .setColor(0xFFEA580C.toInt())
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(NotificationCompat.BigTextStyle().bigText(body))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true)
                .setContentIntent(launch)
                .build()
            NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, notification)
        }
    }
}
