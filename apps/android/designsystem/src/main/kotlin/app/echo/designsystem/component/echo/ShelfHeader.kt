package app.echo.designsystem.component.echo

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import app.echo.designsystem.R
import app.echo.designsystem.component.m3e.EchoIconButton
import app.echo.designsystem.icon.EchoIcons
import app.echo.designsystem.preview.EchoPreviews
import app.echo.designsystem.preview.EchoThemesPreview
import app.echo.designsystem.tokens.EchoSizes
import app.echo.designsystem.tokens.EchoSpacing

/**
 * A shelf title (Figma "Echo · Shelf header", 19 screens): titleLarge, optional subtitle, and an arrow button
 * when the shelf opens a full list. With [onClick] the whole row is clickable.
 */
@Composable
fun ShelfHeader(
    title: String,
    modifier: Modifier = Modifier,
    subtitle: String? = null,
    onClick: (() -> Unit)? = null,
) {
    Row(
        modifier
            .fillMaxWidth()
            .heightIn(min = EchoSizes.listItemOneLine)
            .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier)
            .padding(start = EchoSpacing.screenMargin, end = EchoSpacing.xs, top = EchoSpacing.s),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.titleLarge, modifier = Modifier.semantics { heading() }, maxLines = 1)
            if (subtitle != null) {
                Text(subtitle, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
        if (onClick != null) {
            EchoIconButton(EchoIcons.ArrowForward, stringResource(R.string.echo_cd_open, title), onClick)
        }
    }
}

@EchoPreviews
@Composable
private fun ShelfHeaderPreview() = EchoThemesPreview {
    ShelfHeader("Continue listening", onClick = {})
    ShelfHeader("Trending tracks", subtitle = "This week on asmr.one", onClick = {})
    ShelfHeader("Your playlists")
}
