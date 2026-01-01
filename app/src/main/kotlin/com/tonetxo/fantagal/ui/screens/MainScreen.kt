package com.tonetxo.fantagal.ui.screens

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import com.tonetxo.fantagal.audio.SynthEngine
import com.tonetxo.fantagal.ui.components.EngineSelector
import com.tonetxo.fantagal.viewmodel.SynthViewModel

/**
 * MainScreen - Top level container with Engine Routing
 */
@Composable
fun MainScreen(
    viewModel: SynthViewModel,
    modifier: Modifier = Modifier
) {
    val currentEngine by viewModel.currentEngine.collectAsState()

    Box(modifier = modifier.fillMaxSize()) {
        // Content Layer - Matches current engine
        when (currentEngine) {
            SynthEngine.CRIOSFERA -> CriosferaScreen(viewModel = viewModel)
            SynthEngine.GEARHEART -> GearheartScreen(viewModel = viewModel)
            else -> {
                // Placeholder/Fallback to Criosfera
                CriosferaScreen(viewModel = viewModel)
            }
        }
        
        // Navigation Layer at Top - ALWAYS VISIBLE
        EngineSelector(
            currentEngine = currentEngine,
            onEngineChange = { viewModel.switchEngine(it) },
            modifier = Modifier.align(Alignment.TopCenter)
        )
    }
}
