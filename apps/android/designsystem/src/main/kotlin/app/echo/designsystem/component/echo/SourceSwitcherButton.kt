package app.echo.designsystem.component.echo

import androidx.annotation.DrawableRes
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
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
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import app.echo.designsystem.R
import app.echo.designsystem.icon.EchoIcons
import app.echo.designsystem.preview.EchoPreviews
import app.echo.designsystem.preview.EchoThemesPreview
import app.echo.designsystem.theme.EchoShapes
import app.echo.designsystem.tokens.EchoSizes
import app.echo.designsystem.tokens.EchoSpacing

/**
 * The source pill inside the search app bar (Figma "Echo · Source switcher", 20 screens): section icon,
 * source name, expand arrow. Opens 0.1 Source switcher.
 */
@Composable
fun SourceSwitcherButton(
    source: String,
    @DrawableRes sectionIcon: Int,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val description = stringResource(R.string.echo_cd_switch_source, source)
    Surface(
        onClick = onClick,
        modifier = modifier.height(SwitcherHeight).semantics { contentDescription = description },
        shape = EchoShapes.Full,
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    ) {
        Row(
            Modifier.padding(start = EchoSpacing.m, end = EchoSpacing.s),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(EchoSpacing.s - EchoSpacing.xxs),
        ) {
            Icon(painterResource(sectionIcon), contentDescription = null, modifier = Modifier.size(EchoSizes.iconSmall))
            Text(source, style = MaterialTheme.typography.labelLargeEmphasized, maxLines = 1)
            Icon(painterResource(EchoIcons.ExpandMore), contentDescription = null, modifier = Modifier.size(EchoSizes.iconSmall))
        }
    }
}

/** 6 dp inside the 56 dp search bar. */
private val SwitcherHeight = EchoSizes.searchBarHeight - EchoSpacing.m

@EchoPreviews
@Composable
private fun SourceSwitcherButtonPreview() = EchoThemesPreview {
    Row(Modifier.padding(horizontal = EchoSpacing.screenMargin), horizontalArrangement = Arrangement.spacedBy(EchoSpacing.s)) {
        SourceSwitcherButton("asmr.one", EchoIcons.MusicNote, onClick = {})
        SourceSwitcherButton("3hentai", EchoIcons.MenuBook, onClick = {})
        SourceSwitcherButton("javdatabase", EchoIcons.Movie, onClick = {})
    }
}
