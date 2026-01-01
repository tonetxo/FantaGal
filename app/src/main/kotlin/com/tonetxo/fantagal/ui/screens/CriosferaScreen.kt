package com.tonetxo.fantagal.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.tonetxo.fantagal.ui.components.ControlSlider
import com.tonetxo.fantagal.ui.components.VirtualKeyboard
import com.tonetxo.fantagal.ui.theme.CryogenicBlue
import com.tonetxo.fantagal.ui.theme.DeepOcean
import com.tonetxo.fantagal.viewmodel.SynthViewModel

/**
 * CriosferaScreen - Main UI for the Criosfera engine
 *
 * Deep resonance physical modeling synthesizer
 * simulating giant organic pipes in cryogenic methane oceans.
 */
@Composable
fun CriosferaScreen(
    viewModel: SynthViewModel,
    modifier: Modifier = Modifier
) {
    val synthState by viewModel.synthState.collectAsState()
    val isPlaying by viewModel.isPlaying.collectAsState()

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    colors = listOf(DeepOcean, CryogenicBlue)
                )
            )
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Title
            Text(
                text = "CRIOSFERA ARMÓNICA",
                style = MaterialTheme.typography.displayLarge,
                color = MaterialTheme.colorScheme.primary,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(top = 32.dp)
            )

            Text(
                text = "Océanos de Metano Criogénico",
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.7f),
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(top = 8.dp, bottom = 24.dp)
            )

            // Playing indicator
            if (isPlaying) {
                Text(
                    text = "♫ RESONANDO ♫",
                    style = MaterialTheme.typography.labelLarge,
                    color = MaterialTheme.colorScheme.tertiary,
                    modifier = Modifier.padding(bottom = 16.dp)
                )
            }

            // Controls card
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.surface.copy(alpha = 0.8f)
                )
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(
                        text = "Parámetros de Síntesis",
                        style = MaterialTheme.typography.titleLarge,
                        color = MaterialTheme.colorScheme.onSurface
                    )

                    ControlSlider(
                        label = "Presión",
                        value = synthState.pressure,
                        onValueChange = { viewModel.updatePressure(it) }
                    )

                    ControlSlider(
                        label = "Resonancia",
                        value = synthState.resonance,
                        onValueChange = { viewModel.updateResonance(it) }
                    )

                    ControlSlider(
                        label = "Viscosidade",
                        value = synthState.viscosity,
                        onValueChange = { viewModel.updateViscosity(it) }
                    )

                    ControlSlider(
                        label = "Turbulencia",
                        value = synthState.turbulence,
                        onValueChange = { viewModel.updateTurbulence(it) }
                    )

                    ControlSlider(
                        label = "Difusión",
                        value = synthState.diffusion,
                        onValueChange = { viewModel.updateDiffusion(it) }
                    )
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            // Virtual keyboard
            Text(
                text = "Teclado Virtual",
                style = MaterialTheme.typography.titleLarge,
                color = MaterialTheme.colorScheme.onBackground,
                modifier = Modifier.padding(bottom = 8.dp)
            )

            VirtualKeyboard(
                onNoteOn = { frequency -> viewModel.noteOn(frequency) },
                onNoteOff = { frequency -> viewModel.noteOff(frequency) },
                startOctave = 3
            )

            Spacer(modifier = Modifier.height(32.dp))
        }
    }
}
