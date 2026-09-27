package com.saaserp.attendance.util

import android.content.Context
import android.util.Log
import com.saaserp.attendance.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.time.Instant
import java.time.LocalTime
import java.time.ZoneId

/**
 * Organization start/closing time (site_settings.attendance_organization_start_time /
 * attendance_organization_end_time, "HH:MM" IST) — the same values the server uses
 * for early-leave detection. Persisted in SharedPreferences on first login
 * and re-fetched periodically (see CheckoutReminderWorker), so reminders keep
 * firing with no connectivity and pick up admin changes without a re-login.
 */
object OrganizationHours {
    private const val TAG = "OrganizationHours"
    private const val PREFS = "organization_hours"
    private const val KEY_START = "start_time"
    private const val KEY_END = "end_time"
    private const val KEY_HOURS_WEEKDAY = "office_hours_weekday"
    private const val KEY_HOURS_SATURDAY = "office_hours_saturday"
    private const val KEY_HOURS_SUNDAY = "office_hours_sunday"
    private const val KEY_FETCHED_AT = "fetched_at"
    val IST: ZoneId = ZoneId.of("Asia/Kolkata")
    private val client = OkHttpClient()

    data class Hours(val start: LocalTime?, val end: LocalTime?)

    private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun cached(context: Context): Hours = try {
        val p = prefs(context)
        Hours(parse(p.getString(KEY_START, null)), parse(p.getString(KEY_END, null)))
    } catch (_: Exception) {
        Hours(null, null)
    }

    fun cachedEndTime(context: Context): LocalTime? = cached(context).end

    /** Milliseconds since the last successful server fetch, or Long.MAX_VALUE if never fetched. */
    fun ageMs(context: Context): Long {
        val fetchedAt = prefs(context).getLong(KEY_FETCHED_AT, 0L)
        return if (fetchedAt <= 0L) Long.MAX_VALUE else System.currentTimeMillis() - fetchedAt
    }

    /** Fetches from /api/settings, refreshes the cache, and falls back to the cached value on failure. */
    suspend fun refresh(context: Context): Hours = withContext(Dispatchers.IO) {
        try {
            val url = BuildConfig.API_BASE_URL.toHttpUrl().resolve("api/settings") ?: return@withContext cached(context)
            client.newCall(Request.Builder().url(url).get().build()).execute().use { response ->
                if (!response.isSuccessful) return@withContext cached(context)
                val settings = JSONObject(response.body?.string() ?: "{}").optJSONObject("settings")
                    ?: return@withContext cached(context)
                val rawStart = settings.optString("attendance_organization_start_time", "")
                val rawEnd = settings.optString("attendance_organization_end_time", "")
                // Written even when blank, so an admin clearing a time also clears the reminder.
                prefs(context).edit()
                    .putString(KEY_START, rawStart)
                    .putString(KEY_END, rawEnd)
                    .putString(KEY_HOURS_WEEKDAY, settings.optString("office_hours_weekday", ""))
                    .putString(KEY_HOURS_SATURDAY, settings.optString("office_hours_saturday", ""))
                    .putString(KEY_HOURS_SUNDAY, settings.optString("office_hours_sunday", ""))
                    .putLong(KEY_FETCHED_AT, System.currentTimeMillis())
                    .apply()
                Hours(parse(rawStart), parse(rawEnd))
            }
        } catch (e: Exception) {
            Log.w(TAG, "refresh failed: ${e.message}")
            cached(context)
        }
    }

    suspend fun fetchEndTime(context: Context): LocalTime? = refresh(context).end

    /**
     * Whether the organization is closed on [date], per Admin -> Settings -> Organization
     * Office Hours: each of "Monday - Friday", "Saturday" and "Sunday &
     * Holidays" is free text, and a row reading "Closed" means no reminders
     * that day. Unset rows (never configured) count as open, except Sunday,
     * which defaults to closed like the admin form does.
     */
    fun isClosedOn(context: Context, date: java.time.LocalDate): Boolean {
        val p = prefs(context)
        val (key, default) = when (date.dayOfWeek) {
            java.time.DayOfWeek.SUNDAY -> KEY_HOURS_SUNDAY to "Closed"
            java.time.DayOfWeek.SATURDAY -> KEY_HOURS_SATURDAY to ""
            else -> KEY_HOURS_WEEKDAY to ""
        }
        val text = p.getString(key, null)?.takeIf { it.isNotBlank() } ?: default
        return text.contains("closed", ignoreCase = true)
    }

    /** True once the current IST wall-clock time is at or past [endTime]. */
    fun isPastEndTime(endTime: LocalTime?): Boolean =
        endTime != null && !Instant.now().atZone(IST).toLocalTime().isBefore(endTime)

    private fun parse(raw: String?): LocalTime? = try {
        if (raw.isNullOrBlank()) null else LocalTime.parse(raw.take(5))
    } catch (_: Exception) {
        null
    }
}
