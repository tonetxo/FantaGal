package com.tonetxo.fantagal.ui.screens

import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tonetxo.fantagal.audio.SynthEngine
import com.tonetxo.fantagal.ui.components.EngineHeader
import com.tonetxo.fantagal.ui.components.ParameterSlider
import com.tonetxo.fantagal.ui.theme.StoneBackground
import com.tonetxo.fantagal.ui.theme.VocoderGreen
import com.tonetxo.fantagal.viewmodel.SynthViewModel

@Composable
fun VocoderScreen(
    viewModel: SynthViewModel,
    modifier: Modifier = Modifier
) {
    val vocoderState by viewModel.vocoderState.collectAsState()
    val engineActiveStates by viewModel.engineActiveStates.collectAsState()
    val isEngineActive = engineActiveStates[SynthEngine.VOCODER] ?: false
    val engineState by viewModel.getEngineState(SynthEngine.VOCODER).collectAsState()

    var showMenu by remember { mutableStateOf(false) }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(StoneBackground)
    ) {
        // --- Vocoder Content ---
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
                    title = "VOCODER",
                    isActive = isEngineActive,
                    onToggle = { viewModel.toggleEngine(SynthEngine.VOCODER) }
                )

                Row {
                    IconButton(onClick = { /* Settings */ }) {
                        Icon(
                            imageVector = Icons.Default.Settings,
                            contentDescription = "Settings",
                            tint = VocoderGreen.copy(alpha = 0.6f)
                        )
                    }
                    IconButton(onClick = { showMenu = !showMenu }) {
                        Icon(
                            imageVector = Icons.Default.Menu,
                            contentDescription = "Menu",
                            tint = VocoderGreen.copy(alpha = 0.6f)
                        )
                    }
                }
            }

            // Parameter Menu (Independent sliders)
            if (showMenu && isEngineActive) {
                Column(
                    modifier = Modifier
                        .padding(bottom = 16.dp)
                        .fillMaxWidth(0.9f)
                        .background(Color.Black.copy(alpha = 0.85f), RoundedCornerShape(12.dp))
                        .padding(16.dp)
                ) {
                    Text("PARÁMETROS VOCODER", color = Color.Gray, fontSize = 12.sp, modifier = Modifier.padding(bottom = 8.dp))
                    
                    ParameterSlider("PRESIÓN (GAIN)", engineState.pressure, { 
                        viewModel.updateEngineParameter(SynthEngine.VOCODER, "pressure", it)
                    }, accentColor = VocoderGreen)
                    ParameterSlider("RESONANCIA (Q)", engineState.resonance, { 
                        viewModel.updateEngineParameter(SynthEngine.VOCODER, "resonance", it)
                    }, accentColor = VocoderGreen)
                    ParameterSlider("VISCOSIDADE (GATE)", engineState.viscosity, { 
                        viewModel.updateEngineParameter(SynthEngine.VOCODER, "viscosity", it)
                    }, accentColor = VocoderGreen)
                    ParameterSlider("TORMENTA (MIX)", engineState.turbulence, { 
                        viewModel.updateEngineParameter(SynthEngine.VOCODER, "turbulence", it)
                    }, accentColor = VocoderGreen)
                    ParameterSlider("DIFUSIÓN (OUTPUT)", engineState.diffusion, { 
                        viewModel.updateEngineParameter(SynthEngine.VOCODER, "diffusion", it)
                    }, accentColor = VocoderGreen)
                }
            }

            Spacer(modifier = Modifier.weight(1f))

            // --- Recording Control ---
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.padding(bottom = 32.dp)
            ) {
                Text(
                    text = if (vocoderState.isRecording) "GRABANDO..." else if (vocoderState.hasModulator) "MODULADOR CARGADO" else "SIN MODULADOR",
                    color = if (vocoderState.isRecording) Color.Red else VocoderGreen,
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp
                )
                
                //VU Meter
                VUMeter(level = vocoderState.vuLevel, modifier = Modifier.padding(horizontal = 32.dp))
                
                Spacer(modifier = Modifier.height(16.dp))

                Box(
                    modifier = Modifier
                        .size(80.dp)
                        .clip(CircleShape)
                        .background(if (vocoderState.isRecording) Color.Red.copy(alpha = 0.2f) else VocoderGreen.copy(alpha = 0.1f))
                        .border(2.dp, if (vocoderState.isRecording) Color.Red else VocoderGreen, CircleShape)
                        .clickable { viewModel.toggleVocoderRecording() },
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = if (vocoderState.isRecording) Icons.Default.Stop else Icons.Default.Mic,
                        contentDescription = "Record",
                        modifier = Modifier.size(40.dp),
                        tint = if (vocoderState.isRecording) Color.Red else VocoderGreen
                    )
                }
                
                if (vocoderState.hasModulator) {
                    Text(
                        text = "Longitud: ${String.format("%.1f", vocoderState.modulatorLength / 48000f)}s",
                        color = Color.Gray,
                        fontSize = 10.sp,
                        modifier = Modifier.padding(top = 8.dp)
                    )
                }
                
                // Error display
                vocoderState.error?.let { error ->
                    Text(
                        text = error,
                        color = Color.Red,
                        fontSize = 12.sp,
                        modifier = Modifier.padding(top = 8.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(100.dp)) // Piano spacing
        }
    }
}

@Composable
fun VUMeter(level: Float, modifier: Modifier = Modifier) {
    val animatedLevel by animateFloatAsState(
        targetValue = level.coerceIn(0f, 1f),
        animationSpec = spring(stiffness = Spring.StiffnessLow),
        label = "VU Level"
    )

    Column(modifier = modifier.fillMaxWidth()) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(8.dp)
                .background(Color.Black.copy(alpha = 0.3f), RoundedCornerShape(4.dp))
        ) {
            Box(
                modifier = Modifier
                    .fillMaxWidth(animatedLevel)
                    .fillMaxHeight()
                    .background(
                        brush = androidx.compose.ui.graphics.Brush.horizontalGradient(
                            colors = listOf(VocoderGreen.copy(alpha = 0.5f), VocoderGreen)
                        ),
                        shape = RoundedCornerShape(4.dp)
                    )
            )
        }
    }
}
