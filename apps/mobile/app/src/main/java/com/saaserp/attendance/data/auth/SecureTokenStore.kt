package com.saaserp.attendance.data.auth

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

/**
 * Keystore-backed storage for the employee's Supabase session — never
 * plaintext SharedPreferences.
 *
 * Every field is mirrored in an in-memory `@Volatile` cache, populated
 * once at construction and kept in sync on every write, and every getter
 * reads ONLY that cache — never `EncryptedSharedPreferences` directly.
 * That store re-derives its AES key and decrypts on every single
 * `getString()` call; under concurrent access from multiple repositories
 * hitting the network right after each other (attendance check-in,
 * staff profile, photo upload — every one of them reads the access
 * token per request), that decrypt path was intermittently returning null
 * for one read and the correct value on the very next one, moments
 * later — every request built during that null window went out with no
 * Authorization header at all, got a 401, and only the framework's
 * automatic retry (or none, for calls that bypass it) recovered. The
 * in-memory cache makes a read/write on this process never touch that
 * decrypt path at all, so there's no window left for it to race in.
 */
class SecureTokenStore(context: Context) {

    private val prefs = EncryptedSharedPreferences.create(
        context,
        "dsps_attendance_session",
        MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(),
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
    )

    @Volatile private var cachedAccessToken: String? = prefs.getString(KEY_ACCESS_TOKEN, null)
    @Volatile private var cachedRefreshToken: String? = prefs.getString(KEY_REFRESH_TOKEN, null)
    @Volatile private var cachedEmployeeId: String? = prefs.getString(KEY_TEACHER_ID, null)
    @Volatile private var cachedEmployeeName: String? = prefs.getString(KEY_TEACHER_NAME, null)
    @Volatile private var cachedEmployeeEmail: String? = prefs.getString(KEY_TEACHER_EMAIL, null)
    @Volatile private var cachedEmployeePhotoUrl: String? = prefs.getString(KEY_TEACHER_PHOTO_URL, null)
    @Volatile private var cachedHasSeenTour: Boolean = prefs.getBoolean(KEY_HAS_SEEN_TOUR, false)
    @Volatile private var cachedAppLockEnabled: Boolean = prefs.getBoolean(KEY_APP_LOCK_ENABLED, false)
    @Volatile private var cachedMustChangePassword: Boolean = prefs.getBoolean(KEY_MUST_CHANGE_PASSWORD, false)
    @Volatile private var cachedCanViewRosterAttendance: Boolean = prefs.getBoolean(KEY_CAN_VIEW_ROSTER_ATTENDANCE, false)
    @Volatile private var cachedAppLanguageCode: String = prefs.getString(KEY_APP_LANGUAGE, "en") ?: "en"
    @Volatile private var cachedSavedLoginId: String? = prefs.getString(KEY_SAVED_LOGIN_ID, null)
    @Volatile private var cachedResetRequest: String? = prefs.getString(KEY_RESET_REQUEST, null)
    @Volatile private var cachedSavedPassword: String? = prefs.getString(KEY_SAVED_PASSWORD, null)

    /** JSON of the last password-reset request made from this device (see [ResetRequest]). Survives logout — the requester is logged out by definition. */
    var resetRequestJson: String?
        get() = cachedResetRequest
        set(value) {
            cachedResetRequest = value
            if (value == null) prefs.edit().remove(KEY_RESET_REQUEST).apply() else prefs.edit().putString(KEY_RESET_REQUEST, value).apply()
        }

    var accessToken: String?
        get() = cachedAccessToken
        set(value) {
            cachedAccessToken = value
            prefs.edit().putString(KEY_ACCESS_TOKEN, value).apply()
        }

    var refreshToken: String?
        get() = cachedRefreshToken
        set(value) {
            cachedRefreshToken = value
            prefs.edit().putString(KEY_REFRESH_TOKEN, value).apply()
        }

    var employeeId: String?
        get() = cachedEmployeeId
        set(value) {
            cachedEmployeeId = value
            prefs.edit().putString(KEY_TEACHER_ID, value).apply()
        }

    var employeeName: String?
        get() = cachedEmployeeName
        set(value) {
            cachedEmployeeName = value
            prefs.edit().putString(KEY_TEACHER_NAME, value).apply()
        }

    var employeeEmail: String?
        get() = cachedEmployeeEmail
        set(value) {
            cachedEmployeeEmail = value
            prefs.edit().putString(KEY_TEACHER_EMAIL, value).apply()
        }

    var employeePhotoUrl: String?
        get() = cachedEmployeePhotoUrl
        set(value) {
            cachedEmployeePhotoUrl = value
            prefs.edit().putString(KEY_TEACHER_PHOTO_URL, value).apply()
        }

    var hasSeenTour: Boolean
        get() = cachedHasSeenTour
        set(value) {
            cachedHasSeenTour = value
            prefs.edit().putBoolean(KEY_HAS_SEEN_TOUR, value).apply()
        }

    var isAppLockEnabled: Boolean
        get() = cachedAppLockEnabled
        set(value) {
            cachedAppLockEnabled = value
            prefs.edit().putBoolean(KEY_APP_LOCK_ENABLED, value).apply()
        }

    /** True for a temporary password — freshly created account, or an approved reset request — until the employee sets their own. */
    var mustChangePassword: Boolean
        get() = cachedMustChangePassword
        set(value) {
            cachedMustChangePassword = value
            prefs.edit().putBoolean(KEY_MUST_CHANGE_PASSWORD, value).apply()
        }

    /**
     * Whether this account can see the full staff roster (vs. just its own
     * attendance) — mirrors the RBAC 'admin.attendance' 'view' permission
     * the web admin panel checks server-side; the server is the only source
     * of truth, this is just a cache of its last answer so the roster tab
     * doesn't disappear/flicker while a fresh check is in flight.
     */
    var canViewRosterAttendance: Boolean
        get() = cachedCanViewRosterAttendance
        set(value) {
            cachedCanViewRosterAttendance = value
            prefs.edit().putBoolean(KEY_CAN_VIEW_ROSTER_ATTENDANCE, value).apply()
        }

    /** Device-level display language — a UI preference, not session data; survives logout like hasSeenTour/isAppLockEnabled. */
    var appLanguageCode: String
        get() = cachedAppLanguageCode
        set(value) {
            cachedAppLanguageCode = value
            prefs.edit().putString(KEY_APP_LANGUAGE, value).apply()
        }

    /**
     * "Remember me" credentials for one-tap re-login after logout. Same
     * Keystore-backed encrypted file as the session — never plaintext.
     * Deliberately NOT wiped by [clearSession] so a logged-out employee can
     * sign straight back in.
     */
    var savedLoginId: String?
        get() = cachedSavedLoginId
        set(value) {
            cachedSavedLoginId = value
            prefs.edit().putString(KEY_SAVED_LOGIN_ID, value).apply()
        }

    var savedPassword: String?
        get() = cachedSavedPassword
        set(value) {
            cachedSavedPassword = value
            prefs.edit().putString(KEY_SAVED_PASSWORD, value).apply()
        }

    val isLoggedIn: Boolean get() = accessToken != null

    /**
     * Ends the session but keeps device-level prefs: tour-seen, app lock and
     * remembered credentials all survive logout (previously [clear] wiped
     * those too, forcing the tour again and dropping app lock + re-login).
     */
    fun clearSession() {
        cachedAccessToken = null
        cachedRefreshToken = null
        cachedEmployeeId = null
        cachedEmployeeName = null
        cachedEmployeeEmail = null
        cachedEmployeePhotoUrl = null
        cachedMustChangePassword = false
        cachedCanViewRosterAttendance = false
        prefs.edit()
            .remove(KEY_ACCESS_TOKEN)
            .remove(KEY_REFRESH_TOKEN)
            .remove(KEY_TEACHER_ID)
            .remove(KEY_TEACHER_NAME)
            .remove(KEY_TEACHER_EMAIL)
            .remove(KEY_TEACHER_PHOTO_URL)
            .remove(KEY_MUST_CHANGE_PASSWORD)
            .remove(KEY_CAN_VIEW_ROSTER_ATTENDANCE)
            .apply()
    }

    fun clear() {
        cachedAccessToken = null
        cachedRefreshToken = null
        cachedEmployeeId = null
        cachedEmployeeName = null
        cachedEmployeeEmail = null
        cachedEmployeePhotoUrl = null
        cachedHasSeenTour = false
        cachedAppLockEnabled = false
        cachedMustChangePassword = false
        cachedCanViewRosterAttendance = false
        cachedAppLanguageCode = "en"
        cachedSavedLoginId = null
        cachedSavedPassword = null
        prefs.edit().clear().apply()
    }

    private companion object {
        const val KEY_ACCESS_TOKEN = "access_token"
        const val KEY_REFRESH_TOKEN = "refresh_token"
        const val KEY_TEACHER_ID = "employee_id"
        const val KEY_TEACHER_NAME = "employee_name"
        const val KEY_TEACHER_EMAIL = "employee_email"
        const val KEY_TEACHER_PHOTO_URL = "employee_photo_url"
        const val KEY_HAS_SEEN_TOUR = "has_seen_tour"
        const val KEY_APP_LOCK_ENABLED = "is_app_lock_enabled"
        const val KEY_MUST_CHANGE_PASSWORD = "must_change_password"
        const val KEY_CAN_VIEW_ROSTER_ATTENDANCE = "can_view_roster_attendance"
        const val KEY_APP_LANGUAGE = "app_language"
        const val KEY_SAVED_LOGIN_ID = "saved_login_id"
        const val KEY_SAVED_PASSWORD = "saved_password"
        const val KEY_RESET_REQUEST = "reset_request"
    }
}
