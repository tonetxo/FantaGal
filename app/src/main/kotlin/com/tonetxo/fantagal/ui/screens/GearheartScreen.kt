package com.tonetxo.fantagal.ui.screens

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tonetxo.fantagal.audio.SynthEngine
import com.tonetxo.fantagal.ui.components.EngineHeader
import com.tonetxo.fantagal.ui.theme.StoneSurface
import com.tonetxo.fantagal.audio.SynthState
import com.tonetxo.fantagal.viewmodel.SynthViewModel
import kotlinx.coroutines.delay
import kotlin.math.*

// Materials
val MaterialColors = mapOf(
    0 to Color(0xFF434B4D), // Iron
    1 to Color(0xFFCD7F32), // Bronze
    2 to Color(0xFFB87333), // Copper
    3 to Color(0xFFFFD700), // Gold
    4 to Color(0xFFE5E4E2)  // Platinum
)

@Composable
fun GearheartScreen(viewModel: SynthViewModel) {
    val synthState by viewModel.synthState.collectAsState()
    val engineStates by viewModel.engineActiveStates.collectAsState()
    val isEngineActive = engineStates[SynthEngine.GEARHEART] ?: false
    
    // Use rememberUpdatedState to always get the latest value inside coroutine
    val currentActiveState by rememberUpdatedState(isEngineActive)
    
    // Frame counter to force recomposition (since Gear properties aren't observable)
    var frameCounter by remember { mutableStateOf(0L) }
    
    // Gears state - initialized purely from native engine to persist across recompositions
    val gears = remember { mutableStateListOf<Gear>() }
    
    // Menu visibility state
    var showMenu by remember { mutableStateOf(false) }

    // Initialize gears from native engine on first composition
    LaunchedEffect(Unit) {
        val nativeGears = viewModel.getGearStates()
        if (nativeGears.isNotEmpty()) {
            gears.clear()
            nativeGears.forEach { g ->
                gears.add(Gear(
                    id = g.id,
                    x = g.x, 
                    y = g.y,
                    radius = g.radius,
                    teeth = g.teeth,
                    angle = 0f, // Angle is transient animation state
                    speed = g.speed,
                    isConnected = g.isConnected,
                    material = g.material,
                    depth = g.depth
                ))
            }
        }
    }

    // Physics Loop for UI Animation & Logic
    LaunchedEffect(Unit) {
        while (true) {
            if (gears.isNotEmpty()) {
                // 1. Reset speeds (except motor) - use currentActiveState for latest value
                gears[0].isConnected = currentActiveState
                gears[0].speed = if (currentActiveState) 0.02f else 0f
                gears[0].depth = 0
            
                // Reset others unless dragging
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
                        gear.radius,
                        gear.depth
                    )
                    
                    // If dragging, persist position to native
                    if (gear.isDragging) {
                        viewModel.updateGearPosition(gear.id, gear.x, gear.y)
                    } else if (frameCounter % 60 == 0L) {
                        // Periodically sync back position to native just in case
                        viewModel.updateGearPosition(gear.id, gear.x, gear.y)
                    }
                    
                    // Animate UI
                    gear.angle += gear.speed
                }
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
        // Gears Canvas
        Canvas(
            modifier = Modifier
                .fillMaxSize()
                .pointerInput(Unit) {
                    detectDragGestures(
                        onDragStart = { offset ->
                            val touchX = offset.x
                            val touchY = offset.y
                            
                            // Check draggable gears (1..4) - reverse to check top-most first
                            for (i in gears.size - 1 downTo 1) {
                                val g = gears[i]
                                val dx = touchX - g.x
                                val dy = touchY - g.y
                                if (pyt(dx, dy) < g.radius) {
                                    g.isDragging = true
                                    break
                                }
                            }
                            
                            // Motor toggle (index 0)
                            val motor = gears[0]
                            val dx = touchX - motor.x
                            val dy = touchY - motor.y
                            if (pyt(dx, dy) < motor.radius * 1.2f) { 
                                viewModel.toggleEngine(SynthEngine.GEARHEART)
                            }
                        },
                        onDrag = { change, dragAmount ->
                            change.consume()
                            gears.find { it.isDragging }?.let { gear ->
                                gear.x += dragAmount.x
                                gear.y += dragAmount.y
                                // Immediate native update for responsiveness
                                viewModel.updateGearPosition(gear.id, gear.x, gear.y)
                            }
                        },
                        onDragEnd = {
                            gears.find { it.isDragging }?.let { 
                                it.isDragging = false
                                viewModel.updateGearPosition(it.id, it.x, it.y)
                            }
                        }
                    )
                }
        ) {
            // Read frameCounter to trigger redraw
            @Suppress("UNUSED_VARIABLE")
            val tick = frameCounter
            
            // Draw Gears
            gears.forEach { gear ->
                drawGear(gear)
            }
        }
        
        // --- Overlay Controls ---
        Column(
            modifier = Modifier
                .align(Alignment.TopStart)
                .wrapContentHeight()
                .padding(top = 80.dp) // Clear global selector
        ) {
            // Header Row: Title + Status + Settings + Menu
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Engine Toggle
                EngineHeader(
                    title = "GEARHEART",
                    isActive = isEngineActive,
                    onToggle = { viewModel.toggleEngine(SynthEngine.GEARHEART) }
                )
                
                // Right side icons
                Row {
                   // Settings Icon (Placeholder for API)
                   androidx.compose.material3.IconButton(onClick = { /* TODO: API Settings */ }) {
                       androidx.compose.material3.Icon(
                           imageVector = androidx.compose.material.icons.Icons.Default.Settings,
                           contentDescription = "Settings",
                           tint = Color.White.copy(alpha = 0.6f)
                       )
                   }
                   
                   // Menu Toggle
                   androidx.compose.material3.IconButton(onClick = { showMenu = !showMenu }) {
                       androidx.compose.material3.Icon(
                           imageVector = androidx.compose.material.icons.Icons.Default.Menu,
                           contentDescription = "Menu",
                           tint = Color.White.copy(alpha = 0.6f)
                       )
                   }
                }
            }
            
            // Parameter Menu (Visible when showMenu is true)
            if (showMenu && isEngineActive) {
                Spacer(modifier = Modifier.height(8.dp))
                Column(
                    modifier = Modifier
                        .padding(horizontal = 16.dp)
                        .fillMaxWidth(0.9f) // Not full width
                        .background(Color.Black.copy(alpha = 0.85f), RoundedCornerShape(12.dp))
                        .padding(16.dp)
                ) {
                    Text("PARÁMETROS GEARHEART", color = Color.Gray, fontSize = 12.sp, modifier = Modifier.padding(bottom = 8.dp))
                    
                    // Independent parameters using per-engine state
                    val gearState by viewModel.getEngineState(SynthEngine.GEARHEART).collectAsState()
                    
                    ParamSlider("ROZAMENTO", gearState.pressure) { 
                        viewModel.updateEngineParameter(SynthEngine.GEARHEART, "pressure", it)
                    }
                    ParamSlider("REVERBERACIÓN", gearState.resonance) { 
                        viewModel.updateEngineParameter(SynthEngine.GEARHEART, "resonance", it)
                    }
                    ParamSlider("LUBRICACIÓN", gearState.viscosity) { 
                        viewModel.updateEngineParameter(SynthEngine.GEARHEART, "viscosity", it)
                    }
                    ParamSlider("VELOCIDADE", gearState.turbulence) { 
                        viewModel.updateEngineParameter(SynthEngine.GEARHEART, "turbulence", it)
                    }
                    ParamSlider("DIFUSIÓN METÁLICA", gearState.diffusion) { 
                        viewModel.updateEngineParameter(SynthEngine.GEARHEART, "diffusion", it)
                    }
                }
            }
        }
    }
}

@Composable
fun ParamSlider(label: String, value: Float, onValueChange: (Float) -> Unit) {
    Column(modifier = Modifier.padding(vertical = 4.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(label, color = Color.White, fontSize = 10.sp)
            Text(String.format("%.2f", value), color = Color.Gray, fontSize = 10.sp)
        }
        Slider(
            value = value,
            onValueChange = onValueChange,
            colors = SliderDefaults.colors(
                thumbColor = Color(0xFFCD7F32),
                activeTrackColor = Color(0xFFCD7F32),
                inactiveTrackColor = Color.DarkGray
            ),
            modifier = Modifier.height(20.dp)
        )
    }
}

// Data class
data class Gear(
    val id: Int,
    var x: Float,
    var y: Float,
    val radius: Float,
    val teeth: Int,
    var angle: Float,
    var speed: Float,
    var isConnected: Boolean,
    val material: Int,
    var depth: Int = 0,
    var isDragging: Boolean = false
)

// Helper math
fun pyt(dx: Float, dy: Float): Float = sqrt(dx*dx + dy*dy)

fun DrawScope.drawGear(gear: Gear) {
    val color = MaterialColors[gear.material] ?: Color.Gray
    
    // Rotate canvas for this gear
    rotate(degrees = Math.toDegrees(gear.angle.toDouble()).toFloat(), pivot = Offset(gear.x, gear.y)) {
        // Teeth
        val outerRadius = gear.radius
        val innerRadius = gear.radius - 8f
        val teethCount = gear.teeth
        
        val path = Path()
        for (i in 0 until teethCount * 2) {
            val angle = (PI * 2 * i) / (teethCount * 2)
            val r = if (i % 2 == 0) outerRadius else innerRadius
            val x = gear.x + cos(angle).toFloat() * r
            val y = gear.y + sin(angle).toFloat() * r
            if (i == 0) path.moveTo(x, y) else path.lineTo(x, y)
        }
        path.close()
        
        // Body fill
        drawPath(path, color, alpha = if (gear.isConnected) 1f else 0.7f)
        // Outline
        drawPath(path, color.copy(alpha = 0.5f), style = Stroke(width = 2f))
        
        // Axle (Wood/Metal look)
        drawCircle(
            brush = Brush.radialGradient(
                colors = listOf(Color(0xFF8B5A2B), Color(0xFF362312)),
                center = Offset(gear.x, gear.y),
                radius = 15f
            ),
            radius = 15f,
            center = Offset(gear.x, gear.y)
        )
        
        // Connection indicator (River/Bolt)
        if (gear.isConnected) {
            drawCircle(
                color = Color.White,
                radius = 4f,
                center = Offset(gear.x, gear.y - innerRadius + 8f)
            )
        }
    }
}
