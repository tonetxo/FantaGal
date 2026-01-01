package com.tonetxo.fantagal.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Standardized Header for all Engine Screens.
 * Includes status indicator dot and toggles engine on click.
 */
@Composable
fun EngineHeader(
    title: String,
    isActive: Boolean,
    onToggle: () -> Unit,
    modifier: Modifier = Modifier,
    activeColor: Color = Color(0xFF22C55E) // Default to Green
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = modifier.clickable { onToggle() }
    ) {
        // Status Indicator Dot
        Box(
            modifier = Modifier
                .size(8.dp)
                .clip(CircleShape)
                .background(
                    when {
                        isActive -> activeColor
                        else -> Color.Gray
                    }
                )
        )
        
        // Engine Title
        Text(
            text = title.uppercase(),
            fontSize = 20.sp, // Standardized element size
            fontWeight = FontWeight.Bold,
            color = if (isActive) {
                activeColor
            } else {
                Color.White.copy(alpha = 0.5f)
            },
            letterSpacing = 1.sp,
            modifier = Modifier.padding(start = 8.dp)
        )
    }
}
