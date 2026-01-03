package com.antigravity.vocodergal.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import com.antigravity.vocodergal.R

// Familia de fonte personalizada GaliciaDiario
val GaliciaDiarioFont = FontFamily(
    Font(resId = R.font.galicia_diario, weight = FontWeight.Normal)
)

val Typography = Typography(
    headlineLarge = TextStyle(
        fontFamily = GaliciaDiarioFont,
        fontWeight = FontWeight.Normal,
        fontSize = 32.sp, 
        letterSpacing = 0.5.sp
    ),
    bodyLarge = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Normal,
        fontSize = 16.sp,
        lineHeight = 24.sp,
        letterSpacing = 0.5.sp
    )
)
