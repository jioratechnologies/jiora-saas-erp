package com.saaserp.attendance.sync

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.BitmapFactory
import android.graphics.Color
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.saaserp.attendance.MainActivity
import com.saaserp.attendance.R
import java.time.LocalTime
import java.time.format.DateTimeFormatter
import java.util.Locale

/** Builds and posts the "mark in" / "mark out" reminder, adapting to what the device's Android version supports. */
object ReminderNotifier {
    const val EXTRA_ACTION = "reminder_action"
    const val ACTION_MARK_IN = "MARK_IN"
    const val ACTION_MARK_OUT = "MARK_OUT"

    /** Set by MainActivity when a reminder notification is tapped; consumed by the check-in screen's ViewModel. */
    val pendingAction = kotlinx.coroutines.flow.MutableStateFlow<String?>(null)

    private const val CHANNEL_ID = "attendance_reminders"
    private const val ID_IN = 4100
    private const val ID_OUT = 4101
    private const val BRAND = 0xFFEA580C.toInt() // saffron_600

    fun cancelAll(context: Context) {
        NotificationManagerCompat.from(context).cancel(ID_IN)
        NotificationManagerCompat.from(context).cancel(ID_OUT)
    }

    fun show(context: Context, action: String, scheduledTime: LocalTime?) {
        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) return

        val isIn = action == ACTION_MARK_IN
        val timeText = scheduledTime?.format(DateTimeFormatter.ofPattern("h:mm a", Locale.ENGLISH))
        val title = if (isIn) "Good morning! Time to mark in" else "Organization's over — mark out"
        val body = if (isIn) {
            "Organization starts${timeText?.let { " at $it" } ?: ""}. Tap to mark your attendance."
        } else {
            "Organization closed${timeText?.let { " at $it" } ?: ""} and you're still checked in. Tap to mark out."
        }
        val actionLabel = if (isIn) "Mark In" else "Mark Out"

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(
                NotificationChannel(CHANNEL_ID, "Attendance reminders", NotificationManager.IMPORTANCE_HIGH).apply {
                    description = "Reminds you to mark in and mark out"
                    enableVibration(true)
                    lightColor = BRAND
                    enableLights(true)
                }
            )
        }

        val tapIntent = PendingIntent.getActivity(
            context, if (isIn) 1 else 2,
            Intent(context, MainActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
                .putExtra(EXTRA_ACTION, action),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val builder = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setColor(BRAND)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(tapIntent)

        // Android 8+: brand logo as large icon + subtitle. Android 7 and
        // older don't render these consistently, so they get the plain
        // title/body/priority notification (+ default sound/vibration, since
        // channels don't exist there to carry that setting).
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            BitmapFactory.decodeResource(context.resources, R.drawable.dsps_logo)?.let { builder.setLargeIcon(it) }
            builder.setSubText("SaaS ERP Attendance")
        } else {
            builder.setDefaults(NotificationCompat.DEFAULT_ALL)
        }

        // Android 7+: inline action button. Android 12+: also show the
        // time the reminder is for and give the action a saffron tint.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            builder.addAction(R.drawable.ic_notification, actionLabel, tapIntent)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            builder.setWhen(System.currentTimeMillis()).setShowWhen(true)
            builder.setColorized(false)
        }

        NotificationManagerCompat.from(context).notify(if (isIn) ID_IN else ID_OUT, builder.build())
    }
}
