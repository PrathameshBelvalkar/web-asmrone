package app.echo.designsystem.component.echo

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import app.echo.designsystem.component.m3e.ButtonStyle
import app.echo.designsystem.component.m3e.ComponentSize
import app.echo.designsystem.component.m3e.EchoButton
import app.echo.designsystem.component.m3e.EchoButtonGroup
import app.echo.designsystem.icon.EchoIcons
import app.echo.designsystem.preview.EchoPreviews
import app.echo.designsystem.theme.EchoShapes
import app.echo.designsystem.tokens.EchoSpacing

/**
 * The end-of-gallery moment (Figma "Echo · End of gallery", 2.10): the cover on a tilted page with a check badge
 * (extraExtraLarge corners), "You finished it" (displaySmall), the gallery line, and Back / Read again.
 * Shown inside [ReaderTheme]; the "More by" shelf goes under it.
 */
@Composable
fun EndOfGallery(
    title: String,
    summary: String,
    cover: Any?,
    backLabel: String,
    readAgainLabel: String,
    onBack: () -> Unit,
    onReadAgain: () -> Unit,
    modifier: Modifier = Modifier,
) = ReaderTheme {
    Column(
        modifier.fillMaxWidth().padding(vertical = EchoSpacing.sectionPadding),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(EchoSpacing.xl),
    ) {
        Box(Modifier.size(200.dp, 230.dp)) {
            Box(
                Modifier.size(150.dp, 210.dp).offset(40.dp, 6.dp).rotate(6f)
                    .clip(MaterialTheme.shapes.extraExtraLarge.copy(all = androidx.compose.foundation.shape.CornerSize(18.dp)))
                    .background(MaterialTheme.colorScheme.surfaceContainerHighest.copy(alpha = 0.6f)),
            )
            CoverImage(cover, title, Modifier.size(150.dp, 210.dp).offset(20.dp, 10.dp), shape = MaterialTheme.shapes.extraLarge)
            Box(
                Modifier.size(44.dp).offset(150.dp, 0.dp).clip(EchoShapes.Full).background(MaterialTheme.colorScheme.primary),
                contentAlignment = Alignment.Center,
            ) {
                Icon(painterResource(EchoIcons.Check), null, tint = MaterialTheme.colorScheme.onPrimary)
            }
        }
        Text(title, style = MaterialTheme.typography.displaySmall, textAlign = TextAlign.Center)
        Text(summary, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = TextAlign.Center)
        EchoButtonGroup {
            EchoButton(backLabel, onBack, size = ComponentSize.M, icon = EchoIcons.ArrowBack, modifier = Modifier.weight(1f))
            EchoButton(readAgainLabel, onReadAgain, style = ButtonStyle.Outlined, size = ComponentSize.M, icon = EchoIcons.Replay, modifier = Modifier.weight(1f))
        }
    }
}

@EchoPreviews
@Composable
private fun EndOfGalleryPreview() = app.echo.designsystem.theme.EchoTheme(darkTheme = false) {
    androidx.compose.material3.Surface(color = MaterialTheme.colorScheme.scrim) {
        EndOfGallery("You finished it", "Gallery title placeholder · 52 pages · 18 min", null, "Back to gallery", "Read again", {}, {})
    }
}
