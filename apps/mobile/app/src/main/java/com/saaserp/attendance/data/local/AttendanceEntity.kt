package com.saaserp.attendance.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * Mirrors the shape of `public.attendance_records` in Supabase (see
 * supabase/migrations/015_attendance_system.sql in the main repo) closely
 * enough that syncing is a straight field-for-field mapping — but this is
 * the LOCAL, possibly-not-yet-server-verified copy.
 *
 * [offlineAttendanceId] is generated once, on this device, at capture time
 * and never changes — it is the idempotency key the server's
 * /api/attendance/sync endpoint upserts on. Retrying a sync as many times
 * as needed (process death, dropped connection, etc.) can never create a
 * duplicate attendance record because of this.
 *
 * CRITICAL: [verificationStatus] must start as PENDING_VERIFICATION for
 * every OFFLINE record and may ONLY become VERIFIED/FLAGGED/REJECTED after
 * a successful server response from /api/attendance/sync. Never set it to
 * VERIFIED locally — see ATTENDANCE_PLAN.md section 1.
 */
@Entity(tableName = "attendance_records")
data class AttendanceEntity(
    @PrimaryKey val offlineAttendanceId: String,
    val employeeId: String,
    val capturedAtIso: String,
    /** Asia/Kolkata calendar date ("YYYY-MM-DD") for capturedAtIso — mirrors
     *  the server's attendanceDateFor() so the local one-per-day check and
     *  the server's actual constraint agree on the same day boundary. */
    val attendanceDate: String,
    val verificationMode: String, // "ONLINE" | "OFFLINE"
    val verificationStatus: String, // "PENDING_VERIFICATION" | "VERIFIED" | "FLAGGED" | "REJECTED"
    val syncStatus: String, // "PENDING_SYNC" | "SYNCED"
    val verifiedAtIso: String? = null,
    val gpsLat: Double,
    val gpsLng: Double,
    val gpsAccuracyM: Float? = null,
    val mockLocationReported: Boolean,
    val rootRiskReported: Boolean,
    val developerOptionsReported: Boolean,
    val photoLocalPath: String? = null,
    val photoUrl: String? = null,
    val deviceId: String,
    val appVersion: String,
    val rejectionReason: String? = null,
    val syncAttempts: Int = 0,
    val lastSyncError: String? = null,
    val createdAtIso: String,
    /** "IN" | "OUT" — a day is now a sequence of events, not one row (see supabase/migrations/020_attendance_in_out_half_day.sql). Defaults "IN" so this stays a valid column for rows written before this field existed. */
    val eventType: String = "IN",
    /** "HALF_DAY" or null — set only on the employee's own self-declared half-day exit. */
    val leaveType: String? = null,
    /** Blink-challenge outcome; null = no liveness check ran (older app version, or check skipped). */
    val livenessVerified: Boolean? = null,
)
