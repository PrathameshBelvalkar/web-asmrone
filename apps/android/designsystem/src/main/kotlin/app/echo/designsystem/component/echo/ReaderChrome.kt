package app.echo.designsystem.component.echo

import androidx.annotation.DrawableRes
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import app.echo.designsystem.R
import app.echo.designsystem.component.m3e.EchoIconButton
import app.echo.designsystem.component.m3e.EchoSlider
import app.echo.designsystem.component.m3e.ToolbarAction
import app.echo.designsystem.icon.EchoIcons
import app.echo.designsystem.preview.EchoPreviews
import app.echo.designsystem.theme.EchoShapes
import app.echo.designsystem.theme.EchoTheme
import app.echo.designsystem.theme.LocalEchoTheme
import app.echo.designsystem.theme.ThemeMode
import app.echo.designsystem.tokens.EchoSizes
import app.echo.designsystem.tokens.EchoSpacing

/*
 * Reader chrome (Figma 2.6–2.9, Mihon layout). The reader is always dark, whatever the app theme, so every piece
 * here is wrapped in [ReaderTheme]: the app's theme in dark mode (pure black kept if on).
 */

/** The app theme forced to dark, for the manga reader. */
@Composable
fun ReaderTheme(content: @Composable () -> Unit) {
    val config = LocalEchoTheme.current.config
    EchoTheme(config.copy(mode = ThemeMode.DARK), content)
}

/** A reader quick action (Figma "Action/R → L", "Rotate", "Crop", "Pages", "Settings"). */
data class ReaderAction(val label: String, @DrawableRes val icon: Int, val onClick: () -> Unit, val selected: Boolean = false)

/**
 * The reader's bottom bar with menus shown (Figma "Echo · Reader bottom bar (Mihon layout)"): [PageFilmstrip],
 * first page · page slider with stops · last page, and the quick actions. Translucent surface, 32 dp corners.
 */
@Composable
fun ReaderBottomBar(
    page: Int,
    pageCount: Int,
    onPage: (Int) -> Unit,
    actions: List<ReaderAction>,
    modifier: Modifier = Modifier,
    thumbnail: (Int) -> Any? = { null },
) = ReaderTheme {
    Surface(
        modifier = modifier.fillMaxWidth().padding(EchoSpacing.m - EchoSpacing.xxs),
        shape = MaterialTheme.shapes.extraLargeIncreased,
        color = MaterialTheme.colorScheme.surfaceContainer.copy(alpha = 0.86f),
        contentColor = MaterialTheme.colorScheme.onSurface,
    ) {
        Column(Modifier.padding(EchoSpacing.m), verticalArrangement = Arrangement.spacedBy(EchoSpacing.s)) {
            PageFilmstrip(page, pageCount, onPage, thumbnail = thumbnail)
            Row(verticalAlignment = Alignment.CenterVertically) {
                EchoIconButton(EchoIcons.FirstPage, stringResource(R.string.echo_cd_first_page), { onPage(1) })
                EchoSlider(
                    value = page.toFloat(),
                    onValueChange = { onPage(it.toInt()) },
                    valueRange = 1f..pageCount.coerceAtLeast(2).toFloat(),
                    steps = (pageCount - 2).coerceAtLeast(0),
                    modifier = Modifier.weight(1f),
                )
                EchoIconButton(EchoIcons.LastPage, stringResource(R.string.echo_cd_last_page), { onPage(pageCount) })
            }
            Row(horizontalArrangement = Arrangement.spacedBy(EchoSpacing.xxs)) {
                actions.forEach { action ->
                    ToolbarAction(action.label, action.icon, action.onClick, Modifier.weight(1f), selected = action.selected, horizontalPadding = EchoSpacing.xs)
                }
            }
        }
    }
}

/**
 * Nearby pages as thumbnails, the current one bigger and outlined (Figma "Echo · Page filmstrip (nearby pages)").
 * Keeps the current page centered.
 */
@Composable
fun PageFilmstrip(
    page: Int,
    pageCount: Int,
    onPage: (Int) -> Unit,
    modifier: Modifier = Modifier,
    thumbnail: (Int) -> Any? = { null },
) {
    val state = rememberLazyListState()
    LaunchedEffect(page) { state.animateScrollToItem((page - 4).coerceAtLeast(0)) }
    LazyRow(
        modifier = modifier.fillMaxWidth().height(80.dp),
        state = state,
        horizontalArrangement = Arrangement.spacedBy(EchoSpacing.s - EchoSpacing.xxs),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        items(pageCount) { i ->
            val number = i + 1
            val current = number == page
            Column(
                Modifier.clickable { onPage(number) }.alpha(if (current) 1f else 0.55f),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                val thumb = Modifier.size(if (current) 44.dp else 36.dp, if (current) 62.dp else 50.dp)
                    .then(if (current) Modifier.border(2.dp, MaterialTheme.colorScheme.primary, MaterialTheme.shapes.small) else Modifier)
                val image = thumbnail(number)
                // No page image yet: the page mock, like the reader and the gallery's page grid.
                if (image == null) PageMock(thumb.clip(MaterialTheme.shapes.small))
                else CoverImage(image, null, thumb, shape = MaterialTheme.shapes.small)
                Text(
                    number.toString(),
                    style = if (current) MaterialTheme.typography.labelSmallEmphasized else MaterialTheme.typography.labelSmall,
                )
            }
        }
    }
}

/** "34 / 52" pill when the menus are hidden (Figma "Echo · Page number (menus hidden)"). */
@Composable
fun PageNumber(page: Int, pageCount: Int, modifier: Modifier = Modifier) = ReaderTheme {
    Surface(
        modifier = modifier,
        shape = EchoShapes.Full,
        color = MaterialTheme.colorScheme.surfaceContainer.copy(alpha = 0.86f),
        contentColor = MaterialTheme.colorScheme.onSurface,
    ) {
        Text(
            "$page / $pageCount",
            style = MaterialTheme.typography.labelMediumEmphasized,
            modifier = Modifier.padding(horizontal = EchoSpacing.m, vertical = EchoSpacing.xs),
        )
    }
}

/** "Paged (right to left)" chip shown briefly on open (Figma "Echo · Reading-mode hint"). */
@Composable
fun ReadingModeHint(text: String, @DrawableRes icon: Int, modifier: Modifier = Modifier) {
    Surface(modifier = modifier, shape = EchoShapes.Full, color = MaterialTheme.colorScheme.inverseSurface) {
        Row(
            Modifier.padding(horizontal = EchoSpacing.l, vertical = EchoSpacing.s + EchoSpacing.xxs),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(EchoSpacing.s),
        ) {
            Icon(painterResource(icon), null, Modifier.size(EchoSizes.iconSmall))
            Text(text, style = MaterialTheme.typography.labelLargeEmphasized)
        }
    }
}

/**
 * Tap zones shown briefly when the reader opens (Figma "Echo · Tap zones overlay"): the left and right thirds
 * tinted with the scrim and labelled, the centre toggles the menus.
 */
@Composable
fun TapZonesOverlay(leftLabel: String, rightLabel: String, modifier: Modifier = Modifier, centreLabel: String? = null) = ReaderTheme {
    Row(modifier.fillMaxSize()) {
        TapZone(leftLabel, EchoIcons.ArrowLeft, Modifier.weight(1f))
        // Middle third: shows the menus. Lighter than the page-turn zones (Figma 2.7 "Tap zone/MENU").
        Box(
            Modifier.weight(1f).fillMaxHeight().background(MaterialTheme.colorScheme.scrim.copy(alpha = 0.1f)),
            contentAlignment = Alignment.Center,
        ) {
            if (centreLabel != null) ZoneLabel(centreLabel, EchoIcons.MenuBook)
        }
        TapZone(rightLabel, EchoIcons.ArrowRight, Modifier.weight(1f))
    }
}

@Composable
private fun TapZone(label: String, @DrawableRes icon: Int, modifier: Modifier) {
    Box(
        modifier
            .fillMaxHeight()
            .background(MaterialTheme.colorScheme.scrim.copy(alpha = 0.35f))
            .border(BorderStroke(1.dp, MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f))),
        contentAlignment = Alignment.Center,
    ) { ZoneLabel(label, icon) }
}

@Composable
private fun ZoneLabel(label: String, @DrawableRes icon: Int) {
    run {
        Surface(shape = EchoShapes.Full, color = MaterialTheme.colorScheme.surfaceContainerHighest) {
            Row(
                Modifier.padding(horizontal = EchoSpacing.m - EchoSpacing.xxs, vertical = EchoSpacing.s - EchoSpacing.xxs),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(EchoSpacing.xs),
            ) {
                Icon(painterResource(icon), null, Modifier.size(16.dp))
                Text(label, style = MaterialTheme.typography.labelSmall)
            }
        }
    }
}

@EchoPreviews
@Composable
private fun ReaderChromePreview() = EchoTheme(darkTheme = false) {
    Column(Modifier.background(MaterialTheme.colorScheme.scrim), verticalArrangement = Arrangement.spacedBy(EchoSpacing.m)) {
        ReaderBottomBar(
            page = 34, pageCount = 52, onPage = {},
            actions = listOf(
                ReaderAction("R → L", EchoIcons.MenuBook, {}, selected = true),
                ReaderAction("Rotate", EchoIcons.RotateLeft, {}),
                ReaderAction("Crop", EchoIcons.Crop, {}),
                ReaderAction("Pages", EchoIcons.GridView, {}),
                ReaderAction("Settings", EchoIcons.Settings, {}),
            ),
        )
        Row(Modifier.padding(EchoSpacing.l), horizontalArrangement = Arrangement.spacedBy(EchoSpacing.m)) {
            PageNumber(34, 52)
            ReadingModeHint("Paged (right to left)", EchoIcons.MenuBook)
        }
        Box(Modifier.height(240.dp)) { TapZonesOverlay("Next page", "Previous page") }
    }
}
