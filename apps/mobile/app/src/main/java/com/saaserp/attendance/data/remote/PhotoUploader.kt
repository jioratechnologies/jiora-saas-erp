package com.saaserp.attendance.data.remote

import android.util.Log
import com.saaserp.attendance.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.asRequestBody
import org.json.JSONObject
import java.io.File

/**
 * Uploads a captured attendance photo via OUR OWN server
 * (/api/attendance/photo), which then writes it to Supabase Storage using
 * the service role — NOT a direct client → Supabase Storage PUT.
 *
 * Why not upload straight to Storage: this project's Storage service does
 * not propagate the caller's JWT claims the same way plain PostgREST
 * does — a token that correctly resolves auth.uid() for every other
 * Supabase call still fails Storage's own RLS with "new row violates row
 * level security policy" (verified directly against the Storage API,
 * independent of this app — a platform quirk, not something fixable from
 * policy SQL). Routing through our server, which already independently
 * verifies every attendance request via verifyBearerToken() server-side,
 * sidesteps that instead of depending on it.
 *
 * Returns the storage PATH (not a public URL) — the `attendance-photos`
 * bucket is private, and the admin panel resolves this path to a
 * short-lived signed URL server-side.
 */
class PhotoUploader(private val client: OkHttpClient) {

    /**
     * [onTokenExpired] refreshes the session and returns the new access
     * token, or null if the session is dead. This client has no
     * OkHttp Authenticator of its own (unlike the attendance/staff
     * Retrofit clients), so without this callback an access token that
     * expired between login and the moment a photo finishes compressing
     * fails outright as a 401 instead of silently refreshing — that gap is
     * exactly what showed up as "image not uploaded" with the server
     * reporting a missing/invalid bearer token.
     */
    suspend fun upload(
        localPath: String,
        employeeId: String,
        accessToken: String,
        onTokenExpired: (suspend () -> String?)? = null,
        /** Set only when a colleague is marking attendance for someone else — the server independently re-validates this before using it. */
        targetEmployeeId: String? = null,
    ): String? =
        withContext(Dispatchers.IO) {
            try {
                val file = File(localPath)
                if (!file.exists()) return@withContext null

                val baseUrl = BuildConfig.API_BASE_URL.toHttpUrl().resolve("api/attendance/photo")
                    ?: return@withContext null
                val url = if (targetEmployeeId != null) {
                    baseUrl.newBuilder().addQueryParameter("target_employee_id", targetEmployeeId).build()
                } else {
                    baseUrl
                }

                fun buildRequest(token: String) = Request.Builder()
                    .url(url)
                    .header("Authorization", "Bearer $token")
                    .post(file.asRequestBody("image/webp".toMediaType()))
                    .build()

                var response = client.newCall(buildRequest(accessToken)).execute()

                if (response.code == 401 && onTokenExpired != null) {
                    response.close()
                    val refreshed = onTokenExpired()
                    response = if (refreshed != null) {
                        client.newCall(buildRequest(refreshed)).execute()
                    } else {
                        return@withContext null
                    }
                }

                response.use { res ->
                    val bodyString = res.body?.string()
                    if (!res.isSuccessful) {
                        Log.e(TAG, "Photo upload failed: HTTP ${res.code} $bodyString")
                        return@withContext null
                    }
                    val path = JSONObject(bodyString ?: "{}").optString("path").ifBlank { null }
                    if (path == null) {
                        Log.e(TAG, "Photo upload returned 200 but no usable path in body: $bodyString")
                    } else {
                        Log.d(TAG, "Photo upload succeeded: $path")
                    }
                    path
                }
            } catch (e: kotlinx.coroutines.CancellationException) {
                throw e
            } catch (e: Exception) {
                Log.e(TAG, "Photo upload failed: ${e.javaClass.simpleName}: ${e.message}", e)
                null
            }
        }

    private companion object {
        const val TAG = "PhotoUploader"
    }
}
