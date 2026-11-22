package app.echo.designsystem.component.m3e

import androidx.compose.ui.unit.Dp
import app.echo.designsystem.tokens.EchoSizes

/**
 * The five M3 Expressive sizes shared by buttons, icon buttons, toggle and split buttons and button groups
 * (Figma DS · Components). [S] is the default; [M] for media page Play / Shuffle; [L] for full player play/pause.
 */
enum class ComponentSize(val height: Dp) {
    XS(EchoSizes.Button.xs),
    S(EchoSizes.Button.s),
    M(EchoSizes.Button.m),
    L(EchoSizes.Button.l),
    XL(EchoSizes.Button.xl),
}
