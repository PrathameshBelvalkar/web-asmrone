package app.echo.designsystem.component.m3e

import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import app.echo.designsystem.icon.EchoIcons
import app.echo.designsystem.preview.EchoPreviews
import app.echo.designsystem.preview.EchoThemesPreview

/** Switch with the check / close icon in the thumb (Figma "M3E · Switch (on/off, with icon)", 13 screens). */
@Composable
fun EchoSwitch(
    checked: Boolean,
    onCheckedChange: ((Boolean) -> Unit)?,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    showIcon: Boolean = true,
) {
    Switch(
        checked = checked,
        onCheckedChange = onCheckedChange,
        modifier = modifier,
        enabled = enabled,
        thumbContent = if (showIcon) {
            {
                Icon(
                    painterResource(if (checked) EchoIcons.Check else EchoIcons.Close),
                    contentDescription = null,
                    modifier = Modifier.size(SwitchDefaults.IconSize),
                )
            }
        } else {
            null
        },
    )
}

/**
 * A settings row: headline, optional supporting text, and a switch. The whole tile toggles. Put it in a
 * [SegmentedList] (Figma "List (Expressive, segmented) — settings group").
 */
@Composable
fun SwitchListItem(
    headline: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
    modifier: Modifier = Modifier,
    supporting: String? = null,
    enabled: Boolean = true,
) {
    SegmentedListItem(
        headline = headline,
        supporting = supporting,
        onClick = { onCheckedChange(!checked) },
        modifier = modifier,
        enabled = enabled,
        trailing = { EchoSwitch(checked, onCheckedChange = null, enabled = enabled) },
    )
}

@EchoPreviews
@Composable
private fun SwitchListItemPreview() = EchoThemesPreview {
    SegmentedList {
        item { SwitchListItem("Dynamic colour", checked = true, onCheckedChange = {}, supporting = "Use colours from your wallpaper") }
        item { SwitchListItem("Pure black", checked = false, onCheckedChange = {}) }
        item { SwitchListItem("Animations", checked = true, onCheckedChange = {}, enabled = false) }
    }
}
