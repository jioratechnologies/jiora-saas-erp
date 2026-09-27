package com.saaserp.attendance.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.saaserp.attendance.ui.theme.DarkDialogSurface
import com.saaserp.attendance.ui.theme.LightDialogCream
import com.saaserp.attendance.ui.theme.Saffron500

/**
 * The card primitive used throughout the app: a SOLID warm-white fill, a
 * subtle warm hairline border, and a soft shadow to lift it off the
 * [GlassBackdrop].
 *
 * Deliberately OPAQUE, not frosted glass. The previous translucent-gradient
 * recipe composited the animated blurred backdrop through every card, so the
 * card interior varied spatially (and per-GPU): padding bands, nested boxes
 * and even bare content areas rendered as visibly different shades — the
 * "padding lines" / inner white rectangles seen on-device on Profile,
 * History, Check-In and Login. A solid fill makes every card pixel
 * deterministic on all devices: padding and content areas are always the
 * exact same color, so seams are impossible. Card edges are defined only by
 * the hairline border + shadow, which is the intended look.
 *
 * Single-layer habit still applies: content inside a GlassSurface should be
 * transparent (or the exact same solid) and use tinted badges/borders for
 * emphasis, so no contrasting rectangle ever appears inside a card. See the
 * canonical tokens in Color.kt.
 */
@Composable
fun GlassSurface(
    modifier: Modifier = Modifier,
    shape: Shape = RoundedCornerShape(28.dp),
    elevation: Dp = 24.dp,
    contentPadding: Dp = 20.dp,
    content: @Composable ColumnScope.() -> Unit,
) {
    val dark = isSystemInDarkTheme()

    // Opaque fills — identical for padding band and content area by
    // construction, so no seam can ever appear between them.
    val fillColor = if (dark) DarkDialogSurface else LightDialogCream
    val edgeColor = if (dark) {
        Color.White.copy(alpha = 0.10f)
    } else {
        Saffron500.copy(alpha = 0.14f)
    }

    Column(
        modifier = modifier
            .shadow(
                elevation = elevation,
                shape = shape,
                ambientColor = Color.Black.copy(alpha = 0.15f),
                spotColor = Color.Black.copy(alpha = 0.25f),
            )
            .clip(shape)
            .background(fillColor)
            .border(1.dp, edgeColor, shape)
            .padding(contentPadding),
        content = content,
    )
}
