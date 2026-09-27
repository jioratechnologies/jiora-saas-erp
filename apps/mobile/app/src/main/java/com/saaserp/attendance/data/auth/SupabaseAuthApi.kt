package com.saaserp.attendance.data.auth

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.Header
import retrofit2.http.POST
import retrofit2.http.Query

/**
 * Talks directly to Supabase Auth's GoTrue REST API — the same project the
 * SaaS ERP website uses. Employees sign in with the email/password an admin set
 * for them via the website's Users admin (see /admin/users).
 */
interface SupabaseAuthApi {

    @POST("auth/v1/token")
    suspend fun passwordGrant(
        @Query("grant_type") grantType: String = "password",
        @Header("apikey") apikey: String,
        @Body body: PasswordGrantRequest,
    ): Response<SupabaseTokenResponse>

    @POST("auth/v1/token")
    suspend fun refreshGrant(
        @Query("grant_type") grantType: String = "refresh_token",
        @Header("apikey") apikey: String,
        @Body body: RefreshGrantRequest,
    ): Response<SupabaseTokenResponse>
}

@Serializable
data class PasswordGrantRequest(val email: String, val password: String)

@Serializable
data class RefreshGrantRequest(@SerialName("refresh_token") val refreshToken: String)

@Serializable
data class SupabaseTokenResponse(
    @SerialName("access_token") val accessToken: String? = null,
    @SerialName("refresh_token") val refreshToken: String? = null,
    @SerialName("expires_in") val expiresIn: Int? = null,
    val user: SupabaseUser? = null,
    val error: String? = null,
    @SerialName("error_description") val errorDescription: String? = null,
    val msg: String? = null,
)

@Serializable
data class SupabaseUser(
    val id: String,
    val email: String? = null,
)
