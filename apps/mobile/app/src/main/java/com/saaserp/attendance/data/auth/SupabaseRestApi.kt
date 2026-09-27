package com.saaserp.attendance.data.auth

import kotlinx.serialization.Serializable
import retrofit2.Response
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.Query

/** Direct PostgREST call to fetch the signed-in employee's own profile row
 *  (allowed by the "Users read own profile" RLS policy on public.profiles). */
interface SupabaseRestApi {
    @GET("rest/v1/profiles")
    suspend fun getOwnProfile(
        @Header("apikey") apikey: String,
        @Header("Authorization") bearer: String,
        @Query("id") idFilter: String,
        @Query("select") select: String = "id,full_name,email,role_key,is_active,avatar_url,must_change_password,roles(has_attendance_access)",
    ): Response<List<ProfileDto>>
}

@Serializable
data class ProfileDto(
    val id: String,
    val full_name: String,
    val email: String,
    val role_key: String,
    val is_active: Boolean = true,
    val avatar_url: String? = null,
    val must_change_password: Boolean = false,
    val roles: RoleAccessDto? = null,
)

/** Embedded via the profiles.role_key -> roles.key FK — which roles may sign into this app is admin-editable (Roles & Permissions matrix), not hardcoded here. */
@Serializable
data class RoleAccessDto(
    val has_attendance_access: Boolean = false,
)
