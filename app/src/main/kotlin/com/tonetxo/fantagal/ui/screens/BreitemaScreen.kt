package com.tonetxo.fantagal.ui.screens

import androidx.compose.animation.core.*
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Settings

import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.*
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tonetxo.fantagal.audio.SynthEngine
import com.tonetxo.fantagal.ui.components.EngineHeader
import com.tonetxo.fantagal.ui.theme.BreitemaBlue
import com.tonetxo.fantagal.ui.theme.StoneBackground
import com.tonetxo.fantagal.viewmodel.SynthViewModel
import kotlinx.coroutines.delay

@Composable
fun BreitemaScreen(
    viewModel: SynthViewModel,
    modifier: Modifier = Modifier
) {
    val breitemaState by viewModel.breitemaState.collectAsState()
    val engineActiveStates by viewModel.engineActiveStates.collectAsState()
    val isEngineActive = engineActiveStates[SynthEngine.BREITEMA] ?: false
    val synthState by viewModel.getEngineState(SynthEngine.BREITEMA).collectAsState()

    // Menu visibility state
    var showMenu by remember { mutableStateOf(false) }

    // Polling effect for sequencer state
    LaunchedEffect(isEngineActive) {
        while (isEngineActive) {
            viewModel.updateBreitemaState()
            delay(50) // 20fps for UI sync is enough
        }
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(StoneBackground)
    ) {
        // --- Fog Visuals (Canvas) ---
        BreitemaFogVisuals(
            density = breitemaState.fogDensity,
            movement = breitemaState.fogMovement,
            fmDepth = breitemaState.fmDepth,
            currentStep = breitemaState.currentStep,
            isPlaying = breitemaState.isPlaying
        )

        // --- Main Content ---
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(top = 100.dp, start = 16.dp, end = 16.dp, bottom = 16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Header row with gear and menu
            Row(
                modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                EngineHeader(
                    title = "BRÉTEMA",
                    isActive = isEngineActive,
                    onToggle = { viewModel.toggleEngine(SynthEngine.BREITEMA) }
                )

                // Settings and menu buttons
                Row {
                    IconButton(onClick = { /* Settings - No action as in other engines */ }) {
                        Icon(
                            imageVector = Icons.Default.Settings,
                            contentDescription = "Settings",
                            tint = Color.White.copy(alpha = 0.6f)
                        )
                    }
                    IconButton(onClick = { showMenu = !showMenu }) {
                        Icon(
                            imageVector = Icons.Default.Menu,
                            contentDescription = "Menu",
                            tint = Color.White.copy(alpha = 0.6f)
                        )
                    }
                }
            }

            // Parameter Menu (Independent sliders)
            if (showMenu && isEngineActive) {
                Spacer(modifier = Modifier.height(8.dp))
                Column(
                    modifier = Modifier
                        .fillMaxWidth(0.9f)
                        .background(Color.Black.copy(alpha = 0.85f), RoundedCornerShape(12.dp))
                        .padding(16.dp)
                ) {
                    Text("PARÁMETROS BRÉTEMA", color = Color.Gray, fontSize = 12.sp, modifier = Modifier.padding(bottom = 8.dp))
                    
                    BreitemaParamSlider("PRESIÓN", synthState.pressure) { 
                        viewModel.updateEngineParameter(SynthEngine.BREITEMA, "pressure", it)
                    }
                    BreitemaParamSlider("RESONANCIA", synthState.resonance) { 
                        viewModel.updateEngineParameter(SynthEngine.BREITEMA, "resonance", it)
                    }
                    BreitemaParamSlider("VISCOSIDADE", synthState.viscosity) { 
                        viewModel.updateEngineParameter(SynthEngine.BREITEMA, "viscosity", it)
                    }
                    BreitemaParamSlider("TORMENTA", synthState.turbulence) { 
                        viewModel.updateEngineParameter(SynthEngine.BREITEMA, "turbulence", it)
                    }
                    BreitemaParamSlider("DIFUSIÓN", synthState.diffusion) { 
                        viewModel.updateEngineParameter(SynthEngine.BREITEMA, "diffusion", it)
                    }
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            // Rhythm Modes
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.Center
            ) {
                RhythmModeButton("LIBRE", 0, breitemaState.rhythmMode) { viewModel.setBreitemaRhythmMode(0) }
                Spacer(modifier = Modifier.width(8.dp))
                RhythmModeButton("MUIÑEIRA", 1, breitemaState.rhythmMode) { viewModel.setBreitemaRhythmMode(1) }
                Spacer(modifier = Modifier.width(8.dp))
                RhythmModeButton("RIBEIRADA", 2, breitemaState.rhythmMode) { viewModel.setBreitemaRhythmMode(2) }
            }

            Spacer(modifier = Modifier.height(32.dp))

            // Step Grid
            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth(),
                contentAlignment = Alignment.Center
            ) {
                LazyVerticalGrid(
                    columns = GridCells.Fixed(4),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    modifier = Modifier.width(280.dp)
                ) {
                    items(16) { index ->
                        val isActive = breitemaState.steps.getOrElse(index) { false }
                        val isCurrent = breitemaState.currentStep == index && breitemaState.isPlaying
                        val prob = breitemaState.stepProbabilities.getOrElse(index) { 0f }

                        StepButton(
                            index = index,
                            isActive = isActive,
                            isCurrent = isCurrent,
                            probability = prob,
                            onClick = { viewModel.toggleBreitemaStep(index) }
                        )
                    }
                }
            }

            // Transport Controls
            Row(
                modifier = Modifier.padding(vertical = 24.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Button(
                    onClick = { viewModel.setBreitemaPlaying(!breitemaState.isPlaying) },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (breitemaState.isPlaying) Color.Red.copy(alpha = 0.2f) else BreitemaBlue.copy(alpha = 0.2f),
                        contentColor = if (breitemaState.isPlaying) Color.Red else BreitemaBlue
                    ),
                    border = BorderStroke(2.dp, if (breitemaState.isPlaying) Color.Red else BreitemaBlue),
                    shape = RoundedCornerShape(24.dp),
                    modifier = Modifier.height(56.dp).width(160.dp)
                ) {
                    Text(
                        text = if (breitemaState.isPlaying) "⏹ PARAR" else "▶ INICIAR",
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 2.sp
                    )
                }

                Spacer(modifier = Modifier.width(16.dp))

                OutlinedButton(
                    onClick = { viewModel.regenerateBreitemaPattern() },
                    shape = CircleShape,
                    border = BorderStroke(1.dp, Color.White.copy(alpha = 0.3f)),
                    modifier = Modifier.size(56.dp),
                    contentPadding = PaddingValues(0.dp)
                ) {
                    Text("🎲", fontSize = 20.sp)
                }
            }
        }

        // VHS Scanlines Overlay
        VhsScanlines()
    }
}

@Composable
fun RhythmModeButton(label: String, mode: Int, currentMode: Int, onClick: () -> Unit) {
    val isSelected = mode == currentMode
    Surface(
        onClick = onClick,
        color = if (isSelected) BreitemaBlue.copy(alpha = 0.15f) else Color.Transparent,
        shape = RoundedCornerShape(8.dp),
        border = BorderStroke(1.dp, if (isSelected) BreitemaBlue else Color.Transparent)
    ) {
        Text(
            text = label,
            color = if (isSelected) BreitemaBlue else Color.Gray,
            fontSize = 10.sp,
            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp)
        )
    }
}

@Composable
fun StepButton(
    index: Int,
    isActive: Boolean,
    isCurrent: Boolean,
    probability: Float,
    onClick: () -> Unit
) {
    val color = when {
        isActive && isCurrent -> BreitemaBlue
        isActive -> BreitemaBlue.copy(alpha = 0.6f)
        isCurrent -> Color.White.copy(alpha = 0.3f)
        else -> Color.White.copy(alpha = 0.05f)
    }
    
    val borderColor = when {
        isActive && isCurrent -> Color.White
        isActive -> BreitemaBlue.copy(alpha = 0.4f)
        else -> Color.White.copy(alpha = 0.1f)
    }

    Box(
        modifier = Modifier
            .size(60.dp)
            .clip(RoundedCornerShape(8.dp))
            .background(Color.Black.copy(alpha = 0.4f))
            .border(1.dp, borderColor, RoundedCornerShape(8.dp))
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        // Probability bar
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .fillMaxHeight(probability)
                .align(Alignment.BottomCenter)
                .background(BreitemaBlue.copy(alpha = 0.15f))
        )

        // Main background if active
        if (isActive || isCurrent) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(color)
            )
        }

        Text(
            text = (index + 1).toString(),
            color = if (isActive || isCurrent) Color.Black.copy(alpha = 0.5f) else Color.White.copy(alpha = 0.2f),
            fontSize = 12.sp
        )
    }
}

@Composable
fun BreitemaFogVisuals(
    density: Float,
    movement: Float,
    fmDepth: Float,
    currentStep: Int,
    isPlaying: Boolean
) {
    val infiniteTransition = rememberInfiniteTransition()
    
    val fogMove by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween((10000 / (movement + 0.1f)).toInt(), easing = LinearEasing),
            repeatMode = RepeatMode.Reverse
        )
    )

    val fogRotate by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(
            animation = tween((20000 / (movement + 0.1f)).toInt(), easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        )
    )

    Canvas(modifier = Modifier.fillMaxSize().blur(40.dp)) {
        val center = Offset(size.width / 2, size.height / 2)
        val radius = size.minDimension * 0.8f
        
        val baseColor = if (fmDepth > 250f) Color(0xFFA855F7) else BreitemaBlue
        val opacity = density * (0.3f + if (isPlaying && (currentStep % 4 == 0)) 0.2f else 0f)

        // Fog Layer 1
        rotate(fogRotate, center) {
            drawCircle(
                brush = Brush.radialGradient(
                    colors = listOf(baseColor.copy(alpha = opacity), Color.Transparent),
                    center = center.copy(x = center.x + (fogMove * 100f)),
                    radius = radius
                ),
                radius = radius,
                center = center
            )
        }

        // Fog Layer 2
        drawCircle(
            brush = Brush.radialGradient(
                colors = listOf(baseColor.copy(alpha = opacity * 0.5f), Color.Transparent),
                center = center.copy(y = center.y - (fogMove * 150f)),
                radius = radius * 1.5f
            ),
            radius = radius * 1.5f,
            center = center
        )
    }
}

@Composable
fun VhsScanlines() {
    Canvas(modifier = Modifier.fillMaxSize()) {
        val scanlineHeight = 4.dp.toPx()
        val count = (size.height / scanlineHeight).toInt()
        
        for (i in 0 until count step 2) {
            drawRect(
                color = Color.Black.copy(alpha = 0.03f),
                topLeft = Offset(0f, i * scanlineHeight),
                size = Size(size.width, scanlineHeight)
            )
        }
    }
}

@Composable
fun BreitemaParamSlider(label: String, value: Float, onValueChange: (Float) -> Unit) {
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
                thumbColor = BreitemaBlue,
                activeTrackColor = BreitemaBlue,
                inactiveTrackColor = Color.DarkGray
            ),
            modifier = Modifier.height(20.dp)
        )
    }
}
