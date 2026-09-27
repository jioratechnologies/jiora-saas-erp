package com.saaserp.attendance.data.remote

import kotlinx.serialization.Serializable
import retrofit2.Response
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.Query

@Serializable
data class AdminMarkedByProfileDto(
    val full_name: String? = null,
)

@Serializable
data class AdminAttendanceEventDto(
    val id: String? = null,
    val captured_at: String = "",
    val verified_at: String? = null,
    val event_type: String = "",
    val leave_type: String? = null,
    val verification_status: String = "PENDING_VERIFICATION",
    val verification_mode: String? = null,
    val marked_by: String? = null,
    val marked_by_profile: AdminMarkedByProfileDto? = null,
    val photo_url: String? = null,
    val gps_lat: Double? = null,
    val gps_lng: Double? = null,
    val gps_accuracy_m: Float? = null,
    val distance_from_campus_m: Double? = null,
    val rejection_reason: String? = null,
    val liveness_verified: Boolean? = null,
    val mock_location_reported: Boolean? = null,
    val root_risk_reported: Boolean? = null,
)

@Serializable
data class AdminAttendanceEmployeeDto(
    val id: String = "",
    val full_name: String = "",
    val email: String = "",
    val role_key: String = "",
    val photo_url: String? = null,
    val phone: String? = null,
)

@Serializable
data class AdminAttendanceRowDto(
    val employee: AdminAttendanceEmployeeDto = AdminAttendanceEmployeeDto(),
    val events: List<AdminAttendanceEventDto> = emptyList(),
    val status: String = "NOT_MARKED",
    val dayType: String = "NOT_MARKED",
)

@Serializable
data class AdminAttendanceSummaryDto(
    val total: Int = 0,
    val marked: Int = 0,
    val notMarked: Int = 0,
    val verified: Int = 0,
    val flagged: Int = 0,
    val rejected: Int = 0,
    val pending: Int = 0,
    val inProgress: Int = 0,
    val halfDay: Int = 0,
    val earlyLeave: Int = 0,
)

@Serializable
data class AdminAttendanceResponseDto(
    val date: String = "",
    val canViewRoster: Boolean = false,
    val rows: List<AdminAttendanceRowDto> = emptyList(),
    val summary: AdminAttendanceSummaryDto? = null,
    val error: String? = null,
)

interface AdminAttendanceApi {
    @GET("api/admin/attendance")
    suspend fun getAttendance(
        @Header("Authorization") bearer: String,
        @Query("date") date: String,
        /** 1 = only report canViewRoster (cheap); the server skips building the roster. */
        @Query("probe") probe: Int? = null,
    ): Response<AdminAttendanceResponseDto>
}
