package com.tonetxo.fantagal.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tonetxo.fantagal.ui.theme.CriosferaPrimary
import com.tonetxo.fantagal.ui.theme.StoneSurface

/**
 * XY Pad with bubble indicator - matches original BubbleXYPad
 */
@Composable
fun XYPad(
    xValue: Float,
    yValue: Float,
    xLabel: String,
    yLabel: String,
    onValueChange: (Float, Float) -> Unit,
    modifier: Modifier = Modifier
) {
    var isDragging by remember { mutableStateOf(false) }

    Column(
        modifier = modifier.fillMaxWidth()
    ) {
        // Labels row
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 8.dp, vertical = 4.dp)
        ) {
            Text(
                text = "Y: $yLabel",
                fontSize = 10.sp,
                fontWeight = FontWeight.Medium,
                fontFamily = FontFamily.Monospace,
                letterSpacing = 2.sp,
                color = CriosferaPrimary
            )
            Spacer(modifier = Modifier.weight(1f))
            Text(
                text = "X: $xLabel",
                fontSize = 10.sp,
                fontWeight = FontWeight.Medium,
                fontFamily = FontFamily.Monospace,
                letterSpacing = 2.sp,
                color = CriosferaPrimary
            )
        }

        Spacer(modifier = Modifier.height(8.dp))

        // XY Pad Canvas - fills available space with better styling
        Box(
            modifier = Modifier
                .fillMaxSize()
                .clip(RoundedCornerShape(16.dp))
                .background(StoneSurface.copy(alpha = 0.6f))
                .border(2.dp, CriosferaPrimary.copy(alpha = 0.4f), RoundedCornerShape(16.dp))
                .pointerInput(Unit) {
                    detectTapGestures { offset ->
                        val x = (offset.x / size.width).coerceIn(0f, 1f)
                        val y = 1f - (offset.y / size.height).coerceIn(0f, 1f)
                        onValueChange(x, y)
                    }
                }
                .pointerInput(Unit) {
                    detectDragGestures(
                        onDragStart = { isDragging = true },
                        onDragEnd = { isDragging = false },
                        onDragCancel = { isDragging = false }
                    ) { change, _ ->
                        val x = (change.position.x / size.width).coerceIn(0f, 1f)
                        val y = 1f - (change.position.y / size.height).coerceIn(0f, 1f)
                        onValueChange(x, y)
                    }
                }
        ) {
            Canvas(modifier = Modifier.fillMaxSize()) {
                val bubbleX = xValue * size.width
                val bubbleY = (1f - yValue) * size.height

                // Grid lines
                drawGrid()

                // Crosshair lines
                drawLine(
                    color = CriosferaPrimary.copy(alpha = 0.1f),
                    start = Offset(bubbleX, 0f),
                    end = Offset(bubbleX, size.height),
                    strokeWidth = 1f
                )
                drawLine(
                    color = CriosferaPrimary.copy(alpha = 0.1f),
                    start = Offset(0f, bubbleY),
                    end = Offset(size.width, bubbleY),
                    strokeWidth = 1f
                )

                // Bubble outer glow
                drawCircle(
                    brush = Brush.radialGradient(
                        colors = listOf(
                            CriosferaPrimary.copy(alpha = 0.3f),
                            Color.Transparent
                        ),
                        center = Offset(bubbleX, bubbleY),
                        radius = if (isDragging) 100f else 80f
                    ),
                    radius = if (isDragging) 100f else 80f,
                    center = Offset(bubbleX, bubbleY)
                )

                // Bubble inner glow
                drawCircle(
                    brush = Brush.radialGradient(
                        colors = listOf(
                            CriosferaPrimary.copy(alpha = 0.5f),
                            Color.Transparent
                        ),
                        center = Offset(bubbleX, bubbleY),
                        radius = 40f
                    ),
                    radius = 40f,
                    center = Offset(bubbleX, bubbleY)
                )

                // Bubble center point
                drawCircle(
                    color = Color(0xFFFFF7ED), // orange-50
                    radius = 12f,
                    center = Offset(bubbleX, bubbleY)
                )

                // Corner labels using drawIntoCanvas
                drawIntoCanvas { canvas ->
                    val paint = android.graphics.Paint().apply {
                        color = android.graphics.Color.argb(50, 249, 115, 22)
                        textSize = 24f
                        isFakeBoldText = true
                    }
                    canvas.nativeCanvas.drawText("0.0", 16f, size.height - 16f, paint)
                    canvas.nativeCanvas.drawText("1.0", size.width - 50f, size.height - 16f, paint)
                }
            }
        }
    }
}

private fun DrawScope.drawGrid() {
    val gridColor = Color(0xFF444444).copy(alpha = 0.1f)
    val cellWidth = size.width / 5
    val cellHeight = size.height / 5

    // Vertical lines
    for (i in 1..4) {
        drawLine(
            color = gridColor,
            start = Offset(i * cellWidth, 0f),
            end = Offset(i * cellWidth, size.height),
            strokeWidth = 1f
        )
    }

    // Horizontal lines
    for (i in 1..4) {
        drawLine(
            color = gridColor,
            start = Offset(0f, i * cellHeight),
            end = Offset(size.width, i * cellHeight),
            strokeWidth = 1f
        )
    }
}
