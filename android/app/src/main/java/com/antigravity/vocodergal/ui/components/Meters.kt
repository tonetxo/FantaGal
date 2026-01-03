package com.antigravity.vocodergal.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.dp
import com.antigravity.vocodergal.ui.theme.*
import kotlin.math.cos
import kotlin.math.sin

/**
 * VU Meter analógico estilo Steampunk.
 */
@Composable
fun VUMeter(
    level: Float,
    modifier: Modifier = Modifier
) {
    Canvas(
        modifier = modifier
            .height(80.dp)
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .background(DarkWood)
            .border(2.dp, BronzeGold, RoundedCornerShape(8.dp))
    ) {
        val centerX = size.width / 2
        val centerY = size.height * 0.85f
        val radius = size.height * 0.82f
        
        // Arco del medidor
        drawArc(
            color = BronzeGold,
            startAngle = 180f,
            sweepAngle = 180f,
            useCenter = false,
            topLeft = Offset(centerX - radius, centerY - radius),
            size = Size(radius * 2, radius * 2),
            style = Stroke(width = 4f)
        )
        
        // Marcas del medidor
        for (i in 0..10) {
            val angle = Math.toRadians((180 + i * 18).toDouble())
            val startR = radius * 0.9f
            val endR = radius * 0.98f
            
            drawLine(
                color = if (i > 7) RustyRed else BronzeGold,
                start = Offset(
                    centerX + (startR * cos(angle)).toFloat(),
                    centerY + (startR * sin(angle)).toFloat()
                ),
                end = Offset(
                    centerX + (endR * cos(angle)).toFloat(),
                    centerY + (endR * sin(angle)).toFloat()
                ),
                strokeWidth = 3f
            )
        }
        
        // Aguja
        val actualLevel = level.coerceIn(0f, 1f)
        val needleAngle = Math.toRadians((180 + actualLevel * 180).toDouble())
        val needleLength = radius * 0.92f
        
        drawLine(
            color = GlowAmber,
            start = Offset(centerX, centerY),
            end = Offset(
                centerX + (needleLength * cos(needleAngle)).toFloat(),
                centerY + (needleLength * sin(needleAngle)).toFloat()
            ),
            strokeWidth = 5f
        )
        
        // Centro de la aguja
        drawCircle(
            color = DarkBronze,
            radius = 12f,
            center = Offset(centerX, centerY)
        )
        drawCircle(
            color = BronzeGold,
            radius = 4f,
            center = Offset(centerX, centerY)
        )
    }
}

/**
 * Osciloscopio que muestra la forma de onda.
 */
@Composable
fun Oscilloscope(
    waveformData: FloatArray,
    modifier: Modifier = Modifier
) {
    Canvas(
        modifier = modifier
            .height(100.dp)
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .background(DarkWood.copy(alpha = 0.9f))
            .border(2.dp, BronzeGold, RoundedCornerShape(8.dp))
    ) {
        val path = Path()
        val centerY = size.height / 2
        val scaleY = size.height / 2.5f
        
        if (waveformData.isNotEmpty()) {
            val stepX = size.width / waveformData.size
            
            path.moveTo(0f, centerY - waveformData[0] * scaleY)
            
            for (i in 1 until waveformData.size) {
                path.lineTo(i * stepX, centerY - waveformData[i] * scaleY)
            }
        }
        
        // Línea central
        drawLine(
            color = BronzeGold.copy(alpha = 0.3f),
            start = Offset(0f, centerY),
            end = Offset(size.width, centerY),
            strokeWidth = 1f
        )
        
        // Forma de onda
        drawPath(
            path = path,
            color = GlowAmber,
            style = Stroke(width = 2f)
        )
    }
}
