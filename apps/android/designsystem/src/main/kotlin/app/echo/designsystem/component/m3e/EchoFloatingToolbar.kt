package app.echo.designsystem.component.m3e

import androidx.annotation.DrawableRes
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.Icon
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import app.echo.designsystem.icon.EchoIcons
import app.echo.designsystem.preview.EchoPreviews
import app.echo.designsystem.preview.EchoThemesPreview
import app.echo.designsystem.theme.EchoShapes
import app.echo.designsystem.tokens.EchoElevation
import app.echo.designsystem.tokens.EchoSizes
import app.echo.designsystem.tokens.EchoSpacing

/** Figma "Toolbar (Floating, horizontal)" is standard; "(Floating, vibrant)" sits on primary colours. */
enum class ToolbarStyle { Standard, Vibrant }

/**
 * Horizontal floating toolbar (Figma "M3E · Toolbar (Floating …)", 1.8 / 1.9 / 1.10 / 1.11 / 3.2 / reader):
 * a pill with a shadow holding [ToolbarAction]s or any icon buttons.
 */
@Composable
fun EchoFloatingToolbar(
    modifier: Modifier = Modifier,
    style: ToolbarStyle = ToolbarStyle.Standard,
    content: @Composable RowScope.() -> Unit,
) {
    val colors = MaterialTheme.colorScheme
    val (container, contentColor) = when (style) {
        ToolbarStyle.Standard -> colors.surfaceContainer to colors.onSurface
        ToolbarStyle.Vibrant -> colors.primaryContainer to colors.onPrimaryContainer
    }
    Surface(
        modifier = modifier,
        shape = EchoShapes.Full,
        color = container,
        contentColor = contentColor,
        shadowElevation = EchoElevation.level3,
        border = if (style == ToolbarStyle.Standard) BorderStroke(1.dp, colors.outlineVariant.copy(alpha = 0.5f)) else null,
    ) {
        Row(
            Modifier.padding(EchoSpacing.s),
            horizontalArrangement = Arrangement.spacedBy(EchoSpacing.xs),
            verticalAlignment = Alignment.CenterVertically,
            content = content,
        )
    }
}

/** A toolbar item: icon over a label; [selected] gets the secondaryContainer pill (e.g. the open player page). */
@Composable
fun ToolbarAction(
    label: String,
    @DrawableRes icon: Int,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    selected: Boolean = false,
    /** Tighter when actions share a fixed width (reader bar: five in a row). */
    horizontalPadding: androidx.compose.ui.unit.Dp = EchoSpacing.m,
) {
    val colors = MaterialTheme.colorScheme
    Surface(
        selected = selected,
        onClick = onClick,
        modifier = modifier.widthIn(min = EchoSizes.minTouchTarget),
        shape = MaterialTheme.shapes.largeIncreased,
        color = if (selected) colors.secondaryContainer else colors.secondaryContainer.copy(alpha = 0f),
        contentColor = if (selected) colors.onSecondaryContainer else LocalContentColor.current,
    ) {
        Column(
            Modifier.padding(horizontal = horizontalPadding, vertical = EchoSpacing.s - EchoSpacing.xxs),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Icon(painterResource(icon), contentDescription = null, modifier = Modifier.size(EchoSizes.iconSmall + EchoSpacing.xxs))
            Spacer(Modifier.height(EchoSpacing.xxs))
            Text(label, style = MaterialTheme.typography.labelSmall, maxLines = 1)
        }
    }
}

@EchoPreviews
@Composable
private fun EchoFloatingToolbarPreview() = EchoThemesPreview {
    Row(Modifier.padding(horizontal = EchoSpacing.screenMargin)) {
        EchoFloatingToolbar {
            ToolbarAction("Up next", EchoIcons.QueueMusic, {}, selected = true)
            ToolbarAction("Lyrics", EchoIcons.Chat, {})
            ToolbarAction("Sleep", EchoIcons.Timer, {})
            ToolbarAction("1.0×", EchoIcons.Speed, {})
        }
    }
    Row(Modifier.padding(horizontal = EchoSpacing.screenMargin)) {
        EchoFloatingToolbar(style = ToolbarStyle.Vibrant) {
            ConnectedButtonGroup(
                listOf(ConnectedOption("Both"), ConnectedOption("EN"), ConnectedOption("JP")),
                selected = 0, onSelect = {}, modifier = Modifier.widthIn(max = 200.dp),
            )
            EchoIconButton(EchoIcons.FormatSize, "Text size", {})
            EchoIconButton(EchoIcons.Share, "Share", {})
        }
    }
}

