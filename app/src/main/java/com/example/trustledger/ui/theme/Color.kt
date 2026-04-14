package com.example.trustledger.ui.theme

import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.ui.graphics.Color

// ─── Flyer palette: gold highlights, deep navy panels, black type, off-white ground ─
val BrandGold = Color(0xFFF6A609)
val BrandGoldBright = Color(0xFFFFB400)
val BrandGoldSoft = Color(0xFFFFE7C2)
val BrandNavy = Color(0xFF0B1B32)
val BrandNavyDeep = Color(0xFF00112C)
val BrandBlack = Color(0xFF000000)
val BrandOffWhite = Color(0xFFF4F4F4)

/** Alias for [BrandNavy] (legacy name). */
val BrandBlue = BrandNavy
val BrandBlueDark = BrandNavyDeep
/** Alias for [BrandGold] (legacy name). */
val BrandTeal = BrandGold
val BrandAmber = BrandGoldBright

// ─── Light scheme ───────────────────────────────────────────────────────────
private val LightOnPrimaryContainer = BrandNavyDeep
private val LightSecondaryContainer = Color(0xFFDCE4EF)
private val LightOnSecondaryContainer = BrandNavyDeep
private val LightTertiaryContainer = Color(0xFFFFE0B5)
private val LightOnTertiaryContainer = Color(0xFF3D2400)
private val LightSurfaceVariant = Color(0xFFE8EAED)
private val LightOnSurfaceVariant = Color(0xFF49454F)
private val LightOutline = Color(0xFF74777F)
private val LightOutlineVariant = Color(0xFFC4C6CF)

// ─── Dark scheme (navy shell, gold accents, light type) ───────────────────────
private val DarkPrimary = Color(0xFFFFB84D)
private val DarkOnPrimary = BrandNavyDeep
private val DarkPrimaryContainer = Color(0xFF5C4300)
private val DarkOnPrimaryContainer = Color(0xFFFFE7C2)
private val DarkSecondary = Color(0xFFB8C7DC)
private val DarkOnSecondary = BrandNavyDeep
private val DarkSecondaryContainer = Color(0xFF20304A)
private val DarkOnSecondaryContainer = Color(0xFFDCE7F5)
private val DarkTertiary = Color(0xFF9BB0CC)
private val DarkOnTertiary = BrandNavyDeep
private val DarkTertiaryContainer = Color(0xFF1A3352)
private val DarkOnTertiaryContainer = Color(0xFFD0DEEE)
private val DarkBackground = BrandNavy
private val DarkSurface = Color(0xFF111D33)
private val DarkSurfaceVariant = Color(0xFF1E2D45)
private val DarkOnSurfaceVariant = Color(0xFFC3C6CF)
private val DarkOutline = Color(0xFF8E9199)
private val DarkOutlineVariant = Color(0xFF43474E)

internal val TrustLedgerLightColors = lightColorScheme(
    primary = BrandGold,
    onPrimary = BrandBlack,
    primaryContainer = BrandGoldSoft,
    onPrimaryContainer = LightOnPrimaryContainer,
    secondary = BrandNavy,
    onSecondary = Color.White,
    secondaryContainer = LightSecondaryContainer,
    onSecondaryContainer = LightOnSecondaryContainer,
    tertiary = BrandGoldBright,
    onTertiary = BrandBlack,
    tertiaryContainer = LightTertiaryContainer,
    onTertiaryContainer = LightOnTertiaryContainer,
    background = BrandOffWhite,
    onBackground = BrandBlack,
    surface = Color.White,
    onSurface = BrandBlack,
    surfaceVariant = LightSurfaceVariant,
    onSurfaceVariant = LightOnSurfaceVariant,
    surfaceTint = BrandGold,
    error = Color(0xFFBA1A1A),
    onError = Color.White,
    errorContainer = Color(0xFFFFDAD6),
    onErrorContainer = Color(0xFF410002),
    outline = LightOutline,
    outlineVariant = LightOutlineVariant,
    scrim = BrandBlack,
)

internal val TrustLedgerDarkColors = darkColorScheme(
    primary = DarkPrimary,
    onPrimary = DarkOnPrimary,
    primaryContainer = DarkPrimaryContainer,
    onPrimaryContainer = DarkOnPrimaryContainer,
    secondary = DarkSecondary,
    onSecondary = DarkOnSecondary,
    secondaryContainer = DarkSecondaryContainer,
    onSecondaryContainer = DarkOnSecondaryContainer,
    tertiary = DarkTertiary,
    onTertiary = DarkOnTertiary,
    tertiaryContainer = DarkTertiaryContainer,
    onTertiaryContainer = DarkOnTertiaryContainer,
    background = DarkBackground,
    onBackground = Color(0xFFE8EDF4),
    surface = DarkSurface,
    onSurface = Color(0xFFE8EDF4),
    surfaceVariant = DarkSurfaceVariant,
    onSurfaceVariant = DarkOnSurfaceVariant,
    surfaceTint = DarkPrimary,
    error = Color(0xFFFFB4AB),
    onError = Color(0xFF690005),
    errorContainer = Color(0xFF93000A),
    onErrorContainer = Color(0xFFFFDAD6),
    outline = DarkOutline,
    outlineVariant = DarkOutlineVariant,
    scrim = BrandBlack,
)
