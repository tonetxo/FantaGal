package com.tonetxo.fantagal.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.unit.dp
import kotlin.math.pow

/**
 * VirtualKeyboard - Simple one-octave keyboard for testing
 */
@Composable
fun VirtualKeyboard(
    onNoteOn: (Float) -> Unit,
    onNoteOff: (Float) -> Unit,
    modifier: Modifier = Modifier,
    startOctave: Int = 4
) {
    // Note frequencies for one octave (C4 to B4 by default)
    val notes = remember(startOctave) {
        listOf(
            "C" to 0, "C#" to 1, "D" to 2, "D#" to 3,
            "E" to 4, "F" to 5, "F#" to 6, "G" to 7,
            "G#" to 8, "A" to 9, "A#" to 10, "B" to 11
        ).map { (name, semitone) ->
            val noteNumber = (startOctave + 1) * 12 + semitone
            val frequency = 440f * 2f.pow((noteNumber - 69) / 12f)
            Triple(name, frequency, name.contains("#"))
        }
    }

    Row(
        modifier = modifier
            .fillMaxWidth()
            .height(150.dp)
            .padding(8.dp),
        horizontalArrangement = Arrangement.SpaceEvenly
    ) {
        notes.filter { !it.third }.forEach { (name, frequency, _) ->
            PianoKey(
                note = name,
                frequency = frequency,
                isBlack = false,
                onNoteOn = onNoteOn,
                onNoteOff = onNoteOff
            )
        }
    }
}

@Composable
private fun PianoKey(
    note: String,
    frequency: Float,
    isBlack: Boolean,
    onNoteOn: (Float) -> Unit,
    onNoteOff: (Float) -> Unit
) {
    val backgroundColor = if (isBlack) Color.Black else Color.White
    val textColor = if (isBlack) Color.White else Color.Black

    Box(
        modifier = Modifier
            .width(40.dp)
            .height(if (isBlack) 80.dp else 120.dp)
            .clip(RoundedCornerShape(bottomStart = 4.dp, bottomEnd = 4.dp))
            .background(backgroundColor)
            .pointerInput(frequency) {
                detectTapGestures(
                    onPress = {
                        onNoteOn(frequency)
                        tryAwaitRelease()
                        onNoteOff(frequency)
                    }
                )
            },
        contentAlignment = Alignment.BottomCenter
    ) {
        Text(
            text = note,
            color = textColor,
            style = MaterialTheme.typography.labelMedium,
            modifier = Modifier.padding(bottom = 4.dp)
        )
    }
}
