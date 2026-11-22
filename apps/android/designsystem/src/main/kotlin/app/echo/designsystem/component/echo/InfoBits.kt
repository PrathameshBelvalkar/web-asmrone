package app.echo.designsystem.component.echo

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import app.echo.designsystem.component.m3e.ButtonStyle
import app.echo.designsystem.component.m3e.ComponentSize
import app.echo.designsystem.component.m3e.EchoButton
import app.echo.designsystem.icon.EchoIcons
import app.echo.designsystem.preview.EchoPreviews
import app.echo.designsystem.preview.EchoThemesPreview
import app.echo.designsystem.theme.EchoShapes
import app.echo.designsystem.tokens.EchoSpacing

/**
 * Catalogue sync status (Figma "Echo · StatusLine (catalog sync)", H.1): a status dot, "Updated 12 min ago ·
 * 2,322 titles", and a Refresh text button. [ok] false turns the dot to error.
 */
@Composable
fun StatusLine(text: String, onRefresh: () -> Unit, refreshLabel: String, modifier: Modifier = Modifier, ok: Boolean = true) {
    Row(
        modifier.fillMaxWidth().padding(start = EchoSpacing.screenMargin, end = EchoSpacing.s),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(EchoSpacing.s),
    ) {
        Box(
            Modifier.size(8.dp).clip(EchoShapes.Full)
                .background(if (ok) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error),
        )
        Text(text, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.weight(1f))
        EchoButton(refreshLabel, onRefresh, style = ButtonStyle.Text, size = ComponentSize.XS, icon = EchoIcons.Refresh)
    }
}

/** Studio avatar (initial), name and title count, clickable (Figma "Echo · Studio link", H.7). */
@Composable
fun StudioLink(name: String, count: String?, onClick: () -> Unit, modifier: Modifier = Modifier) {
    Row(
        modifier.clip(EchoShapes.Full).clickable(onClick = onClick).padding(vertical = EchoSpacing.xs),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(EchoSpacing.s),
    ) {
        Box(
            Modifier.size(24.dp).clip(EchoShapes.Full).background(MaterialTheme.colorScheme.primary),
            contentAlignment = Alignment.Center,
        ) {
            Text(name.take(1).uppercase(), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onPrimary)
        }
        Text(name, style = MaterialTheme.typography.labelLargeEmphasized)
        if (count != null) Text("· $count", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@EchoPreviews
@Composable
private fun InfoBitsPreview() = EchoThemesPreview {
    StatusLine("Updated 12 min ago · 2,322 titles", {}, "Refresh")
    StudioLink("Studio Name", "507 titles", {}, Modifier.padding(horizontal = EchoSpacing.screenMargin))
}
