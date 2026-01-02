package com.tonetxo.fantagal.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tonetxo.fantagal.ui.components.AudioVisualizer
import com.tonetxo.fantagal.ui.components.EngineHeader
import com.tonetxo.fantagal.ui.components.ParameterDropdown
import com.tonetxo.fantagal.ui.components.PianoKeyboard
import com.tonetxo.fantagal.ui.components.XYPad
import com.tonetxo.fantagal.ui.theme.CriosferaPrimary
import com.tonetxo.fantagal.ui.theme.StoneBackground
import com.tonetxo.fantagal.viewmodel.SynthViewModel
import com.tonetxo.fantagal.audio.SynthEngine

/**
 * Criosfera specific UI content
 */
@Composable
fun CriosferaScreen(
    viewModel: SynthViewModel,
    modifier: Modifier = Modifier
) {
    val synthState by viewModel.synthState.collectAsState()
    val engineStates by viewModel.engineActiveStates.collectAsState()
    val isEngineActive = engineStates[SynthEngine.CRIOSFERA] ?: false
    val activeNotes by viewModel.activeNotes.collectAsState()

    // XY pad parameter selection
    val parameters = listOf("Presión", "Resonancia", "Viscosidade", "Turbulencia", "Difusión")
    var xParam by remember { mutableStateOf("Resonancia") }
    var yParam by remember { mutableStateOf("Presión") }

    // XY values mapped to selected parameters
    var xValue by remember { mutableStateOf(synthState.resonance) }
    var yValue by remember { mutableStateOf(synthState.pressure) }
    
    // Menu visibility state
    var showMenu by remember { mutableStateOf(false) }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(StoneBackground)
    ) {
        // Visualizer background
        AudioVisualizer(
            turbulence = synthState.turbulence,
            viscosity = synthState.viscosity,
            pressure = synthState.pressure,
            modifier = Modifier.fillMaxSize()
        )

        // Content overlay
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(top = 100.dp) // Increased to clear EngineSelector
        ) {
            // Header row with tappable title to toggle engine
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Engine title with status indicator - TAP TO TOGGLE
                EngineHeader(
                    title = "CRIOSFERA",
                    isActive = isEngineActive,
                    onToggle = { viewModel.toggleEngine(SynthEngine.CRIOSFERA) }
                )

                // Settings and menu buttons
                Row {
                    IconButton(onClick = { /* Settings */ }) {
                        Icon(
                            imageVector = Icons.Default.Settings,
                            contentDescription = "Settings",
                            tint = CriosferaPrimary.copy(alpha = 0.6f)
                        )
                    }
                    IconButton(onClick = { showMenu = !showMenu }) {
                        Icon(
                            imageVector = Icons.Default.Menu,
                            contentDescription = "Menu",
                            tint = CriosferaPrimary.copy(alpha = 0.6f)
                        )
                    }
                }
            }
            
            // Parameter Menu (Independent sliders)
            if (showMenu && isEngineActive) {
                val crioState by viewModel.getEngineState(SynthEngine.CRIOSFERA).collectAsState()
                Column(
                    modifier = Modifier
                        .padding(horizontal = 16.dp)
                        .fillMaxWidth(0.9f)
                        .background(Color.Black.copy(alpha = 0.85f), RoundedCornerShape(12.dp))
                        .padding(16.dp)
                ) {
                    Text("PARÁMETROS CRIOSFERA", color = Color.Gray, fontSize = 12.sp, modifier = Modifier.padding(bottom = 8.dp))
                    
                    CrioParamSlider("PRESIÓN", crioState.pressure) { 
                        viewModel.updateEngineParameter(SynthEngine.CRIOSFERA, "pressure", it)
                    }
                    CrioParamSlider("RESONANCIA", crioState.resonance) { 
                        viewModel.updateEngineParameter(SynthEngine.CRIOSFERA, "resonance", it)
                    }
                    CrioParamSlider("VISCOSIDADE", crioState.viscosity) { 
                        viewModel.updateEngineParameter(SynthEngine.CRIOSFERA, "viscosity", it)
                    }
                    CrioParamSlider("TORMENTA", crioState.turbulence) { 
                        viewModel.updateEngineParameter(SynthEngine.CRIOSFERA, "turbulence", it)
                    }
                    CrioParamSlider("DIFUSIÓN", crioState.diffusion) { 
                        viewModel.updateEngineParameter(SynthEngine.CRIOSFERA, "diffusion", it)
                    }
                }
                Spacer(modifier = Modifier.height(8.dp))
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Parameter dropdowns
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                ParameterDropdown(
                    selectedParam = yParam,
                    options = parameters,
                    onSelect = { yParam = it }
                )
                ParameterDropdown(
                    selectedParam = xParam,
                    options = parameters,
                    onSelect = { xParam = it }
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            // XY Pad - expanded to fill most of the space
            XYPad(
                xValue = xValue,
                yValue = yValue,
                xLabel = xParam.uppercase(),
                yLabel = yParam.uppercase(),
                onValueChange = { x, y ->
                    xValue = x
                    yValue = y
                    // Map to selected parameters (ENGINE-SPECIFIC)
                    when (xParam) {
                        "Presión" -> viewModel.updateEngineParameter(SynthEngine.CRIOSFERA, "pressure", x)
                        "Resonancia" -> viewModel.updateEngineParameter(SynthEngine.CRIOSFERA, "resonance", x)
                        "Viscosidade" -> viewModel.updateEngineParameter(SynthEngine.CRIOSFERA, "viscosity", x)
                        "Turbulencia" -> viewModel.updateEngineParameter(SynthEngine.CRIOSFERA, "turbulence", x)
                        "Difusión" -> viewModel.updateEngineParameter(SynthEngine.CRIOSFERA, "diffusion", x)
                    }
                    when (yParam) {
                        "Presión" -> viewModel.updateEngineParameter(SynthEngine.CRIOSFERA, "pressure", y)
                        "Resonancia" -> viewModel.updateEngineParameter(SynthEngine.CRIOSFERA, "resonance", y)
                        "Viscosidade" -> viewModel.updateEngineParameter(SynthEngine.CRIOSFERA, "viscosity", y)
                        "Turbulencia" -> viewModel.updateEngineParameter(SynthEngine.CRIOSFERA, "turbulence", y)
                        "Difusión" -> viewModel.updateEngineParameter(SynthEngine.CRIOSFERA, "diffusion", y)
                    }
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f) // Take all remaining space
                    .padding(horizontal = 16.dp)
            )

            Spacer(modifier = Modifier.height(8.dp))

            // Piano keyboard with toggle behavior
            PianoKeyboard(
                activeNotes = activeNotes,
                onNoteToggle = { frequency -> viewModel.toggleNote(frequency) },
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.height(8.dp))
        }
    }
}

@Composable
fun CrioParamSlider(label: String, value: Float, onValueChange: (Float) -> Unit) {
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
                thumbColor = CriosferaPrimary,
                activeTrackColor = CriosferaPrimary,
                inactiveTrackColor = Color.DarkGray
            ),
            modifier = Modifier.height(20.dp)
        )
    }
}
