package com.saaserp.attendance.location

import android.annotation.SuppressLint
import android.content.Context
import android.location.Location
import android.os.Build
import android.provider.Settings
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

data class LocationCapture(
    val lat: Double,
    val lng: Double,
    val accuracyM: Float,
    /**
     * The device's own claim about mock-location usage — UNTRUSTED input,
     * same as everywhere else in this system. A `false` here is NOT proof
     * the location is genuine; it's one signal among several the server
     * re-evaluates. See ATTENDANCE_PLAN.md.
     */
    val mockLocationReported: Boolean,
)

class LocationHelper(private val context: Context) {

    @SuppressLint("MissingPermission") // caller is responsible for the runtime permission prompt
    suspend fun getCurrentLocation(): LocationCapture = suspendCancellableCoroutine { cont ->
        val client = LocationServices.getFusedLocationProviderClient(context)
        val cancellationTokenSource = com.google.android.gms.tasks.CancellationTokenSource()

        cont.invokeOnCancellation { cancellationTokenSource.cancel() }

        client.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, cancellationTokenSource.token)
            .addOnSuccessListener { location: Location? ->
                if (location == null) {
                    cont.resumeWithException(IllegalStateException("Location unavailable — ensure GPS is enabled"))
                    return@addOnSuccessListener
                }
                cont.resume(
                    LocationCapture(
                        lat = location.latitude,
                        lng = location.longitude,
                        accuracyM = location.accuracy,
                        mockLocationReported = isMockLocation(location),
                    )
                )
            }
            .addOnFailureListener { e -> cont.resumeWithException(e) }
    }

    private fun isMockLocation(location: Location): Boolean {
        val fromFusedProvider = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            location.isMock
        } else {
            @Suppress("DEPRECATION")
            location.isFromMockProvider
        }

        // A second, independent signal: the system-wide "Allow mock
        // locations" developer setting. Neither check alone is conclusive —
        // that's why both feed into the same untrusted
        // `mockLocationReported` flag rather than being treated as proof.
        val mockLocationAppSetting = try {
            Settings.Secure.getInt(context.contentResolver, Settings.Secure.ALLOW_MOCK_LOCATION, 0) != 0
        } catch (e: Exception) {
            false
        }

        return fromFusedProvider || mockLocationAppSetting
    }
}
