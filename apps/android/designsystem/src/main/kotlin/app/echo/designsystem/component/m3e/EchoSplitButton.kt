package app.echo.designsystem.component.m3e

import androidx.annotation.DrawableRes
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.SplitButtonDefaults
import androidx.compose.material3.SplitButtonLayout
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import app.echo.designsystem.R
import app.echo.designsystem.icon.EchoIcons
import app.echo.designsystem.preview.EchoPreviews
import app.echo.designsystem.preview.EchoThemesPreview
import app.echo.designsystem.tokens.EchoSpacing

/** One entry of the split button's menu. */
data class SplitMenuItem(val label: String, val onClick: () -> Unit)

/**
 * Filled split button, M (Figma "M3E · Split button (Filled, M)", 2.5 "Continue p. 34 ▾" / 3.6): the main action,
 * and a trailing toggle that opens a menu of alternatives.
 */
@Composable
fun EchoSplitButton(
    text: String,
    onClick: () -> Unit,
    menu: List<SplitMenuItem>,
    modifier: Modifier = Modifier,
    @DrawableRes icon: Int? = null,
    size: ComponentSize = ComponentSize.M,
) {
    var open by remember { mutableStateOf(false) }
    val height = size.height
    SplitButtonLayout(
        modifier = modifier,
        leadingButton = {
            SplitButtonDefaults.LeadingButton(
                onClick = onClick,
                modifier = Modifier.heightIn(min = height),
                shapes = SplitButtonDefaults.leadingButtonShapesFor(height),
                contentPadding = SplitButtonDefaults.leadingButtonContentPaddingFor(height),
            ) {
                if (icon != null) {
                    Icon(painterResource(icon), null, Modifier.size(ButtonDefaults.iconSizeFor(height)))
                    Spacer(Modifier.width(ButtonDefaults.iconSpacingFor(height)))
                }
                Text(text, style = ButtonDefaults.textStyleFor(height))
            }
        },
        trailingButton = {
            Box {
                SplitButtonDefaults.TrailingButton(
                    checked = open,
                    onCheckedChange = { open = it },
                    modifier = Modifier.heightIn(min = height),
                    shapes = SplitButtonDefaults.trailingButtonShapesFor(height),
                    contentPadding = SplitButtonDefaults.trailingButtonContentPaddingFor(height),
                ) {
                    Icon(
                        painterResource(EchoIcons.ExpandMore),
                        contentDescription = stringResource(R.string.echo_cd_menu),
                        modifier = Modifier.size(ButtonDefaults.iconSizeFor(height)),
                    )
                }
                DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
                    menu.forEach { item ->
                        DropdownMenuItem(text = { Text(item.label) }, onClick = { open = false; item.onClick() })
                    }
                }
            }
        },
    )
}

@EchoPreviews
@Composable
private fun EchoSplitButtonPreview() = EchoThemesPreview {
    EchoSplitButton(
        "Continue p. 34", {}, listOf(SplitMenuItem("Start from page 1", {}), SplitMenuItem("Jump to page…", {})),
        icon = EchoIcons.MenuBook, modifier = Modifier.padding(horizontal = EchoSpacing.screenMargin),
    )
}
