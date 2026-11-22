package app.echo.android.feature.manga.reader

import androidx.annotation.DrawableRes
import androidx.annotation.StringRes
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items as gridItems
import androidx.compose.foundation.border
import androidx.compose.foundation.background
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import app.echo.android.R
import app.echo.data.model.ReaderBackground
import app.echo.data.model.ReaderSettings
import app.echo.data.model.ReadingMode
import app.echo.data.model.ScaleType
import app.echo.data.model.TapZones
import app.echo.designsystem.component.echo.EmptyState
import app.echo.designsystem.component.m3e.ButtonStyle
import app.echo.designsystem.component.m3e.ChipRow
import app.echo.designsystem.component.m3e.ChipSpec
import app.echo.designsystem.component.m3e.ComponentSize
import app.echo.designsystem.component.m3e.EchoButton
import app.echo.designsystem.component.m3e.EchoSheet
import app.echo.designsystem.component.m3e.RadioOption
import app.echo.designsystem.component.m3e.RadioOptionList
import app.echo.designsystem.component.m3e.SectionTabs
import app.echo.designsystem.component.m3e.SegmentedList
import app.echo.designsystem.component.m3e.SegmentedListItem
import app.echo.designsystem.component.m3e.SelectableCard
import app.echo.designsystem.component.m3e.SwitchListItem
import app.echo.designsystem.icon.EchoIcons
import app.echo.designsystem.tokens.EchoSpacing

/** One reading-mode card (Figma 2.8): the title, its subtitle and an icon. */
internal data class ModeCard(val mode: ReadingMode, @StringRes val title: Int, @StringRes val subtitle: Int, @DrawableRes val icon: Int)

internal val readingModes = listOf(
    ModeCard(ReadingMode.PAGED_RTL, R.string.reader_mode_paged, R.string.reader_sub_rtl, EchoIcons.MenuBook),
    ModeCard(ReadingMode.PAGED_LTR, R.string.reader_mode_paged, R.string.reader_sub_ltr, EchoIcons.MenuBook),
    ModeCard(ReadingMode.PAGED_VERTICAL, R.string.reader_mode_paged, R.string.reader_sub_vertical, EchoIcons.SwapVert),
    ModeCard(ReadingMode.LONG_STRIP, R.string.reader_mode_strip, R.string.reader_sub_continuous, EchoIcons.ViewDay),
    ModeCard(ReadingMode.LONG_STRIP_GAPS, R.string.reader_mode_strip, R.string.reader_sub_gaps, EchoIcons.ViewDay),
    ModeCard(ReadingMode.TWO_PAGES, R.string.reader_mode_two_pages, R.string.reader_sub_landscape, EchoIcons.GridView),
)

internal fun TapZones.label() = when (this) {
    TapZones.DEFAULT -> R.string.reader_zones_default
    TapZones.L_SHAPED -> R.string.reader_zones_l
    TapZones.KINDLE -> R.string.reader_zones_kindle
    TapZones.EDGE -> R.string.reader_zones_edge
    TapZones.OFF -> R.string.reader_zones_off
}

internal fun ScaleType.label() = when (this) {
    ScaleType.FIT_SCREEN -> R.string.reader_scale_fit_screen
    ScaleType.FIT_WIDTH -> R.string.reader_scale_fit_width
    ScaleType.FIT_HEIGHT -> R.string.reader_scale_fit_height
    ScaleType.ORIGINAL -> R.string.reader_scale_original
}

internal fun ReaderBackground.label() = when (this) {
    ReaderBackground.BLACK -> R.string.reader_bg_black
    ReaderBackground.GRAY -> R.string.reader_bg_gray
    ReaderBackground.WHITE -> R.string.reader_bg_white
    ReaderBackground.AUTO -> R.string.reader_bg_auto
}

/** Figma 2.8 Reader settings (28:2553): a light sheet with reading-mode cards, tap zones and paged options. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReaderSettingsSheet(
    settings: ReaderSettings,
    hasOverride: Boolean,
    onEditReading: (ReaderSettings.() -> ReaderSettings) -> Unit,
    onEditDisplay: (ReaderSettings.() -> ReaderSettings) -> Unit,
    onToggleForGallery: () -> Unit,
    onDismiss: () -> Unit,
) {
    var tab by rememberSaveable { mutableIntStateOf(0) }
    EchoSheet(onDismiss = onDismiss) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = EchoSpacing.screenMargin),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                stringResource(R.string.reader_settings_title),
                style = MaterialTheme.typography.headlineSmall,
                modifier = Modifier.weight(1f),
            )
            EchoButton(
                text = stringResource(R.string.reader_for_gallery),
                onClick = onToggleForGallery,
                style = ButtonStyle.Tonal,
                size = ComponentSize.XS,
                icon = if (hasOverride) EchoIcons.Check else null,
            )
        }
        SectionTabs(
            tabs = listOf(
                stringResource(R.string.reader_tab_mode),
                stringResource(R.string.reader_tab_general),
                stringResource(R.string.reader_tab_filter),
            ),
            selected = tab,
            onSelect = { tab = it },
        )
        LazyColumn(
            contentPadding = PaddingValues(top = EchoSpacing.m, bottom = EchoSpacing.l),
            verticalArrangement = Arrangement.spacedBy(EchoSpacing.m),
        ) {
            when (tab) {
                0 -> modeTab(settings, onEditReading, onEditDisplay)
                1 -> generalTab(settings, onEditDisplay)
                else -> item {
                    EmptyState(
                        EchoIcons.Tune, stringResource(R.string.reader_filter_empty_title),
                        stringResource(R.string.reader_filter_empty_body), Modifier.padding(top = EchoSpacing.l),
                    )
                }
            }
        }
    }
}

private fun androidx.compose.foundation.lazy.LazyListScope.modeTab(
    settings: ReaderSettings,
    onEdit: (ReaderSettings.() -> ReaderSettings) -> Unit,
    onEditDisplay: (ReaderSettings.() -> ReaderSettings) -> Unit,
) {
    item { Label(stringResource(R.string.reader_label_mode)) }
    items(readingModes.chunked(3)) { row ->
        Row(
            Modifier.fillMaxWidth().padding(horizontal = EchoSpacing.screenMargin),
            horizontalArrangement = Arrangement.spacedBy(EchoSpacing.s),
        ) {
            row.forEach { card ->
                SelectableCard(
                    title = stringResource(card.title),
                    selected = settings.readingMode == card.mode,
                    onClick = { onEdit { copy(readingMode = card.mode) } },
                    modifier = Modifier.weight(1f),
                    subtitle = stringResource(card.subtitle),
                    icon = card.icon,
                )
            }
            repeat(3 - row.size) { Spacer(Modifier.weight(1f)) }
        }
    }
    item { Label(stringResource(R.string.reader_label_tap)) }
    item {
        ChipRow(
            chips = TapZones.entries.map { ChipSpec(stringResource(it.label())) },
            onClick = { index -> onEdit { copy(tapZones = TapZones.entries[index]) } },
            selected = setOf(settings.tapZones.ordinal),
        )
    }
    item {
        SegmentedList {
            item {
                SegmentedListItem(
                    headline = stringResource(R.string.reader_scale_type),
                    onClick = { onEdit { copy(scaleType = ScaleType.entries[(scaleType.ordinal + 1) % ScaleType.entries.size]) } },
                    trailing = {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                stringResource(settings.scaleType.label()),
                                style = MaterialTheme.typography.bodyLarge,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                            Icon(painterResource(EchoIcons.ExpandMore), null)
                        }
                    },
                )
            }
            item {
                SwitchListItem(
                    headline = stringResource(R.string.reader_crop_borders),
                    checked = settings.cropBorders,
                    onCheckedChange = { checked -> onEdit { copy(cropBorders = checked) } },
                )
            }
            item {
                SwitchListItem(
                    headline = stringResource(R.string.reader_dual_page),
                    checked = settings.dualPageLandscape,
                    onCheckedChange = { checked -> onEdit { copy(dualPageLandscape = checked) } },
                )
            }
            item {
                SwitchListItem(
                    headline = stringResource(R.string.reader_animate_transitions),
                    checked = settings.animatePageTransitions,
                    onCheckedChange = { checked -> onEditDisplay { copy(animatePageTransitions = checked) } },
                )
            }
        }
    }
}

private fun androidx.compose.foundation.lazy.LazyListScope.generalTab(
    settings: ReaderSettings,
    onEdit: (ReaderSettings.() -> ReaderSettings) -> Unit,
) {
    item { Label(stringResource(R.string.reader_background)) }
    item {
        RadioOptionList(
            options = ReaderBackground.entries.map { RadioOption(stringResource(it.label())) },
            selected = settings.background.ordinal,
            onSelect = { index -> onEdit { copy(background = ReaderBackground.entries[index]) } },
            modifier = Modifier.padding(horizontal = EchoSpacing.screenMargin),
        )
    }
    item {
        SegmentedList {
            item {
                SwitchListItem(
                    headline = stringResource(R.string.reader_show_page_number),
                    checked = settings.showPageNumber,
                    onCheckedChange = { checked -> onEdit { copy(showPageNumber = checked) } },
                )
            }
            item {
                SwitchListItem(
                    headline = stringResource(R.string.reader_keep_screen_on),
                    checked = settings.keepScreenOn,
                    onCheckedChange = { checked -> onEdit { copy(keepScreenOn = checked) } },
                )
            }
        }
    }
}

@Composable
private fun Label(text: String) {
    Text(
        text,
        style = MaterialTheme.typography.labelLarge,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.padding(horizontal = EchoSpacing.screenMargin + EchoSpacing.s),
    )
}

/** Figma 2.9 Pages (28:2747): every page as a thumbnail with its number, the current one marked; first and last. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReaderPagesSheet(page: Int, pageCount: Int, onPage: (Int) -> Unit, onDismiss: () -> Unit) {
    EchoSheet(onDismiss = onDismiss) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = EchoSpacing.screenMargin),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                stringResource(R.string.reader_pages_title),
                style = MaterialTheme.typography.headlineSmall,
                modifier = Modifier.weight(1f),
            )
            Text(
                stringResource(R.string.reader_pages_of, page, pageCount),
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        LazyVerticalGrid(
            columns = GridCells.Fixed(4),
            modifier = Modifier.height(440.dp),
            contentPadding = PaddingValues(horizontal = EchoSpacing.screenMargin, vertical = EchoSpacing.s),
            verticalArrangement = Arrangement.spacedBy(EchoSpacing.s),
            horizontalArrangement = Arrangement.spacedBy(EchoSpacing.s),
        ) {
            gridItems((1..pageCount).toList(), key = { it }) { number ->
                PageCell(number, current = number == page, onClick = { onPage(number) })
            }
        }
        Row(
            Modifier.fillMaxWidth().padding(horizontal = EchoSpacing.screenMargin, vertical = EchoSpacing.s),
            horizontalArrangement = Arrangement.spacedBy(EchoSpacing.s),
        ) {
            EchoButton(
                text = stringResource(R.string.reader_first_page),
                onClick = { onPage(1) },
                style = ButtonStyle.Tonal,
                size = ComponentSize.S,
                icon = EchoIcons.FirstPage,
            )
            EchoButton(
                text = stringResource(R.string.reader_last_page),
                onClick = { onPage(pageCount) },
                style = ButtonStyle.Tonal,
                size = ComponentSize.S,
                icon = EchoIcons.LastPage,
            )
        }
    }
}

/** A page thumbnail with its number under it. The current page has a dark frame and a "34 · Reading" label. */
@Composable
private fun PageCell(number: Int, current: Boolean, onClick: () -> Unit) {
    Column(Modifier.clickable(onClick = onClick), horizontalAlignment = Alignment.CenterHorizontally) {
        Box(
            Modifier.fillMaxWidth()
                .aspectRatio(0.7f)
                .clip(MaterialTheme.shapes.small)
                .background(MaterialTheme.colorScheme.surfaceContainerHighest)
                .then(
                    if (current) Modifier.border(2.dp, MaterialTheme.colorScheme.onSurface, MaterialTheme.shapes.small)
                    else Modifier,
                ),
        )
        Spacer(Modifier.height(EchoSpacing.xs))
        if (current) {
            Box(
                Modifier.clip(MaterialTheme.shapes.medium)
                    .background(MaterialTheme.colorScheme.inverseSurface)
                    .padding(horizontal = EchoSpacing.s, vertical = EchoSpacing.xxs),
            ) {
                Text(
                    stringResource(R.string.reader_page_current, number),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.inverseOnSurface,
                )
            }
        } else {
            Text(
                "$number",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}
