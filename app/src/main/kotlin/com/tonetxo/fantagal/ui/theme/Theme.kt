package com.tonetxo.fantagal.ui.theme

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

private val DarkColorScheme = darkColorScheme(
    primary = CriosferaPrimary,
    secondary = CriosferaSecondary,
    tertiary = CriosferaTertiary,
    background = DarkBackground,
    surface = DarkSurface,
    onPrimary = DeepOcean,
    onSecondary = DarkOnBackground,
    onTertiary = DeepOcean,
    onBackground = DarkOnBackground,
    onSurface = DarkOnSurface
)

private val LightColorScheme = lightColorScheme(
    primary = CriosferaSecondary,
    secondary = CriosferaPrimary,
    tertiary = CriosferaTertiary,
    background = LightBackground,
    surface = LightSurface,
    onPrimary = LightOnBackground,
    onSecondary = LightOnBackground,
    onTertiary = LightOnBackground,
    onBackground = LightOnBackground,
    onSurface = LightOnSurface
)

@Composable
fun FantaGalTheme(
    darkTheme: Boolean = true, // Default to dark theme
    content: @Composable () -> Unit
) {
    val colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme

    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            window.statusBarColor = colorScheme.background.toArgb()
            WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = !darkTheme
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        content = content
    )
}
