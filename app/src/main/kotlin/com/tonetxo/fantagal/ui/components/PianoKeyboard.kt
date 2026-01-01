package com.tonetxo.fantagal.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tonetxo.fantagal.ui.theme.CriosferaPrimary
import com.tonetxo.fantagal.ui.theme.StoneBackground

/**
 * Piano keyboard with toggle behavior (tap to start, tap again to stop)
 * Notes: C2, G2, C3, Eb3, G3, Bb3, C4
 */
@Composable
fun PianoKeyboard(
    activeNotes: Set<Float>,
    onNoteToggle: (Float) -> Unit,
    modifier: Modifier = Modifier
) {
    val notes = remember {
        listOf(
            Note("C2", 65.41f),
            Note("G2", 98.00f),
            Note("C3", 130.81f),
            Note("Eb3", 155.56f),
            Note("G3", 196.00f),
            Note("Bb3", 233.08f),
            Note("C4", 261.63f)
        )
    }

    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 8.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.SpaceEvenly
    ) {
        notes.forEach { note ->
            PianoKey(
                label = note.label,
                frequency = note.frequency,
                isActive = activeNotes.contains(note.frequency),
                onToggle = { onNoteToggle(note.frequency) }
            )
        }
    }
}

@Composable
private fun PianoKey(
    label: String,
    frequency: Float,
    isActive: Boolean,
    onToggle: () -> Unit
) {
    val activeColor = Color(0xFF22C55E) // green-500
    val inactiveGradient = Brush.verticalGradient(
        colors = listOf(
            CriosferaPrimary.copy(alpha = 0.8f),
            CriosferaPrimary.copy(alpha = 0.4f),
            StoneBackground.copy(alpha = 0.9f)
        )
    )
    val activeGradient = Brush.verticalGradient(
        colors = listOf(
            activeColor,
            activeColor.copy(alpha = 0.7f),
            activeColor.copy(alpha = 0.4f)
        )
    )

    Box(
        modifier = Modifier
            .width(48.dp)
            .height(80.dp)
            .clip(RoundedCornerShape(topStart = 4.dp, topEnd = 4.dp, bottomStart = 8.dp, bottomEnd = 8.dp))
            .background(if (isActive) activeGradient else inactiveGradient)
            .clickable { onToggle() },
        contentAlignment = Alignment.BottomCenter
    ) {
        Text(
            text = label,
            fontSize = 14.sp,
            fontWeight = FontWeight.Bold,
            color = Color.White.copy(alpha = 0.9f),
            modifier = Modifier.padding(bottom = 8.dp)
        )
    }
}

private data class Note(
    val label: String,
    val frequency: Float
)
