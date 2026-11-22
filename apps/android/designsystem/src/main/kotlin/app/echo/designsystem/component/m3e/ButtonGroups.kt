package app.echo.designsystem.component.m3e

import androidx.annotation.DrawableRes
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.material3.ButtonGroupDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.ToggleButton
import androidx.compose.material3.ToggleButtonDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import app.echo.designsystem.icon.EchoIcons
import app.echo.designsystem.preview.EchoPreviews
import app.echo.designsystem.preview.EchoThemesPreview
import app.echo.designsystem.tokens.EchoSizes
import app.echo.designsystem.tokens.EchoSpacing

/**
 * Standard button group (Figma "M3E · Button group (Standard)", 27 screens): buttons and icon buttons of one size
 * in a row, 8 dp apart, with the screen margins. e.g. 1.5 Work: Play · Shuffle · like · add to playlist.
 */
@Composable
fun EchoButtonGroup(
    modifier: Modifier = Modifier,
    content: @Composable RowScope.() -> Unit,
) {
    Row(
        modifier.fillMaxWidth().padding(horizontal = EchoSpacing.screenMargin),
        horizontalArrangement = Arrangement.spacedBy(EchoSpacing.chipGap),
        verticalAlignment = Alignment.CenterVertically,
        content = content,
    )
}

/** One option of a [ConnectedButtonGroup]. */
data class ConnectedOption(val label: String, @DrawableRes val icon: Int? = null)

/**
 * Connected button group, single-select (Figma "M3E · Button group (Connected, single-select)", 17 screens):
 * segments 2 dp apart, the selected one fully rounded with a check. Used instead of segmented buttons.
 */
@Composable
fun ConnectedButtonGroup(
    options: List<ConnectedOption>,
    selected: Int,
    onSelect: (Int) -> Unit,
    modifier: Modifier = Modifier,
    size: ComponentSize = ComponentSize.S,
    /** True: segments share the width equally. False: each is as wide as its label (e.g. 1.10 Both · EN · JP). */
    equalWidth: Boolean = true,
) {
    Row(
        modifier.selectableGroup(),
        horizontalArrangement = Arrangement.spacedBy(ButtonGroupDefaults.ConnectedSpaceBetween),
    ) {
        options.forEachIndexed { index, option ->
            val checked = index == selected
            val shapes = when (index) {
                0 -> ButtonGroupDefaults.connectedLeadingButtonShapes()
                options.lastIndex -> ButtonGroupDefaults.connectedTrailingButtonShapes()
                else -> ButtonGroupDefaults.connectedMiddleButtonShapes()
            }
            ToggleButton(
                checked = checked,
                onCheckedChange = { onSelect(index) },
                shapes = shapes,
                colors = ToggleButtonDefaults.colors(
                    containerColor = MaterialTheme.colorScheme.secondaryContainer,
                    contentColor = MaterialTheme.colorScheme.onSecondaryContainer,
                ),
                modifier = (if (equalWidth) Modifier.weight(1f) else Modifier)
                    .heightIn(min = size.height).semantics { role = Role.RadioButton },
            ) {
                val icon = if (checked) EchoIcons.Check else option.icon
                if (icon != null) {
                    Icon(painterResource(icon), contentDescription = null, modifier = Modifier.size(EchoSizes.iconSmall))
                    Spacer(Modifier.width(EchoSpacing.s - EchoSpacing.xxs))
                }
                Text(option.label, style = MaterialTheme.typography.labelLarge, maxLines = 1)
            }
        }
    }
}

@EchoPreviews
@Composable
private fun ButtonGroupsPreview() = EchoThemesPreview {
    EchoButtonGroup {
        EchoButton("Play", {}, size = ComponentSize.M, icon = EchoIcons.PlayArrowFilled)
        EchoButton("Shuffle", {}, style = ButtonStyle.Tonal, size = ComponentSize.M, icon = EchoIcons.Shuffle)
        Spacer(Modifier.weight(1f))
        EchoIconButton(
            EchoIcons.Favorite, "Like", {}, style = IconButtonStyle.Tonal, size = ComponentSize.M,
            shape = IconButtonShape.Square, checked = true, checkedIcon = EchoIcons.FavoriteFilled,
        )
        EchoIconButton(EchoIcons.PlaylistAdd, "Add to playlist", {}, size = ComponentSize.M)
    }
    ConnectedButtonGroup(
        options = listOf(ConnectedOption("ASMR"), ConnectedOption("Manga"), ConnectedOption("JAV")),
        selected = 1,
        onSelect = {},
        modifier = Modifier.padding(horizontal = EchoSpacing.screenMargin),
    )
}
