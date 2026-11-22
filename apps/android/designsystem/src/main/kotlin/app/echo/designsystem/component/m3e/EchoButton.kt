package app.echo.designsystem.component.m3e

import androidx.annotation.DrawableRes
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ElevatedButton
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import app.echo.designsystem.icon.EchoIcons
import app.echo.designsystem.preview.EchoPreviews
import app.echo.designsystem.preview.EchoThemesPreview
import app.echo.designsystem.tokens.EchoSpacing

/** Figma "Button (Filled / Tonal / Outlined / Text)". */
enum class ButtonStyle { Filled, Tonal, Outlined, Text, Elevated }

/**
 * M3 Expressive button (Figma "M3E · Button (<style>, <size>)"). Height, padding, icon size and text style
 * follow [size]; the shape morphs round → square on press.
 */
@Composable
fun EchoButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    style: ButtonStyle = ButtonStyle.Filled,
    size: ComponentSize = ComponentSize.S,
    @DrawableRes icon: Int? = null,
    enabled: Boolean = true,
) {
    val height = size.height
    val shapes = ButtonDefaults.shapesFor(height)
    val padding = ButtonDefaults.contentPaddingFor(height, hasStartIcon = icon != null)
    val sized = modifier.heightIn(min = height)
    val content: @Composable () -> Unit = {
        if (icon != null) {
            Icon(painterResource(icon), contentDescription = null, modifier = Modifier.size(ButtonDefaults.iconSizeFor(height)))
            Spacer(Modifier.width(ButtonDefaults.iconSpacingFor(height)))
        }
        Text(text, style = ButtonDefaults.textStyleFor(height))
    }
    when (style) {
        ButtonStyle.Filled -> Button(onClick, shapes, sized, enabled, contentPadding = padding) { content() }
        ButtonStyle.Tonal -> FilledTonalButton(onClick, shapes, sized, enabled, contentPadding = padding) { content() }
        ButtonStyle.Outlined -> OutlinedButton(onClick, shapes, sized, enabled, contentPadding = padding) { content() }
        ButtonStyle.Text -> TextButton(onClick, shapes, sized, enabled, contentPadding = padding) { content() }
        ButtonStyle.Elevated -> ElevatedButton(onClick, shapes, sized, enabled, contentPadding = padding) { content() }
    }
}

@EchoPreviews
@Composable
private fun EchoButtonPreview() = EchoThemesPreview {
    FlowRow(
        Modifier.padding(horizontal = EchoSpacing.screenMargin),
        horizontalArrangement = Arrangement.spacedBy(EchoSpacing.s),
        verticalArrangement = Arrangement.spacedBy(EchoSpacing.s),
    ) {
        ButtonStyle.entries.forEach { EchoButton(it.name, {}, style = it) }
        EchoButton("Play", {}, size = ComponentSize.M, icon = EchoIcons.PlayArrowFilled)
        EchoButton("Shuffle", {}, style = ButtonStyle.Tonal, size = ComponentSize.M, icon = EchoIcons.Shuffle)
        EchoButton("Clear", {}, style = ButtonStyle.Outlined, size = ComponentSize.XS)
    }
}
