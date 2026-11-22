package app.echo.designsystem.component.echo

import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.detectVerticalDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.unit.dp
import app.echo.designsystem.preview.EchoPreviews
import app.echo.designsystem.preview.EchoThemesPreview
import app.echo.designsystem.tokens.EchoSpacing

/** A–Z then "#". */
val AzLetters: List<String> = ('A'..'Z').map { it.toString() } + "#"

/**
 * Letter rail on the right edge of an index (Figma "Echo · A–Z fast scroller", 2.3 Tags / 2.11 Artists). Tap or
 * drag to jump; [selected] (the section at the top of the list) is emphasized. Letters with no entries can be
 * left out of [letters].
 */
@Composable
fun AzFastScroller(
    selected: String?,
    onLetter: (String) -> Unit,
    modifier: Modifier = Modifier,
    letters: List<String> = AzLetters,
) {
    var heightPx by remember { mutableIntStateOf(1) }
    val currentOnLetter by rememberUpdatedState(onLetter)
    fun letterAt(y: Float) = letters[((y / heightPx) * letters.size).toInt().coerceIn(0, letters.lastIndex)]
    Column(
        modifier
            .width(24.dp)
            .padding(vertical = EchoSpacing.m)
            .onSizeChanged { heightPx = it.height.coerceAtLeast(1) }
            .pointerInput(letters) { detectTapGestures { currentOnLetter(letterAt(it.y)) } }
            .pointerInput(letters) { detectVerticalDragGestures { change, _ -> currentOnLetter(letterAt(change.position.y)) } },
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(1.dp),
    ) {
        letters.forEach { letter ->
            val isSelected = letter == selected
            Text(
                letter,
                style = if (isSelected) MaterialTheme.typography.labelSmallEmphasized else MaterialTheme.typography.labelSmall,
                color = if (isSelected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@EchoPreviews
@Composable
private fun AzFastScrollerPreview() = EchoThemesPreview {
    Row(Modifier.height(420.dp).padding(horizontal = EchoSpacing.screenMargin)) {
        AzFastScroller(selected = "A", onLetter = {})
    }
}
