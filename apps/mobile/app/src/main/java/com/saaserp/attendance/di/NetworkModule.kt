package com.saaserp.attendance.di

import com.saaserp.attendance.BuildConfig
import com.saaserp.attendance.data.auth.AuthRepository
import com.saaserp.attendance.data.auth.SecureTokenStore
import com.saaserp.attendance.data.auth.SupabaseAuthApi
import com.saaserp.attendance.data.auth.SupabaseRestApi
import com.saaserp.attendance.data.remote.AttendanceApi
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import okhttp3.Authenticator
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.Route
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import com.jakewharton.retrofit2.converter.kotlinx.serialization.asConverterFactory

/**
 * Manual, framework-free DI (no Hilt) to keep the build surface small and
 * easy to reason about without a compiler in the loop verifying it.
 */
object NetworkModule {

    private val json = Json { ignoreUnknownKeys = true; explicitNulls = false }
    private val jsonMediaType = "application/json".toMediaType()

    fun provideSupabaseAuthApi(): SupabaseAuthApi =
        Retrofit.Builder()
            .baseUrl(BuildConfig.SUPABASE_URL)
            .client(baseOkHttpClient())
            .addConverterFactory(json.asConverterFactory(jsonMediaType))
            .build()
            .create(SupabaseAuthApi::class.java)

    fun provideSupabaseRestApi(): SupabaseRestApi =
        Retrofit.Builder()
            .baseUrl(BuildConfig.SUPABASE_URL)
            .client(baseOkHttpClient())
            .addConverterFactory(json.asConverterFactory(jsonMediaType))
            .build()
            .create(SupabaseRestApi::class.java)

    /**
     * The attendance API client — every request carries the employee's
     * bearer token, and a 401 triggers exactly one silent refresh-and-retry
     * before giving up (handled by [AuthAuthenticator]) so a stale token
     * mid-sync doesn't just fail the whole batch outright.
     */
    fun provideAttendanceApi(tokenStore: SecureTokenStore, authRepository: AuthRepository): AttendanceApi {
        val client = baseOkHttpClient().newBuilder()
            .addInterceptor { chain ->
                val token = tokenStore.accessToken
                val request = if (token != null) {
                    chain.request().newBuilder().header("Authorization", "Bearer $token").build()
                } else {
                    chain.request()
                }
                chain.proceed(request)
            }
            .authenticator(AuthAuthenticator(authRepository))
            .build()

        return Retrofit.Builder()
            .baseUrl(BuildConfig.API_BASE_URL)
            .client(client)
            .addConverterFactory(json.asConverterFactory(jsonMediaType))
            .build()
            .create(AttendanceApi::class.java)
    }

    fun provideStaffApi(tokenStore: SecureTokenStore, authRepository: AuthRepository): com.saaserp.attendance.data.remote.StaffApi {
        val client = baseOkHttpClient().newBuilder()
            .addInterceptor { chain ->
                val token = tokenStore.accessToken
                val request = if (token != null) {
                    chain.request().newBuilder().header("Authorization", "Bearer $token").build()
                } else {
                    chain.request()
                }
                chain.proceed(request)
            }
            .authenticator(AuthAuthenticator(authRepository))
            .build()

        return Retrofit.Builder()
            .baseUrl(BuildConfig.API_BASE_URL)
            .client(client)
            .addConverterFactory(json.asConverterFactory(jsonMediaType))
            .build()
            .create(com.saaserp.attendance.data.remote.StaffApi::class.java)
    }

    fun provideAdminAttendanceApi(tokenStore: SecureTokenStore, authRepository: AuthRepository): com.saaserp.attendance.data.remote.AdminAttendanceApi {
        val client = baseOkHttpClient().newBuilder()
            // A cold server building a full roster can exceed OkHttp's 10s default, which read as "no roster access".
            .connectTimeout(20, java.util.concurrent.TimeUnit.SECONDS)
            .readTimeout(60, java.util.concurrent.TimeUnit.SECONDS)
            .addInterceptor { chain ->
                val token = tokenStore.accessToken
                val request = if (token != null) {
                    chain.request().newBuilder().header("Authorization", "Bearer $token").build()
                } else {
                    chain.request()
                }
                chain.proceed(request)
            }
            .authenticator(AuthAuthenticator(authRepository))
            .build()

        return Retrofit.Builder()
            .baseUrl(BuildConfig.API_BASE_URL)
            .client(client)
            .addConverterFactory(json.asConverterFactory(jsonMediaType))
            .build()
            .create(com.saaserp.attendance.data.remote.AdminAttendanceApi::class.java)
    }

    private val baseClient by lazy {
        val builder = OkHttpClient.Builder()
        if (BuildConfig.ATTENDANCE_MODE == "dev") {
            builder.addInterceptor(HttpLoggingInterceptor().apply { level = HttpLoggingInterceptor.Level.BODY })
        }
        builder.build()
    }

    fun sharedOkHttpClient(): OkHttpClient = baseClient

    private fun baseOkHttpClient(): OkHttpClient = baseClient

    /** Refreshes the Supabase session exactly once per 401, then retries the original request. */
    private class AuthAuthenticator(private val authRepository: AuthRepository) : Authenticator {
        override fun authenticate(route: Route?, response: Response): Request? {
            if (response.request.header("Authorization-Retried") != null) {
                return null // already retried once — give up, caller must re-prompt login
            }
            val newToken = runBlocking { authRepository.refreshAccessToken() } ?: return null
            return response.request.newBuilder()
                .header("Authorization", "Bearer $newToken")
                .header("Authorization-Retried", "true")
                .build()
        }
    }
}
