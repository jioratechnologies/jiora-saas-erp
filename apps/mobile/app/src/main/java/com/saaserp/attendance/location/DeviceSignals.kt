package com.saaserp.attendance.location

import android.content.Context
import android.provider.Settings
import java.io.File

/**
 * Best-effort, easily-bypassed local heuristics — intentionally NOT
 * treated as proof anywhere in this system. They're reported to the server
 * as `*_reported` flags and only ever contribute to a FLAGGED (human
 * review) outcome, never an automatic VERIFIED. See ATTENDANCE_PLAN.md,
 * "Never assume ... reported by the offline device is proof."
 */
object DeviceSignals {

    fun isDeveloperOptionsEnabled(context: Context): Boolean =
        Settings.Secure.getInt(context.contentResolver, Settings.Global.DEVELOPMENT_SETTINGS_ENABLED, 0) != 0

    /** Cheap root heuristics only — a real anti-tamper SDK would replace this if the policy ever needs it. */
    fun hasRootRiskSignals(): Boolean {
        val suspiciousPaths = listOf(
            "/system/app/Superuser.apk",
            "/sbin/su",
            "/system/bin/su",
            "/system/xbin/su",
            "/data/local/xbin/su",
            "/data/local/bin/su",
            "/system/sd/xbin/su",
            "/system/bin/failsafe/su",
            "/data/local/su",
            "/su/bin/su",
        )
        return suspiciousPaths.any { File(it).exists() } || buildTagsLookSuspicious()
    }

    private fun buildTagsLookSuspicious(): Boolean =
        android.os.Build.TAGS?.contains("test-keys") == true
}
