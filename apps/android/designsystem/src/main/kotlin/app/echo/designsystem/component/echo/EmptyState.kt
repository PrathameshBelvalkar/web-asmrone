package app.echo.designsystem.component.echo

import androidx.annotation.DrawableRes
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.style.TextAlign
import app.echo.designsystem.component.m3e.ButtonStyle
import app.echo.designsystem.component.m3e.EchoButton
import app.echo.designsystem.icon.EchoIcons
import app.echo.designsystem.preview.EchoPreviews
import app.echo.designsystem.preview.EchoThemesPreview
import app.echo.designsystem.theme.EchoShapes
import app.echo.designsystem.tokens.EchoSizes
import app.echo.designsystem.tokens.EchoSpacing

/** The button of an [EmptyState]. */
data class EmptyStateAction(val label: String, @DrawableRes val icon: Int?, val onClick: () -> Unit, val style: ButtonStyle = ButtonStyle.Filled)

/**
 * Empty and error states (Figma "Echo · Empty / error state — …", 0.4 and H.10): a tile on surfaceContainerLow
 * with an icon in a circle, a title, a body and an optional button. Variants are just different icons and copy:
 * Not found (search), Offline (wifi_off), Empty (history …), Blocked, Busy, No video.
 */
@Composable
fun EmptyState(
    @DrawableRes icon: Int,
    title: String,
    body: String,
    modifier: Modifier = Modifier,
    action: EmptyStateAction? = null,
) {
    Surface(
        modifier = modifier.fillMaxWidth().padding(horizontal = EchoSpacing.sectionPadding),
        shape = MaterialTheme.shapes.extraLarge,
        color = MaterialTheme.colorScheme.surfaceContainerLow,
    ) {
        Column(
            Modifier.padding(horizontal = EchoSpacing.sheetPadding, vertical = EchoSpacing.sheetPadding),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(EchoSpacing.s),
        ) {
            Box(
                Modifier.size(EchoSizes.Button.m).clip(EchoShapes.Full).background(MaterialTheme.colorScheme.surfaceContainerHighest),
                contentAlignment = Alignment.Center,
            ) {
                Icon(painterResource(icon), contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Spacer(Modifier.height(EchoSpacing.xs))
            Text(title, style = MaterialTheme.typography.titleLarge, textAlign = TextAlign.Center)
            Text(
                body,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
            )
            if (action != null) {
                Spacer(Modifier.height(EchoSpacing.xs))
                EchoButton(action.label, action.onClick, style = action.style, icon = action.icon)
            }
        }
    }
}

@EchoPreviews
@Composable
private fun EmptyStatePreview() = EchoThemesPreview {
    EmptyState(
        EchoIcons.Search, "Page not found", "This page doesn’t exist or has moved.",
        action = EmptyStateAction("Back to home", EchoIcons.Home, {}),
    )
    EmptyState(
        EchoIcons.WifiOff, "You’re offline", "Check your connection and try again.",
        action = EmptyStateAction("Try again", EchoIcons.Refresh, {}, ButtonStyle.Tonal),
    )
}
