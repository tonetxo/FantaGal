package com.tonetxo.fantagal.ui.screens

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tonetxo.fantagal.viewmodel.SynthViewModel
import com.tonetxo.fantagal.ui.components.EngineHeader
import com.tonetxo.fantagal.ui.theme.CriosferaPrimary
import com.tonetxo.fantagal.ui.theme.StoneSurface
import kotlinx.coroutines.delay
import com.tonetxo.fantagal.audio.SynthEngine
import kotlin.math.*

// Materials
val MaterialColors = mapOf(
    0 to Color(0xFF434B4D), // Iron
    1 to Color(0xFFCD7F32), // Bronze
    2 to Color(0xFFB87333), // Copper
    3 to Color(0xFFFFD700), // Gold
    4 to Color(0xFFE5E4E2)  // Platinum
)

data class Gear(
    val id: Int,
    var x: Float,
    var y: Float,
    val radius: Float,
    val teeth: Int,
    var angle: Float,
    var speed: Float,
    var isConnected: Boolean,
    val material: Int, // 0=iron, 1=bronze, 2=copper, 3=gold, 4=platinum
    var isDragging: Boolean = false,
    var depth: Int = 999
)

@Composable
fun GearheartScreen(viewModel: SynthViewModel) {
    val engineStates by viewModel.engineActiveStates.collectAsState()
    val isEngineActive = engineStates[SynthEngine.GEARHEART] ?: false
    
    // Use rememberUpdatedState to always get the latest value inside coroutine
    val currentActiveState by rememberUpdatedState(isEngineActive)
    
    // Frame counter to force recomposition (since Gear properties aren't observable)
    var frameCounter by remember { mutableStateOf(0L) }
    
    // Initial gears
    val gears = remember {
        mutableStateListOf(
            Gear(0, 500f, 1500f, 120f, 12, 0f, 0.02f, true, 0), // Motor (Iron)
            Gear(1, 500f, 1200f, 80f, 8, 0f, 0f, false, 1),    // Bronze
            Gear(2, 300f, 1400f, 60f, 6, 0f, 0f, false, 2),    // Copper
            Gear(3, 700f, 1400f, 100f, 10, 0f, 0f, false, 3),  // Gold
            Gear(4, 500f, 900f, 50f, 5, 0f, 0f, false, 4)      // Platinum
        )
    }

    // Physics Loop for UI Animation & Logic
    LaunchedEffect(Unit) {
        while (true) {
            // 1. Reset speeds (except motor) - use currentActiveState for latest value
            gears[0].isConnected = currentActiveState
            gears[0].speed = if (currentActiveState) 0.02f else 0f
            gears[0].depth = 0
            
            for (i in 1 until gears.size) {
                if (!gears[i].isDragging) {
                    gears[i].isConnected = false
                    gears[i].speed = 0f
                    gears[i].depth = 999
                }
            }

            // 2. Propagation (Flood Fill)
            var changed = true
            var iterations = 0
            while (changed && iterations < 10) {
                changed = false
                iterations++
                
                for (i in 0 until gears.size) {
                    if (!gears[i].isConnected) continue
                    
                    for (j in 0 until gears.size) {
                        if (i == j) continue
                        if (gears[j].isConnected) continue
                        if (gears[j].isDragging) continue
                        
                        val dx = gears[i].x - gears[j].x
                        val dy = gears[i].y - gears[j].y
                        val dist = pyt(dx, dy)
                        val combinedRadius = gears[i].radius + gears[j].radius
                        val margin = 25f // Connection tolerance
                        
                        if (dist < combinedRadius + margin) {
                            gears[j].isConnected = true
                            gears[j].speed = -gears[i].speed * (gears[i].radius / gears[j].radius)
                            gears[j].depth = gears[i].depth + 1
                            changed = true
                        }
                    }
                }
            }
            
            // 3. Update Audio Engine & Animation
            gears.forEach { gear ->
                // Sync with audio engine
                viewModel.updateGear(
                    gear.id, 
                    gear.speed, 
                    gear.isConnected, 
                    gear.material, 
                    gear.radius
                )
                
                // Animate UI
                gear.angle += gear.speed
            }
            
            // Force recomposition
            frameCounter++
            
            delay(16)
        }
    }

    // UI Layout
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(StoneSurface)
    ) {
        // Gears Canvas - reading frameCounter inside draw scope forces redraw
        Canvas(
            modifier = Modifier
                .fillMaxSize()
                .pointerInput(Unit) {
                    detectDragGestures(
                        onDragStart = { offset ->
                            // Find clicked gear (reverse order to pick top)
                            for (i in gears.indices.reversed()) {
                                if (gears[i].id == 0) continue // Motor is fixed
                                
                                val dx = offset.x - gears[i].x
                                val dy = offset.y - gears[i].y
                                if (dx*dx + dy*dy < gears[i].radius * gears[i].radius) {
                                    gears[i].isDragging = true
                                    break
                                }
                            }
                        },
                        onDrag = { change, dragAmount ->
                            change.consume()
                            val gear = gears.find { it.isDragging }
                            if (gear != null) {
                                gear.x += dragAmount.x
                                gear.y += dragAmount.y
                            }
                        },
                        onDragEnd = {
                            gears.forEach { it.isDragging = false }
                        }
                    )
                }
        ) {
            // Reference frameCounter to force redraw on each tick
            @Suppress("UNUSED_VARIABLE")
            val tick = frameCounter
            
            gears.forEach { gear ->
                val center = Offset(gear.x, gear.y)
                
                rotate(degrees = Math.toDegrees(gear.angle.toDouble()).toFloat(), pivot = center) {
                    // Draw Gear Body
                    drawCircle(
                        color = MaterialColors[gear.material] ?: Color.Gray,
                        radius = gear.radius,
                        center = center,
                        alpha = if (gear.isConnected) 1f else 0.4f
                    )
                    
                    // Draw Teeth
                    val teethCount = gear.teeth
                    val toothDepth = 15f
                    for (i in 0 until teethCount) {
                        val angle = (2 * Math.PI * i) / teethCount
                        val tx = center.x + cos(angle) * gear.radius
                        val ty = center.y + sin(angle) * gear.radius
                        val tx2 = center.x + cos(angle) * (gear.radius + toothDepth)
                        val ty2 = center.y + sin(angle) * (gear.radius + toothDepth)
                        
                        drawLine(
                            color = MaterialColors[gear.material] ?: Color.Gray,
                            start = Offset(tx.toFloat(), ty.toFloat()),
                            end = Offset(tx2.toFloat(), ty2.toFloat()),
                            strokeWidth = 8f,
                            alpha = if (gear.isConnected) 1f else 0.4f
                        )
                    }
                    
                    // Draw Axle
                    drawCircle(
                        color = Color.Black.copy(alpha = 0.3f),
                        radius = gear.radius * 0.2f,
                        center = center
                    )
                    
                    // Draw Direction Indicator
                    drawLine(
                        color = Color.White.copy(alpha = 0.5f),
                        start = center,
                        end = Offset(center.x + gear.radius * 0.8f, center.y),
                        strokeWidth = 2f
                    )
                }
            }
        }
        
        // Header (top layer for clicks, but only covers its own area)
        Column(
            modifier = Modifier
                .align(Alignment.TopStart)
                .wrapContentHeight()
                .padding(top = 100.dp) // Increased to clear EngineSelector
        ) {
            EngineHeader(
                title = "GEARHEART",
                isActive = isEngineActive,
                onToggle = { viewModel.toggleEngine(SynthEngine.GEARHEART) },
                modifier = Modifier.padding(16.dp)
            )
        }
    }
}

fun pyt(dx: Float, dy: Float): Float {
    return sqrt(dx*dx + dy*dy)
}
