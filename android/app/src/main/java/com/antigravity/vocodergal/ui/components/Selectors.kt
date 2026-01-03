package com.antigravity.vocodergal.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.antigravity.vocodergal.ui.theme.*
import kotlin.math.sin

/**
 * Selector de forma de onda con representacións gráficas.
 */
@Composable
fun WaveformSelector(
    selected: Int,
    onSelect: (Int) -> Unit,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceEvenly
    ) {
        for (index in 0..3) {
            WaveformButton(
                type = index,
                isSelected = index == selected,
                onClick = { onSelect(index) }
            )
        }
    }
}

@Composable
private fun WaveformButton(
    type: Int,
    isSelected: Boolean,
    onClick: () -> Unit
) {
    Box(
        modifier = Modifier
            .size(54.dp) // Un pouco máis pequeno para que caiba mellor
            .clip(RoundedCornerShape(8.dp))
            .background(
                if (isSelected) {
                    Brush.verticalGradient(listOf(BronzeGold, DarkBronze))
                } else {
                    Brush.verticalGradient(listOf(SteamGray, DarkWood))
                }
            )
            .border(2.dp, if (isSelected) GlowAmber else BronzeGold, RoundedCornerShape(8.dp))
            .clickable { onClick() },
        contentAlignment = Alignment.Center
    ) {
        Canvas(modifier = Modifier.size(30.dp)) {
            val strokeWidth = 3f
            val iconColor = if (isSelected) DarkWood else OldPaper
            val w = size.width
            val h = size.height
            val path = Path()

            when (type) {
                0 -> { // SAW (Serra)
                    path.moveTo(0f, h * 0.8f)
                    path.lineTo(w, h * 0.2f)
                    path.lineTo(w, h * 0.8f)
                }
                1 -> { // SQUARE (Cadrada)
                    path.moveTo(0f, h * 0.8f)
                    path.lineTo(0f, h * 0.2f)
                    path.lineTo(w / 2f, h * 0.2f)
                    path.lineTo(w / 2f, h * 0.8f)
                    path.lineTo(w, h * 0.8f)
                    path.lineTo(w, h * 0.2f)
                }
                2 -> { // TRIANGLE (Triangular)
                    path.moveTo(0f, h * 0.8f)
                    path.lineTo(w / 2f, h * 0.2f)
                    path.lineTo(w, h * 0.8f)
                }
                3 -> { // SINE (Seno)
                    for (i in 0..w.toInt()) {
                        val x = i.toFloat()
                        val y = h / 2f + h * 0.3f * sin(2 * Math.PI * x / w).toFloat()
                        if (i == 0) path.moveTo(x, y) else path.lineTo(x, y)
                    }
                }
            }

            drawPath(
                path = path,
                color = iconColor,
                style = Stroke(width = strokeWidth)
            )
        }
    }
}

@Composable
fun ParamSelector(
    label: String? = null,
    options: List<String>,
    selected: String,
    onSelect: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        if (label != null) {
            Text(
                text = label,
                color = BronzeGold,
                fontSize = 12.sp,
                fontWeight = FontWeight.Medium
            )
            Spacer(modifier = Modifier.height(4.dp))
        }
        ParamButton(
            options = options,
            selected = selected,
            onSelect = onSelect
        )
    }
}

@Composable
fun ParamButton(
    options: List<String>,
    selected: String,
    onSelect: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    val currentIndex = options.indexOf(selected)
    Box(
        modifier = modifier
            .width(120.dp)
            .clip(RoundedCornerShape(4.dp))
            .background(Brush.verticalGradient(listOf(DarkWood, SteamGray.copy(alpha = 0.5f))))
            .border(1.dp, BronzeGold.copy(alpha = 0.6f), RoundedCornerShape(4.dp))
            .clickable {
                val nextIndex = (currentIndex + 1) % options.size
                onSelect(options[nextIndex])
            }
            .padding(vertical = 6.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = selected.uppercase(),
            color = GlowAmber,
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 1.sp
        )
    }
}
