package com.saaserp.attendance.data.remote

import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.POST

interface AttendanceApi {

    @POST("api/attendance/challenge")
    suspend fun requestChallenge(): Response<ChallengeResponse>

    @POST("api/attendance/verify")
    suspend fun verify(@Body body: VerifyRequest): Response<VerifyResponse>

    @POST("api/attendance/sync")
    suspend fun sync(@Body body: SyncRequest): Response<SyncResponse>

    /** Dev/testing only — server refuses this outside a non-production environment. Wipes today's server-side record so repeated check-ins can be tested without waiting a day. */
    @POST("api/attendance/dev-reset")
    suspend fun devResetToday(): Response<Unit>

    /** Self-service "discard & retake" — server restricts this to the 1st of the month. */
    @POST("api/attendance/discard")
    suspend fun discardToday(): Response<ApiErrorResponse>

    @retrofit2.http.GET("api/attendance/colleagues")
    suspend fun getColleagues(@retrofit2.http.Query("mode") mode: String = "IN"): Response<ColleaguesResponse>

    @retrofit2.http.GET("api/staff/attendance/history")
    suspend fun getStaffHistory(
        @retrofit2.http.Header("Authorization") authorization: String,
        @retrofit2.http.Query("from") from: String? = null,
        @retrofit2.http.Query("to") to: String? = null,
        @retrofit2.http.Query("status") status: String? = null,
        /** "marked_by_me" = punches this user made for colleagues; null = the user's own history. */
        @retrofit2.http.Query("scope") scope: String? = null,
    ): Response<StaffAttendanceHistoryResponse>
}
