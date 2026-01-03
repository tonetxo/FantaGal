package com.antigravity.vocodergal.ui.theme

import android.app.Activity
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

private val SteampunkColorScheme = darkColorScheme(
    primary = BronzeGold,
    secondary = CopperOrange,
    tertiary = BrassYellow,
    background = DarkWood,
    surface = SteamGray,
    onPrimary = OldPaper,
    onSecondary = OldPaper,
    onTertiary = DarkWood,
    onBackground = OldPaper,
    onSurface = OldPaper,
)

@Composable
fun VocoderGalTheme(
    content: @Composable () -> Unit
) {
    val colorScheme = SteampunkColorScheme
    val view = LocalView.current
    
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            window.statusBarColor = DarkWood.toArgb()
            WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = false
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        content = content
    )
}
