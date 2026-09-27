package com.saaserp.attendance.data.auth

import org.json.JSONObject

/**
 * A password-reset request this device made, kept locally so the login
 * screen can show its status and a notification can fire when the admin
 * decides. [token] is the secret that lets this device (only) read the
 * request's status from the server.
 */
data class ResetRequest(
    val id: String,
    val token: String,
    val identifier: String,
    /** "pending" | "approved" | "rejected" */
    val status: String,
    val rejectReason: String? = null,
    /** True once the approved/rejected notification has been shown, so it fires only once. */
    val notified: Boolean = false,
) {
    fun toJson(): String = JSONObject()
        .put("id", id).put("token", token).put("identifier", identifier)
        .put("status", status).put("rejectReason", rejectReason).put("notified", notified)
        .toString()

    companion object {
        fun fromJson(json: String?): ResetRequest? = try {
            if (json == null) null else JSONObject(json).let {
                ResetRequest(
                    id = it.getString("id"),
                    token = it.getString("token"),
                    identifier = it.optString("identifier"),
                    status = it.optString("status", "pending"),
                    rejectReason = it.optString("rejectReason", "").ifBlank { null },
                    notified = it.optBoolean("notified", false),
                )
            }
        } catch (_: Exception) {
            null
        }
    }
}

sealed class ResetRequestResult {
    data class Sent(val request: ResetRequest) : ResetRequestResult()
    /** No active account for that email/phone — nothing was sent to the admin. */
    data class NotFound(val message: String) : ResetRequestResult()
    data class Error(val message: String) : ResetRequestResult()
}
