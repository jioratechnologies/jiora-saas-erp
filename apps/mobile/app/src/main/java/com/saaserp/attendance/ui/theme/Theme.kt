package com.saaserp.attendance.ui.theme

import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext

private val DspsLightColors = lightColorScheme(
    primary = Saffron600,
    onPrimary = Color.White,
    primaryContainer = Saffron100,
    onPrimaryContainer = Saffron900,
    secondary = AmberGold,
    onSecondary = Color.White,
    secondaryContainer = Saffron50,
    onSecondaryContainer = Saffron800,
    tertiary = Maroon900,
    onTertiary = Color.White,
    background = Saffron50,
    onBackground = Color(0xFF211A14),
    surface = Color.White,
    onSurface = Color(0xFF211A14),
    surfaceVariant = Saffron100,
    onSurfaceVariant = Saffron800,
    error = StatusRejectedRed,
    onError = Color.White,
    outline = Saffron300,
)

// True AMOLED black — not the warm saffron/maroon-tinted dark browns this
// used to use (0xFF17100C / 0xFF241A15 read as "orange" on an OLED panel
// since every dark pixel still emitted a warm brown glow instead of being
// truly off). Background and surface are pure/near-pure black so OLED
// pixels actually switch off; accent colors (saffron/gold) stay exactly
// where they were for brand identity, only the neutral base changed.
private val DspsDarkColors = darkColorScheme(
    primary = Saffron400,
    onPrimary = Color.Black,
    primaryContainer = Color(0xFF2A2A2A),
    onPrimaryContainer = Saffron50,
    secondary = AmberGold,
    onSecondary = Color.Black,
    secondaryContainer = Color(0xFF1C1C1C),
    onSecondaryContainer = Saffron100,
    tertiary = Saffron300,
    onTertiary = Color.Black,
    background = Color.Black,
    onBackground = Saffron50,
    surface = Color(0xFF0A0A0A),
    onSurface = Saffron50,
    surfaceVariant = Color(0xFF1C1C1C),
    onSurfaceVariant = Saffron200,
    error = StatusRejectedRed,
    onError = Color.White,
    outline = Color(0xFF3A3A3A),
    // Material3 blends `surfaceTint` (which defaults to `primary` — our
    // brand orange) over ANY elevated Surface's background whenever
    // tonalElevation > 0, regardless of what explicit container color was
    // passed in — that automatic wash is exactly what was still turning
    // dialogs, the bottom nav bar, dropdown menus and bottom sheets orange
    // even after every card's own fill color was already fixed to neutral
    // black. Transparent tint makes that blend a no-op app-wide in dark
    // mode; light mode is untouched, so its (barely visible there anyway)
    // tonal elevation behavior stays exactly as it was.
    surfaceTint = Color.Transparent,
)

/**
 * Dynamic color (Android 12+ Material You, tinted from the user's
 * wallpaper) is intentionally OFF by default: this is a organization staff app
 * with a specific brand identity — employees on the same campus should see
 * the same saffron/maroon SaaS ERP look, not a palette that shifts per phone
 * wallpaper. Flip [useDynamicColor] to true if that's ever wanted instead.
 */
@Composable
fun DspsAttendanceTheme(
    useDynamicColor: Boolean = false,
    content: @Composable () -> Unit,
) {
    val dark = isSystemInDarkTheme()
    val context = LocalContext.current

    val colorScheme = when {
        useDynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ->
            if (dark) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
        dark -> DspsDarkColors
        else -> DspsLightColors
    }

    MaterialTheme(
        colorScheme = colorScheme,
        shapes = DspsShapes,
        typography = DspsTypography,
        content = content,
    )
}
