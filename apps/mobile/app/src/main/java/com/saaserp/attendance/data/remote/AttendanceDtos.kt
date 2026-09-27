package com.saaserp.attendance.data.remote

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** Field names/casing here must match the Next.js API exactly — see
 *  src/app/api/attendance/[...]/route.ts in the main repo. */

@Serializable
data class ChallengeResponse(
    @SerialName("challenge_id") val challengeId: String,
    val nonce: String,
    @SerialName("issued_at") val issuedAt: String,
    @SerialName("expires_at") val expiresAt: String,
)

@Serializable
data class VerifyRequest(
    @SerialName("challenge_id") val challengeId: String,
    val nonce: String,
    @SerialName("offline_attendance_id") val offlineAttendanceId: String,
    @SerialName("captured_at") val capturedAt: String,
    @SerialName("gps_lat") val gpsLat: Double,
    @SerialName("gps_lng") val gpsLng: Double,
    @SerialName("gps_accuracy_m") val gpsAccuracyM: Float? = null,
    @SerialName("mock_location_reported") val mockLocationReported: Boolean,
    @SerialName("root_risk_reported") val rootRiskReported: Boolean,
    @SerialName("developer_options_reported") val developerOptionsReported: Boolean,
    @SerialName("photo_url") val photoUrl: String? = null,
    @SerialName("device_id") val deviceId: String,
    @SerialName("app_version") val appVersion: String,
    /** Set only when a colleague is marking attendance for someone else. */
    @SerialName("target_employee_id") val targetEmployeeId: String? = null,
    /** "IN" (default) or "OUT". */
    @SerialName("event_type") val eventType: String = "IN",
    /** "HALF_DAY" or null — only meaningful on an "OUT". */
    @SerialName("leave_type") val leaveType: String? = null,
    /** Blink-challenge outcome, or null if no liveness check ran. */
    @SerialName("liveness_verified") val livenessVerified: Boolean? = null,
)

@Serializable
data class SyncRecordRequest(
    @SerialName("offline_attendance_id") val offlineAttendanceId: String,
    @SerialName("captured_at") val capturedAt: String,
    @SerialName("gps_lat") val gpsLat: Double,
    @SerialName("gps_lng") val gpsLng: Double,
    @SerialName("gps_accuracy_m") val gpsAccuracyM: Float? = null,
    @SerialName("mock_location_reported") val mockLocationReported: Boolean,
    @SerialName("root_risk_reported") val rootRiskReported: Boolean,
    @SerialName("developer_options_reported") val developerOptionsReported: Boolean,
    @SerialName("photo_url") val photoUrl: String? = null,
    @SerialName("device_id") val deviceId: String,
    @SerialName("app_version") val appVersion: String,
    /** Set only when a colleague is marking attendance for someone else. */
    @SerialName("target_employee_id") val targetEmployeeId: String? = null,
    /** "IN" (default) or "OUT". */
    @SerialName("event_type") val eventType: String = "IN",
    /** "HALF_DAY" or null — only meaningful on an "OUT". */
    @SerialName("leave_type") val leaveType: String? = null,
    /** Blink-challenge outcome, or null if no liveness check ran. */
    @SerialName("liveness_verified") val livenessVerified: Boolean? = null,
)

@Serializable
data class SyncRequest(val records: List<SyncRecordRequest>)

@Serializable
data class AttendanceRecordDto(
    val id: String? = null,
    @SerialName("offline_attendance_id") val offlineAttendanceId: String,
    @SerialName("employee_id") val employeeId: String? = null,
    @SerialName("captured_at") val capturedAt: String? = null,
    @SerialName("verification_mode") val verificationMode: String? = null,
    @SerialName("verification_status") val verificationStatus: String? = null,
    @SerialName("sync_status") val syncStatus: String? = null,
    @SerialName("verified_at") val verifiedAt: String? = null,
    @SerialName("rejection_reason") val rejectionReason: String? = null,
)

@Serializable
data class VerifyResponse(
    val success: Boolean = false,
    val record: AttendanceRecordDto? = null,
    @SerialName("verification_status") val verificationStatus: String? = null,
    val reasons: List<String> = emptyList(),
    val error: String? = null,
)

@Serializable
data class SyncResultDto(
    @SerialName("offline_attendance_id") val offlineAttendanceId: String,
    val record: AttendanceRecordDto? = null,
    val error: String? = null,
    @SerialName("already_processed") val alreadyProcessed: Boolean = false,
)

@Serializable
data class SyncResponse(
    val success: Boolean = false,
    val results: List<SyncResultDto> = emptyList(),
    val error: String? = null,
)

@Serializable
data class ApiErrorResponse(val error: String? = null)

@Serializable
data class RemoteAttendanceItemDto(
    val id: String? = null,
    @SerialName("offline_attendance_id") val offlineAttendanceId: String? = null,
    @SerialName("employee_id") val employeeId: String? = null,
    @SerialName("attendance_date") val attendanceDate: String? = null,
    @SerialName("captured_at") val capturedAt: String? = null,
    @SerialName("verified_at") val verifiedAt: String? = null,
    @SerialName("verification_mode") val verificationMode: String? = null,
    @SerialName("verification_status") val verificationStatus: String? = null,
    @SerialName("sync_status") val syncStatus: String? = null,
    @SerialName("photo_url") val photoUrl: String? = null,
    @SerialName("rejection_reason") val rejectionReason: String? = null,
    @SerialName("gps_lat") val gpsLat: Double? = null,
    @SerialName("gps_lng") val gpsLng: Double? = null,
    @SerialName("gps_accuracy_m") val gpsAccuracyM: Float? = null,
    @SerialName("event_type") val eventType: String? = "IN",
    @SerialName("leave_type") val leaveType: String? = null,
    @SerialName("liveness_verified") val livenessVerified: Boolean? = null,
    /** scope=marked_by_me only: the colleague this punch was made for. */
    @SerialName("employee_name") val employeeName: String? = null,
    @SerialName("employee_photo_url") val employeePhotoUrl: String? = null,
    @SerialName("employee_email") val employeeEmail: String? = null,
    @SerialName("employee_phone") val employeePhone: String? = null,
    @SerialName("employee_role") val employeeRole: String? = null,
    /** "IN" while that colleague is still checked in today (by anyone); "OUT" once checked out. */
    @SerialName("employee_last_event_type") val employeeLastEventType: String? = null,
    @SerialName("employee_last_out_at") val employeeLastOutAt: String? = null,
    /** Default scope only: set when someone else made this punch for the signed-in user. */
    @SerialName("marked_by_name") val markedByName: String? = null,
)

@Serializable
data class StaffAttendanceHistoryResponse(
    val success: Boolean = false,
    val records: List<RemoteAttendanceItemDto> = emptyList(),
    val count: Int = 0,
    val error: String? = null,
)

@Serializable
data class ColleagueDto(
    val id: String,
    @SerialName("full_name") val fullName: String,
    val email: String? = null,
    @SerialName("role_key") val roleKey: String? = null,
    @SerialName("photo_url") val photoUrl: String? = null,
)

@Serializable
data class ColleaguesResponse(
    val colleagues: List<ColleagueDto> = emptyList(),
)
