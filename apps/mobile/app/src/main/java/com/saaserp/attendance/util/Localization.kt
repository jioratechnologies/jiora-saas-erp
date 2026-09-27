package com.saaserp.attendance.util

import androidx.compose.runtime.Composable
import androidx.compose.runtime.compositionLocalOf

enum class AppLanguage(val code: String, val displayName: String) {
    EN("en", "English"),
    HI("hi", "हिन्दी");

    companion object {
        fun fromCode(code: String?): AppLanguage = entries.firstOrNull { it.code == code } ?: EN
    }
}

/**
 * App-wide display language, provided once near the composition root
 * (see MainActivity) from the persisted preference in AuthRepository.
 * Deliberately not Android's Configuration/locale + strings.xml resource
 * system — this codebase's UI text is all inline Kotlin string literals,
 * not stringResource() calls, so a resource-based approach would need
 * every screen rewritten first. [s] is a minimal, additive way to
 * translate a string at its call site without that rewrite: screens not
 * yet touched simply keep showing their English literal, exactly as
 * before, until someone wraps that call in [s] too.
 */
val LocalAppLanguage = compositionLocalOf { AppLanguage.EN }

/** `Text(s("Check In", "चेक इन"))` — English shown until the app's language is set to Hindi. */
@Composable
fun s(en: String, hi: String): String =
    if (LocalAppLanguage.current == AppLanguage.HI) hi else en
