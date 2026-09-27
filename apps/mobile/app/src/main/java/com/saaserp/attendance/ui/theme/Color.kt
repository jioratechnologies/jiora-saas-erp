package com.saaserp.attendance.ui.theme

import androidx.compose.ui.graphics.Color

/**
 * SaaS ERP brand palette — mirrors the website's Tailwind tokens
 * (tailwind.config.ts: saffron.*, maroon.*, amber-gold) so the Android app
 * and the admin website read as the same product, not two different apps
 * that happen to share a backend.
 */

// Saffron — primary brand hue
val Saffron50 = Color(0xFFFFF7ED)
val Saffron100 = Color(0xFFFFEDD5)
val Saffron200 = Color(0xFFFED7AA)
val Saffron300 = Color(0xFFFDBA74)
val Saffron400 = Color(0xFFFB923C)
val Saffron500 = Color(0xFFF97316)
val Saffron600 = Color(0xFFEA580C)
val Saffron700 = Color(0xFFC2410C)
val Saffron800 = Color(0xFF9A3412)
val Saffron900 = Color(0xFF7C2D12)

val AmberGold = Color(0xFFF59E0B)

// Maroon — deep accent / dark-theme base
val Maroon900 = Color(0xFF4C0519)
val Maroon950 = Color(0xFF2D030F)

// Status colors (shared meaning with the website's admin UI)
val StatusVerifiedGreen = Color(0xFF10B981)
val StatusPendingAmber = Color(0xFFF59E0B)
val StatusFlaggedOrange = Color(0xFFF97316)
val StatusRejectedRed = Color(0xFFEF4444)

// (Retired glass-gradient tints — GlassSurface is opaque now. Kept so older
// references still resolve; do not use for new fills.)
val GlassLightTintTop = Color(0xFFFFFFFF)
val GlassLightTintBottom = Color(0xFFFFF7ED)
val GlassDarkTintTop = Color(0xFF4C0519)
val GlassDarkTintBottom = Color(0xFF2D030F)

// Canonical app surfaces — every screen must use these tokens instead of
// hardcoded warm-white literals. The bug that motivated this: each screen
// invented its own near-identical cream (0xFFFFF9F2 vs 0xFFFFFDF8 vs
// White@0.8/0.9, 0xFF241812 vs 0xFF221610 vs 0xFF2C1D15 vs 0xFF1E140F …), so
// wherever a padded parent showed through next to a child fill, a visible
// seam/line appeared. Single source of truth removes the drift.
//
// Cards (GlassSurface) are OPAQUE solids: padding band and content area are
// the same pixel by construction, so inner "padding lines" / white
// rectangles are impossible regardless of device GPU. Borders and shadows
// alone define card edges.
//
// Rule of thumb:
// - Cards on the backdrop -> GlassSurface (opaque, one layer).
// - Anything nested INSIDE a GlassSurface -> transparent (shows the exact
//   same solid) or a deliberately contrasting tinted badge WITH a border.
//   Never a near-white translucent fill — that was the seam source.
// - Opaque floating bars & dialogs -> the *Cream tokens below.

// Backdrop wash behind everything (light mode only — dark mode is pure
// black straight from GlassBackdrop.kt, no separate token needed).
val LightBackdropBase = Color(0xFFFFFBF5)

// Warm cream for opaque floating chrome (bottom nav, save bar, badges, KPI)
// in light mode; AMOLED-neutral near-black (no warm brown tint) in dark.
val LightCreamCard = Color(0xFFFFF9F2)
val DarkFloatingBar = Color(0xFF121212)

// Opaque dialog / bottom-sheet fill.
val LightDialogCream = Color(0xFFFFFDF8)
val DarkDialogSurface = Color(0xFF141414)

// Tour hero solids (opaque versions of the old translucent fills).
val DarkTourCircle = Color(0xFF161616)
val DarkTourBadge = Color(0xFF1C1C1C)

// Standalone circular icon buttons floating on the backdrop.
val DarkIconButtonBg = Color(0xFF1A1A1A)
