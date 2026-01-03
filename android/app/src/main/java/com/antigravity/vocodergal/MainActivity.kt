package com.antigravity.vocodergal

import android.Manifest
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.core.content.ContextCompat
import com.antigravity.vocodergal.ui.VocoderScreen
import com.antigravity.vocodergal.ui.theme.VocoderGalTheme
import com.antigravity.vocodergal.viewmodel.VocoderViewModel

class MainActivity : ComponentActivity() {
    
    companion object {
        private const val TAG = "VocoderGal"
    }
    
    private val viewModel: VocoderViewModel by viewModels()
    
    private val requestPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        Log.d(TAG, "Permission result: $isGranted")
        if (isGranted) {
            viewModel.onPermissionGranted()
        }
    }

    private val selectFileLauncher = registerForActivityResult(
        ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        uri?.let {
            viewModel.loadAudioFile(this, it)
        }
    }
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        if (hasMicrophonePermission()) {
            viewModel.onPermissionGranted()
        } else {
            requestPermissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
        }
        
        setContent {
            VocoderGalTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    VocoderScreen(
                        viewModel = viewModel,
                        onLoadFile = { selectFileLauncher.launch("audio/*") }
                    )
                }
            }
        }
    }
    
    private fun hasMicrophonePermission(): Boolean {
        return ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.RECORD_AUDIO
        ) == PackageManager.PERMISSION_GRANTED
    }
}
