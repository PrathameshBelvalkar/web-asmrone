package app.echo.designsystem.component.m3e

import androidx.compose.material3.minimumInteractiveComponentSize
import androidx.annotation.DrawableRes
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.FilledIconButton
import androidx.compose.material3.FilledIconToggleButton
import androidx.compose.material3.FilledTonalIconButton
import androidx.compose.material3.FilledTonalIconToggleButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.IconButtonDefaults
import androidx.compose.material3.IconButtonDefaults.IconButtonWidthOption
import androidx.compose.material3.IconButtonShapes
import androidx.compose.material3.IconToggleButton
import androidx.compose.material3.IconToggleButtonShapes
import androidx.compose.material3.OutlinedIconButton
import androidx.compose.material3.OutlinedIconToggleButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.DpSize
import app.echo.designsystem.icon.EchoIcons
import app.echo.designsystem.preview.EchoPreviews
import app.echo.designsystem.preview.EchoThemesPreview
import app.echo.designsystem.tokens.EchoSpacing

/** Figma "Icon button (Standard / Filled / Tonal / Outlined)". */
enum class IconButtonStyle { Standard, Filled, Tonal, Outlined }

/** Figma "round" (default) or "square". Toggles morph between them when checked. */
enum class IconButtonShape { Round, Square }

/** Figma "wide" / default / narrow container widths. */
enum class IconButtonWidth { Narrow, Uniform, Wide }

/**
 * M3 Expressive icon button (Figma "M3E · Icon button", 56 screens). Pass [checked] to make it a toggle
 * (like, bookmark, repeat …); [checkedIcon] is shown while checked (usually the filled variant).
 * Always 48 dp touch target. Shape morphs on press with the expressive fast spatial spring.
 */
@Composable
fun EchoIconButton(
    @DrawableRes icon: Int,
    contentDescription: String?,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    style: IconButtonStyle = IconButtonStyle.Standard,
    size: ComponentSize = ComponentSize.S,
    shape: IconButtonShape = IconButtonShape.Round,
    width: IconButtonWidth = IconButtonWidth.Uniform,
    checked: Boolean? = null,
    @DrawableRes checkedIcon: Int = icon,
    enabled: Boolean = true,
) {
    val container = containerSize(size, width)
    val iconSize = iconSize(size)
    val content: @Composable () -> Unit = {
        Icon(
            painter = painterResource(if (checked == true) checkedIcon else icon),
            contentDescription = contentDescription,
            modifier = Modifier.size(iconSize),
        )
    }
    // The visual size, inside at least a 48 dp touch target (accessibility pass).
    val sized = modifier.minimumInteractiveComponentSize().size(container)
    if (checked == null) {
        val shapes = buttonShapes(size, shape)
        when (style) {
            IconButtonStyle.Standard -> IconButton(onClick, shapes, sized, enabled, content = content)
            IconButtonStyle.Filled -> FilledIconButton(onClick, shapes, sized, enabled, content = content)
            IconButtonStyle.Tonal -> FilledTonalIconButton(onClick, shapes, sized, enabled, content = content)
            IconButtonStyle.Outlined -> OutlinedIconButton(onClick, shapes, sized, enabled, content = content)
        }
    } else {
        val shapes = toggleShapes(size, shape)
        val onChange: (Boolean) -> Unit = { onClick() }
        when (style) {
            IconButtonStyle.Standard -> IconToggleButton(checked, onChange, shapes, sized, enabled, content = content)
            IconButtonStyle.Filled -> FilledIconToggleButton(checked, onChange, shapes, sized, enabled, content = content)
            IconButtonStyle.Tonal -> FilledTonalIconToggleButton(checked, onChange, shapes, sized, enabled, content = content)
            IconButtonStyle.Outlined -> OutlinedIconToggleButton(checked, onChange, shapes, sized, enabled, content = content)
        }
    }
}

private fun containerSize(size: ComponentSize, width: IconButtonWidth): DpSize {
    val option = when (width) {
        IconButtonWidth.Narrow -> IconButtonWidthOption.Narrow
        IconButtonWidth.Uniform -> IconButtonWidthOption.Uniform
        IconButtonWidth.Wide -> IconButtonWidthOption.Wide
    }
    return when (size) {
        ComponentSize.XS -> IconButtonDefaults.extraSmallContainerSize(option)
        ComponentSize.S -> IconButtonDefaults.smallContainerSize(option)
        ComponentSize.M -> IconButtonDefaults.mediumContainerSize(option)
        ComponentSize.L -> IconButtonDefaults.largeContainerSize(option)
        ComponentSize.XL -> IconButtonDefaults.extraLargeContainerSize(option)
    }
}

private fun iconSize(size: ComponentSize): Dp = when (size) {
    ComponentSize.XS -> IconButtonDefaults.extraSmallIconSize
    ComponentSize.S -> IconButtonDefaults.smallIconSize
    ComponentSize.M -> IconButtonDefaults.mediumIconSize
    ComponentSize.L -> IconButtonDefaults.largeIconSize
    ComponentSize.XL -> IconButtonDefaults.extraLargeIconSize
}

private class SizeShapes(val round: Shape, val square: Shape, val pressed: Shape, val checkedRound: Shape, @Suppress("unused") val checkedSquare: Shape)

@Composable
private fun sizeShapes(size: ComponentSize): SizeShapes = when (size) {
    ComponentSize.XS -> SizeShapes(
        IconButtonDefaults.extraSmallRoundShape, IconButtonDefaults.extraSmallSquareShape, IconButtonDefaults.extraSmallPressedShape,
        IconButtonDefaults.extraSmallSelectedRoundShape, IconButtonDefaults.extraSmallSelectedSquareShape,
    )
    ComponentSize.S -> SizeShapes(
        IconButtonDefaults.smallRoundShape, IconButtonDefaults.smallSquareShape, IconButtonDefaults.smallPressedShape,
        IconButtonDefaults.smallSelectedRoundShape, IconButtonDefaults.smallSelectedSquareShape,
    )
    ComponentSize.M -> SizeShapes(
        IconButtonDefaults.mediumRoundShape, IconButtonDefaults.mediumSquareShape, IconButtonDefaults.mediumPressedShape,
        IconButtonDefaults.mediumSelectedRoundShape, IconButtonDefaults.mediumSelectedSquareShape,
    )
    ComponentSize.L -> SizeShapes(
        IconButtonDefaults.largeRoundShape, IconButtonDefaults.largeSquareShape, IconButtonDefaults.largePressedShape,
        IconButtonDefaults.largeSelectedRoundShape, IconButtonDefaults.largeSelectedSquareShape,
    )
    ComponentSize.XL -> SizeShapes(
        IconButtonDefaults.extraLargeRoundShape, IconButtonDefaults.extraLargeSquareShape, IconButtonDefaults.extraLargePressedShape,
        IconButtonDefaults.extraLargeSelectedRoundShape, IconButtonDefaults.extraLargeSelectedSquareShape,
    )
}

@Composable
private fun buttonShapes(size: ComponentSize, shape: IconButtonShape): IconButtonShapes {
    val s = sizeShapes(size)
    return IconButtonDefaults.shapes(
        shape = if (shape == IconButtonShape.Round) s.round else s.square,
        pressedShape = s.pressed,
    )
}

@Composable
private fun toggleShapes(size: ComponentSize, shape: IconButtonShape): IconToggleButtonShapes {
    val s = sizeShapes(size)
    return IconButtonDefaults.toggleableShapes(
        shape = if (shape == IconButtonShape.Round) s.round else s.square,
        pressedShape = s.pressed,
        // Round buttons become square when checked (M3); square ones stay square (Figma "toggle on, square").
        checkedShape = if (shape == IconButtonShape.Round) s.checkedRound else s.square,
    )
}

@EchoPreviews
@Composable
private fun EchoIconButtonPreview() = EchoThemesPreview {
    FlowRow(
        Modifier.padding(horizontal = EchoSpacing.screenMargin),
        horizontalArrangement = Arrangement.spacedBy(EchoSpacing.s),
        verticalArrangement = Arrangement.spacedBy(EchoSpacing.s),
    ) {
        IconButtonStyle.entries.forEach { style ->
            EchoIconButton(EchoIcons.PlayArrow, "Play", {}, style = style)
        }
        EchoIconButton(EchoIcons.PlayArrowFilled, "Play", {}, style = IconButtonStyle.Filled, shape = IconButtonShape.Square)
        EchoIconButton(EchoIcons.Favorite, "Like", {}, style = IconButtonStyle.Outlined, checked = false, checkedIcon = EchoIcons.FavoriteFilled)
        EchoIconButton(EchoIcons.Favorite, "Like", {}, style = IconButtonStyle.Outlined, checked = true, checkedIcon = EchoIcons.FavoriteFilled)
        EchoIconButton(EchoIcons.Repeat, "Repeat", {}, style = IconButtonStyle.Tonal, width = IconButtonWidth.Wide)
        EchoIconButton(EchoIcons.PlayArrowFilled, "Play", {}, style = IconButtonStyle.Filled, size = ComponentSize.M, shape = IconButtonShape.Square)
        EchoIconButton(EchoIcons.PlayArrowFilled, "Play", {}, style = IconButtonStyle.Filled, size = ComponentSize.L, width = IconButtonWidth.Wide, shape = IconButtonShape.Square)
    }
}
