package com.tonetxo.fantagal.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import com.tonetxo.fantagal.ui.theme.CriosferaPrimary
import com.tonetxo.fantagal.ui.theme.VisualizerBar
import com.tonetxo.fantagal.ui.theme.VisualizerParticle
import kotlinx.coroutines.delay
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.sin
import kotlin.random.Random

/**
 * Audio visualizer with vertical bars and floating particles
 * Matches original Visualizer.tsx
 */
@Composable
fun AudioVisualizer(
    turbulence: Float,
    viscosity: Float,
    pressure: Float,
    modifier: Modifier = Modifier
) {
    var time by remember { mutableFloatStateOf(0f) }

    // Particles state
    val particles = remember {
        mutableStateListOf<Particle>().apply {
            repeat(50) {
                add(Particle(
                    x = Random.nextFloat(),
                    y = Random.nextFloat(),
                    radius = Random.nextFloat() * 4f + 1f,
                    vx = (Random.nextFloat() - 0.5f) * 2f,
                    vy = (Random.nextFloat() - 0.5f) * 2f
                ))
            }
        }
    }

    // Animation loop
    LaunchedEffect(turbulence, viscosity) {
        while (true) {
            time += 0.01f * (1f + turbulence * 5f)

            // Update particles
            particles.forEachIndexed { index, p ->
                val newX = (p.x + p.vx * turbulence * 0.01f).let {
                    if (it < 0f) 1f else if (it > 1f) 0f else it
                }
                val newY = (p.y + p.vy * (1f - viscosity) * 0.01f).let {
                    if (it < 0f) 1f else if (it > 1f) 0f else it
                }
                particles[index] = p.copy(x = newX, y = newY)
            }

            delay(16) // ~60fps
        }
    }

    Canvas(modifier = modifier.fillMaxSize()) {
        val hue = 30f + (pressure * 20f)

        // Background gradient
        drawRect(
            brush = Brush.radialGradient(
                colors = listOf(
                    Color.hsv(hue, 0.8f, 0.4f).copy(alpha = 0.4f),
                    Color.hsv(hue - 10f, 1f, 0.05f).copy(alpha = 0.8f)
                ),
                center = Offset(size.width / 2, size.height / 2),
                radius = size.width
            )
        )

        // Vertical bars (12 columns)
        val columnCount = 12
        val colWidth = size.width / columnCount
        val barOpacity = 0.1f + (pressure * 0.3f)

        for (i in 0 until columnCount) {
            val barHeight = (sin(time + i * 0.5f) * 50f * turbulence + (size.height * 0.5f))
                .coerceIn(0f, size.height)

            drawRect(
                color = VisualizerBar.copy(alpha = barOpacity),
                topLeft = Offset(i * colWidth + 10f, size.height - barHeight),
                size = Size(colWidth - 20f, barHeight)
            )
        }

        // Methane fog circles
        for (i in 0 until 3) {
            val shiftX = sin(time * 0.5f + i) * 100f
            val shiftY = cos(time * 0.3f + i) * 50f
            val fogRadius = 300f + i * 100f

            drawCircle(
                color = Color(0xFFC86400).copy(alpha = 0.1f * viscosity),
                radius = fogRadius,
                center = Offset(size.width / 2 + shiftX, size.height / 2 + shiftY)
            )
        }

        // Particles
        val particleOpacity = 0.4f + pressure * 0.5f
        particles.forEach { p ->
            drawCircle(
                color = VisualizerParticle.copy(alpha = particleOpacity),
                radius = p.radius * 2f,
                center = Offset(p.x * size.width, p.y * size.height)
            )
        }
    }
}

private data class Particle(
    val x: Float,
    val y: Float,
    val radius: Float,
    val vx: Float,
    val vy: Float
)
