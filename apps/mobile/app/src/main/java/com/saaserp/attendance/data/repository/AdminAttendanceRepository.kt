package com.saaserp.attendance.data.repository

import android.content.Context
import android.util.Log
import com.saaserp.attendance.BuildConfig
import com.saaserp.attendance.data.auth.AuthRepository
import com.saaserp.attendance.data.auth.SessionEvents
import com.saaserp.attendance.data.remote.AdminAttendanceApi
import com.saaserp.attendance.data.remote.AdminAttendanceResponseDto
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.io.File

sealed class AdminAttendanceResult<out T> {
    data class Success<T>(val data: T) : AdminAttendanceResult<T>()
    data class Error(val message: String) : AdminAttendanceResult<Nothing>()
}

/**
 * Reuses the same /api/admin/attendance and /api/admin/attendance/export
 * endpoints the web admin panel uses — no separate mobile-only API surface,
 * so an admin's roster/export view is always identical to the web one, and
 * a role's "can view roster" permission (RBAC-configurable, not a hardcoded
 * role list) is honored exactly once, server-side, for both clients.
 */
class AdminAttendanceRepository(
    private val api: AdminAttendanceApi,
    private val authRepository: AuthRepository,
    private val okHttpClient: OkHttpClient,
) {
    /**
     * Cheap "does this account have roster access" check for the tab
     * visibility decision. Returns null on any failure so callers keep
     * whatever was last known instead of hiding the tab.
     */
    suspend fun probeRosterAccess(): Boolean? = withContext(Dispatchers.IO) {
        val token = authRepository.currentAccessToken() ?: return@withContext null
        try {
            val response = api.getAttendance("Bearer $token", "", probe = 1)
            if (response.isSuccessful) response.body()?.canViewRoster else null
        } catch (e: kotlinx.coroutines.CancellationException) {
            throw e
        } catch (e: Exception) {
            Log.w(TAG, "probeRosterAccess failed: ${e.message}")
            null
        }
    }

    /** Last successful roster for [date] in this process, or null — lets the screen paint instantly while a fresh copy loads. */
    fun cachedRoster(date: String): AdminAttendanceResponseDto? = rosterCache[date]

    suspend fun getRoster(date: String): AdminAttendanceResult<AdminAttendanceResponseDto> = withContext(Dispatchers.IO) {
        val token = authRepository.currentAccessToken()
            ?: return@withContext AdminAttendanceResult.Error("Not signed in")

        try {
            val response = api.getAttendance("Bearer $token", date)
            val body = response.body()
            if (response.isSuccessful && body != null) {
                rosterCache[date] = body
                AdminAttendanceResult.Success(body)
            } else {
                // Deliberately does NOT call SessionEvents.notifyExpired() on
                // a 401 here, unlike the other repositories — this call also
                // runs silently at every app launch (CheckInViewModel.init)
                // purely to decide whether to show the roster tab. The OkHttp
                // Authenticator already retried the token once before this
                // response ever reaches here; forcing a full logout over a
                // background UI-visibility probe was kicking employees back
                // to the login screen right after a normal sign-in whenever
                // this request raced the very first requests after login.
                // A failed check here should only ever mean "hide the tab."
                AdminAttendanceResult.Error(body?.error ?: "Failed to load attendance (${response.code()})")
            }
        } catch (e: kotlinx.coroutines.CancellationException) {
            throw e
        } catch (e: Exception) {
            Log.e(TAG, "Failed to load roster: ${e.message}", e)
            AdminAttendanceResult.Error(e.message ?: "Network error loading attendance")
        }
    }

    /**
     * Downloads the CSV/XLSX/PDF export to app cache and returns the file —
     * the caller hands that off to a share/"open with" intent, since a
     * phone has no fixed download folder a organization office would look in.
     */
    suspend fun exportFile(
        context: Context,
        from: String,
        to: String,
        format: String,
        employeeId: String? = null,
    ): AdminAttendanceResult<File> = withContext(Dispatchers.IO) {
        val token = authRepository.currentAccessToken()
            ?: return@withContext AdminAttendanceResult.Error("Not signed in")

        val urlBuilder = StringBuilder("api/admin/attendance/export?from=$from&to=$to&format=$format")
        if (!employeeId.isNullOrBlank()) urlBuilder.append("&employeeId=$employeeId")

        val url = try {
            BuildConfig.API_BASE_URL.toHttpUrl().resolve(urlBuilder.toString())
                ?: throw IllegalStateException("Could not build export URL")
        } catch (e: Exception) {
            return@withContext AdminAttendanceResult.Error("Invalid API base URL configuration")
        }

        fun buildRequest(t: String) = Request.Builder()
            .url(url)
            .header("Authorization", "Bearer $t")
            .get()
            .build()

        try {
            var response = okHttpClient.newCall(buildRequest(token)).execute()

            if (response.code == 401) {
                response.close()
                val refreshed = authRepository.refreshAccessToken()
                if (refreshed == null) {
                    SessionEvents.notifyExpired()
                    return@withContext AdminAttendanceResult.Error("Session expired — please log in again")
                }
                response = okHttpClient.newCall(buildRequest(refreshed)).execute()
            }

            response.use { res ->
                if (!res.isSuccessful) {
                    if (res.code == 401) SessionEvents.notifyExpired()
                    val errMsg = try {
                        JSONObject(res.body?.string() ?: "{}").optString("error", "Export failed (${res.code})")
                    } catch (_: Exception) {
                        "Export failed (${res.code})"
                    }
                    return@withContext AdminAttendanceResult.Error(errMsg)
                }

                val disposition = res.header("Content-Disposition")
                val filename = disposition
                    ?.substringAfter("filename=\"", "")
                    ?.substringBefore("\"")
                    ?.ifBlank { null }
                    ?: "attendance_export_${System.currentTimeMillis()}.$format"

                val exportDir = File(context.cacheDir, "exports").apply { mkdirs() }
                val outFile = File(exportDir, filename)
                res.body?.byteStream()?.use { input ->
                    outFile.outputStream().use { output -> input.copyTo(output) }
                } ?: return@withContext AdminAttendanceResult.Error("Empty export response")

                AdminAttendanceResult.Success(outFile)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to export attendance: ${e.message}", e)
            AdminAttendanceResult.Error(e.message ?: "Network error exporting attendance")
        }
    }

    private companion object {
        const val TAG = "AdminAttendanceRepo"

        // Process-wide (companion): survives the repository being re-created and the roster ViewModel being re-entered.
        val rosterCache = java.util.concurrent.ConcurrentHashMap<String, AdminAttendanceResponseDto>()
    }
}
