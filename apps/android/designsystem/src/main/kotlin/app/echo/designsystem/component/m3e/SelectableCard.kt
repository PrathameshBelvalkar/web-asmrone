package app.echo.designsystem.component.m3e

import androidx.annotation.DrawableRes
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import app.echo.designsystem.icon.EchoIcons
import app.echo.designsystem.preview.EchoPreviews
import app.echo.designsystem.preview.EchoThemesPreview
import app.echo.designsystem.tokens.EchoSizes
import app.echo.designsystem.tokens.EchoSpacing

/**
 * Selectable outlined card (Figma "M3E · Cards (Outlined, selectable)", 2.8 / S.10 reading modes, O.5 sources):
 * icon, title, subtitle. Selected = primary container with a primary border; otherwise surfaceContainerLow.
 */
@Composable
fun SelectableCard(
    title: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    subtitle: String? = null,
    @DrawableRes icon: Int? = null,
    trailing: (@Composable () -> Unit)? = null,
) {
    val colors = MaterialTheme.colorScheme
    Surface(
        selected = selected,
        onClick = onClick,
        modifier = modifier,
        shape = MaterialTheme.shapes.largeIncreased,
        color = if (selected) colors.primaryContainer else colors.surfaceContainerLow,
        contentColor = if (selected) colors.onPrimaryContainer else colors.onSurface,
        border = BorderStroke(if (selected) 2.dp else 1.dp, if (selected) colors.primary else colors.outlineVariant),
    ) {
        Row(Modifier.padding(EchoSpacing.m), horizontalArrangement = Arrangement.spacedBy(EchoSpacing.m)) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(EchoSpacing.xs)) {
                if (icon != null) Icon(painterResource(icon), contentDescription = null, modifier = Modifier.size(EchoSizes.iconSmall + EchoSpacing.xxs))
                Text(title, style = MaterialTheme.typography.titleSmall)
                if (subtitle != null) {
                    Text(
                        subtitle,
                        style = MaterialTheme.typography.bodySmall,
                        color = if (selected) colors.onPrimaryContainer else colors.onSurfaceVariant,
                    )
                }
            }
            trailing?.invoke()
        }
    }
}

@EchoPreviews
@Composable
private fun SelectableCardPreview() = EchoThemesPreview {
    Row(Modifier.padding(horizontal = EchoSpacing.screenMargin), horizontalArrangement = Arrangement.spacedBy(EchoSpacing.s)) {
        SelectableCard("Paged", selected = true, onClick = {}, subtitle = "Right to left", icon = EchoIcons.MenuBook, modifier = Modifier.weight(1f))
        SelectableCard("Paged", selected = false, onClick = {}, subtitle = "Left to right", icon = EchoIcons.MenuBook, modifier = Modifier.weight(1f))
        SelectableCard("Long strip", selected = false, onClick = {}, subtitle = "Continuous", icon = EchoIcons.ViewDay, modifier = Modifier.weight(1f))
    }
}
