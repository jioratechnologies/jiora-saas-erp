package com.saaserp.attendance.util

import com.saaserp.attendance.BuildConfig

object UrlResolver {
    /**
     * Converts relative asset paths or Supabase storage paths into absolute, downloadable URLs.
     */
    fun resolve(rawUrl: String?): String? {
        if (rawUrl.isNullOrBlank()) return null
        val trimmed = rawUrl.trim()

        val baseSupabase = BuildConfig.SUPABASE_URL.trimEnd('/')
        val baseApi = BuildConfig.API_BASE_URL.trimEnd('/')

        // Admin-uploaded photos are sometimes stored as inline base64 data URIs
        // instead of a Storage path. Pass through unchanged (see toCoilModel()
        // for how these get decoded before hitting Coil).
        if (trimmed.startsWith("data:")) return trimmed

        // If it's a dynamic uploaded staff photo (e.g. portrait_... or in staff-photos/)
        if (trimmed.contains("portrait_") || trimmed.contains("staff-photos/")) {
            val filename = trimmed.substringAfterLast('/')
            return "$baseSupabase/storage/v1/object/public/SaaS ERP/staff-photos/$filename"
        }

        if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
            return trimmed
        }

        // Attendance check-in / check-out photos in the private attendance-photos bucket
        if (trimmed.contains("checkin_") || trimmed.contains("attendance-photos")) {
            val cleanPath = trimmed.removePrefix("/").removePrefix("attendance-photos/")
            return "$baseApi/api/attendance/photo?path=$cleanPath"
        }

        return when {
            trimmed.startsWith("/assets/") -> "$baseApi$trimmed"
            trimmed.startsWith("assets/") -> "$baseApi/$trimmed"
            trimmed.startsWith("/storage/") -> "$baseSupabase$trimmed"
            trimmed.startsWith("storage/") -> "$baseSupabase/$trimmed"
            trimmed.startsWith("SaaS ERP/") -> "$baseSupabase/storage/v1/object/public/$trimmed"
            trimmed.startsWith("/") -> "$baseApi$trimmed"
            else -> "$baseApi/$trimmed"
        }
    }

    /**
     * Coil (2.6.0) has no fetcher for the "data:" scheme, so a data URI passed
     * to ImageRequest.data() as a String fails to load. Decode it to a
     * ByteArray instead, which Coil's built-in ByteArrayFetcher can render.
     */
    fun toCoilModel(resolvedUrl: String?): Any? {
        if (resolvedUrl == null) return null
        if (!resolvedUrl.startsWith("data:")) return resolvedUrl
        return try {
            val base64 = resolvedUrl.substringAfter(',', missingDelimiterValue = "")
            if (base64.isEmpty()) null else android.util.Base64.decode(base64, android.util.Base64.DEFAULT)
        } catch (e: IllegalArgumentException) {
            null
        }
    }
}
