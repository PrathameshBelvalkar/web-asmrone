package app.echo.designsystem.component.m3e

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.style.TextDecoration
import app.echo.designsystem.icon.EchoIcons
import app.echo.designsystem.preview.EchoPreviews
import app.echo.designsystem.preview.EchoThemesPreview
import app.echo.designsystem.tokens.EchoSpacing

/** A tri-state filter: off, include (must have) or exclude (must not have). */
enum class TriState { OFF, INCLUDE, EXCLUDE;

    /** Tap order: include → exclude → off. */
    fun next(): TriState = when (this) {
        OFF -> INCLUDE
        INCLUDE -> EXCLUDE
        EXCLUDE -> OFF
    }
}

/**
 * Echo's tri-state filter chip (Figma H.4 "Tag A ✓ / – Tag B"): include = secondaryContainer with a check, exclude =
 * errorContainer with a minus and a struck-through label, off = the outlined chip. Tapping steps through [TriState.next].
 */
@Composable
fun TriStateChip(label: String, state: TriState, onClick: () -> Unit, modifier: Modifier = Modifier) {
    val colors = MaterialTheme.colorScheme
    val exclude = state == TriState.EXCLUDE
    FilterChip(
        selected = state != TriState.OFF,
        onClick = onClick,
        label = { Text(label, textDecoration = if (exclude) TextDecoration.LineThrough else null) },
        leadingIcon = when (state) {
            TriState.OFF -> null
            TriState.INCLUDE -> { { Icon(painterResource(EchoIcons.Check), null, Modifier.size(FilterChipDefaults.IconSize)) } }
            TriState.EXCLUDE -> { { Icon(painterResource(EchoIcons.Remove), null, Modifier.size(FilterChipDefaults.IconSize)) } }
        },
        colors = if (exclude) {
            FilterChipDefaults.filterChipColors(
                selectedContainerColor = colors.errorContainer,
                selectedLabelColor = colors.onErrorContainer,
                selectedLeadingIconColor = colors.onErrorContainer,
            )
        } else {
            FilterChipDefaults.filterChipColors()
        },
        modifier = modifier.semantics { stateDescription = state.name.lowercase() },
    )
}

@EchoPreviews
@Composable
private fun TriStateChipPreview() = EchoThemesPreview {
    Row(Modifier.padding(horizontal = EchoSpacing.screenMargin), horizontalArrangement = Arrangement.spacedBy(EchoSpacing.s)) {
        TriStateChip("Tag A", TriState.INCLUDE, {})
        TriStateChip("Tag B", TriState.EXCLUDE, {})
        TriStateChip("Tag C", TriState.OFF, {})
    }
}
