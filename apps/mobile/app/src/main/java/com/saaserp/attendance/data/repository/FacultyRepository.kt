package com.saaserp.attendance.data.repository

import android.util.Log
import com.saaserp.attendance.BuildConfig
import com.saaserp.attendance.data.auth.AuthRepository
import com.saaserp.attendance.data.auth.SessionEvents
import com.saaserp.attendance.data.remote.StaffApi
import com.saaserp.attendance.data.remote.StaffDto
import com.saaserp.attendance.data.remote.UpdateStaffRequestDto
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.asRequestBody
import org.json.JSONObject
import java.io.File

sealed class ProfileResult<out T> {
    data class Success<T>(val data: T) : ProfileResult<T>()
    data class Error(val message: String) : ProfileResult<Nothing>()
}

class StaffRepository(
    private val staffApi: StaffApi,
    private val authRepository: AuthRepository,
    private val okHttpClient: OkHttpClient,
) {
    @Volatile private var cachedStaff: StaffDto? = null

    fun getCachedStaff(): StaffDto? = cachedStaff

    suspend fun getMyProfile(forceRefresh: Boolean = false): ProfileResult<StaffDto> = withContext(Dispatchers.IO) {
        if (!forceRefresh && cachedStaff != null) {
            return@withContext ProfileResult.Success(cachedStaff!!)
        }

        val token = authRepository.currentAccessToken()
            ?: return@withContext ProfileResult.Error("Not signed in")

        try {
            val response = staffApi.getMyProfile("Bearer $token")
            if (response.isSuccessful && response.body()?.staff != null) {
                val f = response.body()!!.staff!!
                cachedStaff = f
                authRepository.updateEmployeeName(f.name)
                authRepository.updateEmployeePhoto(f.photo_url)
                ProfileResult.Success(f)
            } else {
                if (response.code() == 401) SessionEvents.notifyExpired()
                val errorMsg = response.body()?.error ?: "Failed to load staff profile (${response.code()})"
                ProfileResult.Error(errorMsg)
            }
        } catch (e: kotlinx.coroutines.CancellationException) {
            throw e
        } catch (e: Exception) {
            Log.e(TAG, "Failed to get staff profile: ${e.message}", e)
            ProfileResult.Error(e.message ?: "Network error loading profile")
        }
    }

    suspend fun updateMyProfile(request: UpdateStaffRequestDto): ProfileResult<StaffDto> = withContext(Dispatchers.IO) {
        val token = authRepository.currentAccessToken()
            ?: return@withContext ProfileResult.Error("Not signed in")

        try {
            val response = staffApi.updateMyProfile("Bearer $token", request)
            if (response.isSuccessful && response.body()?.staff != null) {
                val updated = response.body()!!.staff!!
                cachedStaff = updated
                authRepository.updateEmployeeName(updated.name)
                authRepository.updateEmployeePhoto(updated.photo_url)
                ProfileResult.Success(updated)
            } else {
                if (response.code() == 401) SessionEvents.notifyExpired()
                val errorMsg = response.body()?.error ?: "Failed to update profile (${response.code()})"
                ProfileResult.Error(errorMsg)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to update profile: ${e.message}", e)
            ProfileResult.Error(e.message ?: "Network error updating profile")
        }
    }

    suspend fun uploadPortrait(localFilePath: String): ProfileResult<String> = withContext(Dispatchers.IO) {
        val token = authRepository.currentAccessToken()
            ?: return@withContext ProfileResult.Error("Not signed in")

        val file = File(localFilePath)
        if (!file.exists()) {
            return@withContext ProfileResult.Error("Selected photo file not found")
        }

        val url = try {
            BuildConfig.API_BASE_URL.toHttpUrl().resolve("api/staff/photo")
                ?: throw IllegalStateException("Could not build staff photo URL")
        } catch (e: Exception) {
            return@withContext ProfileResult.Error("Invalid API base URL configuration")
        }

        val mediaType = when {
            localFilePath.endsWith(".png", ignoreCase = true) -> "image/png"
            localFilePath.endsWith(".webp", ignoreCase = true) -> "image/webp"
            else -> "image/jpeg"
        }.toMediaType()

        fun buildRequest(t: String) = Request.Builder()
            .url(url)
            .header("Authorization", "Bearer $t")
            .post(file.asRequestBody(mediaType))
            .build()

        try {
            var response = okHttpClient.newCall(buildRequest(token)).execute()

            // This call uses the plain OkHttpClient, not the authenticated
            // Retrofit client's AuthAuthenticator — without this, a token
            // that went stale during however long it took to pick/crop a
            // photo fails outright and forces a real logout for what's
            // actually just a refreshable session.
            if (response.code == 401) {
                response.close()
                val refreshed = authRepository.refreshAccessToken()
                if (refreshed == null) {
                    SessionEvents.notifyExpired()
                    return@withContext ProfileResult.Error("Session expired — please log in again")
                }
                response = okHttpClient.newCall(buildRequest(refreshed)).execute()
            }

            response.use { res ->
                val bodyString = res.body?.string()
                if (!res.isSuccessful) {
                    if (res.code == 401) SessionEvents.notifyExpired()
                    val errMsg = try {
                        JSONObject(bodyString ?: "{}").optString("error", "Upload failed (${res.code})")
                    } catch (_: Exception) {
                        "Upload failed (${res.code})"
                    }
                    return@withContext ProfileResult.Error(errMsg)
                }

                val photoUrl = JSONObject(bodyString ?: "{}").optString("photo_url").ifBlank { null }
                if (photoUrl == null) {
                    ProfileResult.Error("Photo uploaded but URL missing in server response")
                } else {
                    ProfileResult.Success(photoUrl)
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to upload portrait photo: ${e.message}", e)
            ProfileResult.Error(e.message ?: "Network error uploading photo")
        }
    }

    private companion object {
        const val TAG = "StaffRepository"
    }
}
