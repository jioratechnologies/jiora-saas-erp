package com.saaserp.attendance.ui.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Shapes
import androidx.compose.ui.unit.dp

/**
 * Deliberately more rounded than stock M3 defaults — closer to the
 * "M3 Expressive" direction (larger, friendlier corner radii) and it also
 * reads better with glass surfaces: soft pill-like shapes catch the
 * gradient/border highlight more convincingly than sharp corners.
 */
val DspsShapes = Shapes(
    extraSmall = RoundedCornerShape(8.dp),
    small = RoundedCornerShape(12.dp),
    medium = RoundedCornerShape(18.dp),
    large = RoundedCornerShape(26.dp),
    extraLarge = RoundedCornerShape(34.dp),
)
