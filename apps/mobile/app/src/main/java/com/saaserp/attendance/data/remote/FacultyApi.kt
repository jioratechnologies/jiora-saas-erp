package com.saaserp.attendance.data.remote

import kotlinx.serialization.Serializable
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.PUT

@Serializable
data class StaffDto(
    val id: String? = null,
    val name: String = "",
    val designation: String = "",
    val department: String = "",
    val subject: String? = null,
    val qualification: String = "",
    val email: String? = null,
    val phone: String? = null,
    val national_code: String? = null,
    val date_of_joining: String? = null,
    val experience_years: Int? = null,
    val experience: String? = null,
    val bio: String? = null,
    val photo_url: String? = null,
    val address: String? = null,
    val published: Boolean = true,
)

@Serializable
data class StaffResponseDto(
    val success: Boolean = true,
    val staff: StaffDto? = null,
    val error: String? = null,
)

@Serializable
data class UpdateStaffRequestDto(
    val name: String,
    val designation: String,
    val department: String,
    val qualification: String,
    val subject: String? = null,
    val email: String? = null,
    val phone: String? = null,
    val national_code: String? = null,
    val date_of_joining: String? = null,
    val experience_years: Int? = null,
    val bio: String? = null,
    val photo_url: String? = null,
    val address: String? = null,
)

interface StaffApi {
    @GET("api/staff/me")
    suspend fun getMyProfile(
        @Header("Authorization") bearer: String,
    ): Response<StaffResponseDto>

    @PUT("api/staff/me")
    suspend fun updateMyProfile(
        @Header("Authorization") bearer: String,
        @Body body: UpdateStaffRequestDto,
    ): Response<StaffResponseDto>
}
