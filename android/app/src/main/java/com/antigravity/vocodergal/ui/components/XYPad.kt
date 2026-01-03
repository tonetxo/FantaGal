package com.antigravity.vocodergal.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import com.antigravity.vocodergal.ui.theme.*

/**
 * XY Pad interactivo similar al de Aethereum.
 */
@Composable
fun XYPad(
    modifier: Modifier = Modifier,
    resetKey: Any = Unit,
    onMove: (x: Float, y: Float) -> Unit
) {
    var size by remember { mutableStateOf(IntSize.Zero) }
    var position by remember(resetKey) { mutableStateOf(Offset(0.5f, 0.5f)) }
    val handleSize = 40.dp
    
    Box(
        modifier = modifier
            .aspectRatio(1f)
            .padding(8.dp)
            .clip(RoundedCornerShape(8.dp))
            .border(3.dp, BronzeGold, RoundedCornerShape(8.dp))
            .background(
                Brush.radialGradient(
                    colors = listOf(SteamGray, DarkWood)
                )
            )
            .onSizeChanged { size = it }
            .pointerInput(resetKey) {
                detectDragGestures { change, _ ->
                    val x = (change.position.x / size.width).coerceIn(0f, 1f)
                    val y = (change.position.y / size.height).coerceIn(0f, 1f)
                    position = Offset(x, y)
                    onMove(x, y)
                }
            }
    ) {
        // Líneas de cuadrícula
        Canvas(modifier = Modifier.fillMaxSize()) {
            val gridColor = BronzeGold.copy(alpha = 0.3f)
            
            // Líneas verticales
            for (i in 1..3) {
                val x = this.size.width * i / 4
                drawLine(gridColor, Offset(x, 0f), Offset(x, this.size.height))
            }
            
            // Líneas horizontales
            for (i in 1..3) {
                val y = this.size.height * i / 4
                drawLine(gridColor, Offset(0f, y), Offset(this.size.width, y))
            }
        }
        
        // Handle (círculo que se mueve)
        Box(
            modifier = Modifier
                .offset {
                    IntOffset(
                        (position.x * size.width - 20.dp.toPx()).toInt(),
                        (position.y * size.height - 20.dp.toPx()).toInt()
                    )
                }
                .size(handleSize)
                .clip(CircleShape)
                .background(
                    Brush.radialGradient(
                        colors = listOf(GlowAmber, BronzeGold)
                    )
                )
                .border(2.dp, DarkBronze, CircleShape)
        )
    }
}
