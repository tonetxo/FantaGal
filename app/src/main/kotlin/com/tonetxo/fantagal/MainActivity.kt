package com.tonetxo.fantagal

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import com.tonetxo.fantagal.ui.screens.MainScreen
import com.tonetxo.fantagal.ui.theme.FantaGalTheme
import com.tonetxo.fantagal.viewmodel.SynthViewModel

/**
 * MainActivity - Entry point for FantaGal
 */
class MainActivity : ComponentActivity() {

    private val viewModel: SynthViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        setContent {
            FantaGalTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    MainScreen(viewModel = viewModel)
                }
            }
        }
    }
}
