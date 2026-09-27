package com.saaserp.attendance.ui.components

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.saaserp.attendance.ui.theme.AmberGold
import com.saaserp.attendance.ui.theme.LightBackdropBase
import com.saaserp.attendance.ui.theme.Maroon900
import com.saaserp.attendance.ui.theme.Saffron600

/**
 * The "liquid" half of the glass look: 3 large, heavily-blurred colour
 * fields drifting slowly behind the content. Every [GlassSurface] on top
 * of this reads as frosted glass because there's genuinely something soft
 * and colourful sitting behind it — a flat single-colour background would
 * make the translucent card treatment look muddy instead of glassy.
 *
 * This is NOT the same thing as real backdrop blur (the card itself
 * doesn't sample and blur whatever content is directly behind it — that
 * needs either a RenderEffect/GraphicsLayer compositing pipeline or a
 * library like Chris Banes' Haze). What's here is reliable with only
 * stable core Compose APIs, which matters a lot given this was written
 * without a compiler available to verify anything fancier.
 */
@Composable
fun GlassBackdrop(modifier: Modifier = Modifier) {
    val dark = isSystemInDarkTheme()
    val transition = rememberInfiniteTransition(label = "glass-backdrop")

    val drift by transition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 18000, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "drift",
    )

    // Dark mode is AMOLED black on purpose — no warm glow wash. The blurred
    // saffron/amber/maroon blobs below are what made dark mode read as
    // "orange" rather than dark; light mode keeps that exact glass look
    // unchanged, only dark mode drops straight to true black with no
    // Canvas draw at all, so OLED pixels are genuinely off.
    val baseColor = if (dark) Color.Black else LightBackdropBase

    Box(modifier = modifier.fillMaxSize().background(baseColor)) {
        if (!dark) {
            Canvas(modifier = Modifier.fillMaxSize().blur(90.dp)) {
                val w = size.width
                val h = size.height

                drawCircle(
                    brush = Brush.radialGradient(
                        colors = listOf(Saffron600.copy(alpha = 0.45f), Color.Transparent),
                    ),
                    radius = w * 0.55f,
                    center = Offset(w * (0.15f + 0.10f * drift), h * (0.20f - 0.05f * drift)),
                )
                drawCircle(
                    brush = Brush.radialGradient(
                        colors = listOf(AmberGold.copy(alpha = 0.40f), Color.Transparent),
                    ),
                    radius = w * 0.5f,
                    center = Offset(w * (0.85f - 0.12f * drift), h * (0.35f + 0.08f * drift)),
                )
                drawCircle(
                    brush = Brush.radialGradient(
                        colors = listOf(Maroon900.copy(alpha = 0.22f), Color.Transparent),
                    ),
                    radius = w * 0.6f,
                    center = Offset(w * (0.45f + 0.08f * drift), h * (0.85f - 0.06f * drift)),
                )
            }
        }
    }
}
