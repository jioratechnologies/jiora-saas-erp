package com.saaserp.attendance.location

import android.util.Log
import com.saaserp.attendance.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject

/** A campus location plus the radius enforced around it. */
data class CampusTarget(val lat: Double, val lng: Double, val radiusM: Int)

/** Result of comparing a device location against the admin-configured campus geofence. */
sealed class GeofenceCheck {
    /** Geofencing is off, or campus coordinates aren't set — nothing to enforce. */
    object NotEnforced : GeofenceCheck()
    data class Inside(val distanceM: Int) : GeofenceCheck()
    data class Outside(val distanceM: Int, val target: CampusTarget) : GeofenceCheck()
    /** Couldn't reach the server to fetch campus settings — fails open, same as the server's own "not configured" path, so a settings-fetch hiccup never locks out a legitimate check-in. */
    object Unknown : GeofenceCheck()
}

/**
 * Client-side mirror of the campus-geofence enforcement in
 * src/lib/attendance/validation.ts (`checkGeofence` / `decideVerificationStatus`)
 * — the server call there remains the authoritative decision (an
 * OFFLINE capture only learns it was out of range once /sync runs), but
 * checking here first means the camera never even opens for a capture
 * that's going to be rejected anyway.
 */
object CampusGeofence {
    private const val TAG = "CampusGeofence"
    private val client = OkHttpClient()

    suspend fun check(lat: Double, lng: Double): GeofenceCheck = withContext(Dispatchers.IO) {
        try {
            val url = BuildConfig.API_BASE_URL.toHttpUrl().resolve("api/settings") ?: return@withContext GeofenceCheck.Unknown
            val request = Request.Builder().url(url).get().build()

            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) return@withContext GeofenceCheck.Unknown
                val settings = JSONObject(response.body?.string() ?: "{}").optJSONObject("settings")
                    ?: return@withContext GeofenceCheck.Unknown

                val enabled = settings.optBoolean("attendance_geofence_enabled", false)
                if (!enabled || settings.isNull("attendance_campus_lat") || settings.isNull("attendance_campus_lng")) {
                    return@withContext GeofenceCheck.NotEnforced
                }

                val campusLat = settings.optDouble("attendance_campus_lat")
                val campusLng = settings.optDouble("attendance_campus_lng")
                val radiusM = if (settings.has("attendance_geofence_radius_m") && !settings.isNull("attendance_geofence_radius_m")) {
                    settings.optInt("attendance_geofence_radius_m", 200)
                } else {
                    200
                }

                val distanceM = distanceMeters(lat, lng, campusLat, campusLng).toInt()
                if (distanceM <= radiusM) {
                    GeofenceCheck.Inside(distanceM)
                } else {
                    GeofenceCheck.Outside(distanceM, CampusTarget(campusLat, campusLng, radiusM))
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Campus geofence check failed: ${e.javaClass.simpleName}: ${e.message}")
            GeofenceCheck.Unknown
        }
    }

    /** Live re-check against an already-known target — no network call, used while guiding a employee back onto campus. */
    fun distanceMeters(lat: Double, lng: Double, target: CampusTarget): Int =
        distanceMeters(lat, lng, target.lat, target.lng).toInt()

    /** Compass bearing in degrees (0=North, 90=East) from a device location to the campus target. */
    fun bearingDegrees(lat: Double, lng: Double, target: CampusTarget): Float {
        val lat1 = Math.toRadians(lat)
        val lat2 = Math.toRadians(target.lat)
        val dLng = Math.toRadians(target.lng - lng)
        val y = Math.sin(dLng) * Math.cos(lat2)
        val x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng)
        val bearing = Math.toDegrees(Math.atan2(y, x))
        return ((bearing + 360) % 360).toFloat()
    }

    /** Haversine distance in meters — same formula the server uses. */
    private fun distanceMeters(lat1: Double, lng1: Double, lat2: Double, lng2: Double): Double {
        val r = 6371000.0
        val dLat = Math.toRadians(lat2 - lat1)
        val dLng = Math.toRadians(lng2 - lng1)
        val a = Math.sin(dLat / 2).let { it * it } +
            Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) * Math.sin(dLng / 2).let { it * it }
        return 2 * r * Math.asin(Math.sqrt(a))
    }
}
