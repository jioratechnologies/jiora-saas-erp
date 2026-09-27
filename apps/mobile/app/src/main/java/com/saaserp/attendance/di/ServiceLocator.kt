package com.saaserp.attendance.di

import android.content.Context
import com.saaserp.attendance.data.auth.AuthRepository
import com.saaserp.attendance.data.auth.SecureTokenStore
import com.saaserp.attendance.data.local.AppDatabase
import com.saaserp.attendance.data.remote.PhotoUploader
import com.saaserp.attendance.data.repository.AttendanceRepository
import com.saaserp.attendance.location.LocationHelper
import okhttp3.OkHttpClient

/**
 * Deliberately simple manual DI (no Hilt/Dagger) — one object graph, built
 * lazily, safe to call repeatedly from anywhere including a WorkManager
 * worker that has no Activity/ViewModel scope to hang off of.
 */
object ServiceLocator {

    @Volatile private var tokenStore: SecureTokenStore? = null
    @Volatile private var authRepository: AuthRepository? = null
    @Volatile private var attendanceRepository: AttendanceRepository? = null
    @Volatile private var staffRepository: com.saaserp.attendance.data.repository.StaffRepository? = null
    @Volatile private var adminAttendanceRepository: com.saaserp.attendance.data.repository.AdminAttendanceRepository? = null

    fun tokenStore(context: Context): SecureTokenStore =
        tokenStore ?: synchronized(this) {
            tokenStore ?: SecureTokenStore(context.applicationContext).also { tokenStore = it }
        }

    fun authRepository(context: Context): AuthRepository =
        authRepository ?: synchronized(this) {
            authRepository ?: AuthRepository(
                authApi = NetworkModule.provideSupabaseAuthApi(),
                restApi = NetworkModule.provideSupabaseRestApi(),
                tokenStore = tokenStore(context),
                httpClient = NetworkModule.sharedOkHttpClient(),
            ).also { authRepository = it }
        }

    fun attendanceRepository(context: Context): AttendanceRepository =
        attendanceRepository ?: synchronized(this) {
            attendanceRepository ?: run {
                val auth = authRepository(context)
                AttendanceRepository(
                    dao = AppDatabase.getInstance(context).attendanceDao(),
                    api = NetworkModule.provideAttendanceApi(tokenStore(context), auth),
                    authRepository = auth,
                    photoUploader = PhotoUploader(NetworkModule.sharedOkHttpClient()),
                )
            }.also { attendanceRepository = it }
        }

    fun staffRepository(context: Context): com.saaserp.attendance.data.repository.StaffRepository =
        staffRepository ?: synchronized(this) {
            staffRepository ?: run {
                val auth = authRepository(context)
                com.saaserp.attendance.data.repository.StaffRepository(
                    staffApi = NetworkModule.provideStaffApi(tokenStore(context), auth),
                    authRepository = auth,
                    okHttpClient = NetworkModule.sharedOkHttpClient(),
                )
            }.also { staffRepository = it }
        }

    fun adminAttendanceRepository(context: Context): com.saaserp.attendance.data.repository.AdminAttendanceRepository =
        adminAttendanceRepository ?: synchronized(this) {
            adminAttendanceRepository ?: run {
                val auth = authRepository(context)
                com.saaserp.attendance.data.repository.AdminAttendanceRepository(
                    api = NetworkModule.provideAdminAttendanceApi(tokenStore(context), auth),
                    authRepository = auth,
                    okHttpClient = OkHttpClient.Builder()
                        // Export files are generated server-side (PDF/XLSX for a month of staff) — the 10s OkHttp default read timeout can cut them off.
                        .connectTimeout(20, java.util.concurrent.TimeUnit.SECONDS)
                        .readTimeout(90, java.util.concurrent.TimeUnit.SECONDS)
                        .build(),
                )
            }.also { adminAttendanceRepository = it }
        }

    fun locationHelper(context: Context): LocationHelper = LocationHelper(context.applicationContext)
}
