package com.tonetxo.fantagal.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tonetxo.fantagal.audio.SynthEngine
import com.tonetxo.fantagal.ui.theme.*

/**
 * Engine selector navbar with horizontal tabs
 */
@Composable
fun EngineSelector(
    currentEngine: SynthEngine,
    onEngineChange: (SynthEngine) -> Unit,
    modifier: Modifier = Modifier
) {
    val engines = listOf(
        EngineTab(SynthEngine.CRIOSFERA, "CRIOSFERA", StoneSurfaceVariant, CriosferaPrimary),
        EngineTab(SynthEngine.GEARHEART, "GEARHEART", Color(0xFF3A2E26), GearheartGold),
        EngineTab(SynthEngine.ECHO_VESSEL, "ECHO VESSEL", Color(0xFF164E63), EchoVesselCyan),
        EngineTab(SynthEngine.VOCODER, "VOCODER", Color(0xFF064E3B), VocoderGreen),
        EngineTab(SynthEngine.BREITEMA, "BRÉTEMA", Color(0xFF1E2430), BreitemaBlue),
    )

    Box(
        modifier = modifier
            .fillMaxWidth()
            .padding(top = 12.dp),
        contentAlignment = Alignment.TopCenter
    ) {
        Row(
            modifier = Modifier
                .clip(RoundedCornerShape(24.dp))
                .background(Color.Black.copy(alpha = 0.4f))
                .padding(4.dp)
                .horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            engines.forEach { tab ->
                val isSelected = currentEngine == tab.engine
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(20.dp))
                        .background(if (isSelected) tab.backgroundColor else Color.Transparent)
                        .clickable { onEngineChange(tab.engine) }
                        .padding(horizontal = 12.dp, vertical = 6.dp)
                ) {
                    Text(
                        text = tab.label,
                        fontSize = 9.sp,
                        fontWeight = FontWeight.Medium,
                        letterSpacing = 1.sp,
                        color = if (isSelected) tab.textColor else Color.White.copy(alpha = 0.5f)
                    )
                }
            }
        }
    }
}

private data class EngineTab(
    val engine: SynthEngine,
    val label: String,
    val backgroundColor: Color,
    val textColor: Color
)
