package app.echo.android.debug

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.ui.Alignment
import androidx.compose.ui.unit.dp
import app.echo.designsystem.component.echo.GalleryCard
import app.echo.designsystem.component.echo.HanimeCard
import app.echo.designsystem.component.echo.IdolCard
import app.echo.designsystem.component.echo.MediaHeader
import app.echo.designsystem.component.echo.MediaHeaderStyle
import app.echo.designsystem.component.echo.PlaybackActions
import app.echo.designsystem.component.echo.PlaybackUi
import app.echo.designsystem.component.echo.PlayerControls
import app.echo.designsystem.component.echo.ReaderAction
import app.echo.designsystem.component.echo.ReaderBottomBar
import app.echo.designsystem.component.echo.ThemePreviews
import app.echo.designsystem.component.m3e.EchoFloatingToolbar
import app.echo.designsystem.component.m3e.EchoSlider
import app.echo.designsystem.component.m3e.EchoSplitButton
import app.echo.designsystem.component.m3e.PageIndicator
import app.echo.designsystem.component.m3e.SplitMenuItem
import app.echo.designsystem.component.m3e.ToolbarAction
import app.echo.designsystem.component.m3e.ValueIndicatorSlider
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.layout
import androidx.compose.ui.unit.Dp
import app.echo.designsystem.component.echo.ContinueCard
import app.echo.designsystem.component.echo.EmptyState
import app.echo.designsystem.component.echo.EmptyStateAction
import app.echo.designsystem.component.echo.MiniPlayer
import app.echo.designsystem.component.echo.ShelfHeader
import app.echo.designsystem.component.echo.TrackRow
import app.echo.designsystem.component.m3e.ButtonStyle
import app.echo.designsystem.component.m3e.ChipRow
import app.echo.designsystem.component.m3e.ChipSpec
import app.echo.designsystem.component.m3e.ComponentSize
import app.echo.designsystem.component.m3e.ConnectedButtonGroup
import app.echo.designsystem.component.m3e.ConnectedOption
import app.echo.designsystem.component.m3e.CoverCarousel
import app.echo.designsystem.component.m3e.CoverRow
import app.echo.designsystem.component.m3e.EchoButton
import app.echo.designsystem.component.m3e.EchoButtonGroup
import app.echo.designsystem.component.m3e.EchoIconButton
import app.echo.designsystem.component.m3e.EchoNavigationBar
import app.echo.designsystem.component.m3e.EchoSearchAppBar
import app.echo.designsystem.component.m3e.HeroCarouselItem
import app.echo.designsystem.component.m3e.IconButtonShape
import app.echo.designsystem.component.m3e.IconButtonStyle
import app.echo.designsystem.component.m3e.SectionTabs
import app.echo.designsystem.component.m3e.SegmentedList
import app.echo.designsystem.component.m3e.SwitchListItem
import app.echo.designsystem.component.m3e.sectionDestinations
import app.echo.designsystem.icon.EchoIcons
import app.echo.designsystem.preview.PreviewData
import app.echo.designsystem.tokens.EchoSpacing

/**
 * Phase 2 components, live and interactive, laid out like 1.1 Home and friends so they can be checked on the
 * emulator. Each block is labelled with its Figma layer name.
 */
@Composable
internal fun ComponentGallery() {
    var tab by remember { mutableIntStateOf(0) }
    var nav by remember { mutableIntStateOf(0) }
    var playing by remember { mutableStateOf(1) }
    var isPlaying by remember { mutableStateOf(false) }
    var liked by remember { mutableStateOf(true) }
    var group by remember { mutableIntStateOf(0) }
    var chips by remember { mutableStateOf(setOf(0)) }
    var dynamic by remember { mutableStateOf(true) }
    val progress by remember { mutableFloatStateOf(0.35f) }
    var seek by remember { mutableFloatStateOf(0.42f) }
    var repeat by remember { mutableStateOf(false) }
    var page by remember { mutableFloatStateOf(34f) }
    var age by remember { mutableIntStateOf(24) }
    var theme by remember { mutableIntStateOf(1) }

    Column(Modifier.bleed(EchoSpacing.screenMargin), verticalArrangement = Arrangement.spacedBy(EchoSpacing.s)) {
        Label("Echo · Search app bar + Source switcher + Profile avatar")
        EchoSearchAppBar(
            source = PreviewData.SOURCE, sectionIcon = EchoIcons.MusicNote, profileInitial = PreviewData.PROFILE_INITIAL,
            onSearch = {}, onSwitchSource = {}, onProfile = {},
        )
        Label("M3E · Tabs (Primary, scrollable)")
        SectionTabs(PreviewData.tabs, selected = tab, onSelect = { tab = it })
        Label("M3E · Carousel (Multi-browse)")
        CoverCarousel(PreviewData.heroTitles.size) { i -> HeroCarouselItem(PreviewData.heroTitles[i], image = null, onClick = {}) }
        ShelfHeader("Continue listening", onClick = {})
        CoverRow(PreviewData.continueItems.size) { i ->
            val (title, meta, p) = PreviewData.continueItems[i]
            ContinueCard(title, meta, p, image = null, onClick = {})
        }
        ShelfHeader("Trending tracks", onClick = {})
        SegmentedList {
            PreviewData.tracks.forEachIndexed { i, (title, artist, duration) ->
                item { TrackRow(title, artist, duration, cover = null, playing = i == playing, onClick = { playing = i }, onMore = {}) }
            }
        }
        Label("Echo · Mini player")
        MiniPlayer(
            title = PreviewData.TRACK, artist = PreviewData.ARTIST, cover = null, isPlaying = isPlaying,
            progress = { progress }, onPlayPause = { isPlaying = !isPlaying }, onNext = {}, onClick = {},
        )
        Label("M3E · Navigation bar (Flexible), floating")
        EchoNavigationBar(sectionDestinations("Home", "Search", "Library"), selected = nav, onSelect = { nav = it })
        Label("M3E · Button group (Standard)")
        EchoButtonGroup {
            EchoButton("Play", {}, size = ComponentSize.M, icon = EchoIcons.PlayArrowFilled)
            EchoButton("Shuffle", {}, style = ButtonStyle.Tonal, size = ComponentSize.M, icon = EchoIcons.Shuffle)
            EchoIconButton(
                EchoIcons.Favorite, "Like", { liked = !liked }, style = IconButtonStyle.Tonal, size = ComponentSize.M,
                shape = IconButtonShape.Square, checked = liked, checkedIcon = EchoIcons.FavoriteFilled,
            )
            EchoIconButton(EchoIcons.PlaylistAdd, "Add to playlist", {}, size = ComponentSize.M)
        }
        Label("M3E · Button group (Connected, single-select)")
        ConnectedButtonGroup(
            listOf(ConnectedOption("All"), ConnectedOption("ASMR"), ConnectedOption("Manga")),
            selected = group, onSelect = { group = it },
            modifier = Modifier.padding(horizontal = EchoSpacing.screenMargin),
        )
        Label("M3E · Chips (Filter)")
        ChipRow(
            listOf(ChipSpec("All"), ChipSpec("Listening", EchoIcons.MusicNote), ChipSpec("Reading", EchoIcons.Book), ChipSpec("Watching", EchoIcons.Movie)),
            onClick = { i -> chips = if (i in chips) chips - i else chips + i },
            selected = chips,
        )
        Label("M3E · List (Expressive, segmented) — settings group")
        SegmentedList {
            item { SwitchListItem("Dynamic colour", dynamic, { dynamic = it }, supporting = "Use colours from your wallpaper") }
            item { SwitchListItem("Pure black", checked = false, onCheckedChange = {}, enabled = false) }
        }
        Label("Phase 2b · M3E · Slider (wavy seek) + Player controls")
        PlayerControls(
            PlaybackUi(isPlaying = isPlaying, progress = seek, elapsed = "7:42", remaining = "−10:58", repeat = repeat),
            PlaybackActions({ isPlaying = !isPlaying }, {}, {}, { seek = it }, {}, { repeat = !repeat }),
        )
        Label("M3E · Slider (Standard, XS, with stops) — page")
        EchoSlider(page, { page = it }, valueRange = 1f..52f, steps = 50, modifier = Modifier.padding(horizontal = EchoSpacing.screenMargin))
        Label("M3E · Slider (with value indicator) — age")
        ValueIndicatorSlider(age, { age = it }, 13..80, marker = 18, maxLabel = "80+", modifier = Modifier.padding(horizontal = EchoSpacing.sectionPadding))
        Label("M3E · Toolbar (Floating)")
        Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
            EchoFloatingToolbar {
                ToolbarAction("Up next", EchoIcons.QueueMusic, {}, selected = true)
                ToolbarAction("Lyrics", EchoIcons.Chat, {})
                ToolbarAction("Sleep", EchoIcons.Timer, {})
                ToolbarAction("1.0×", EchoIcons.Speed, {})
            }
        }
        Label("Echo · Media header (gallery) + Split button")
        MediaHeader(
            "Gallery title placeholder that can wrap onto lines", "Artist Name",
            listOf("52 pages · Japanese · Doujinshi", "Added 2026-11-18"), null, style = MediaHeaderStyle.Gallery,
        )
        EchoSplitButton(
            "Continue p. 34", {}, listOf(SplitMenuItem("Start from page 1", {}), SplitMenuItem("Jump to page…", {})),
            icon = EchoIcons.MenuBook, modifier = Modifier.padding(horizontal = EchoSpacing.screenMargin),
        )
        Label("Echo · Section cards")
        CoverRow(3) { i ->
            when (i) {
                0 -> GalleryCard("Gallery title placeholder", "Artist Name", null, {}, pages = 24, language = "JP", width = 112.dp)
                1 -> HanimeCard("Title placeholder 1", "Studio Name · 2025", null, {}, views = "1.6M", isNew = true)
                else -> IdolCard("Aoi Mizuno", "128 movies", null, {})
            }
        }
        Label("Echo · Reader bottom bar (Mihon layout)")
        ReaderBottomBar(
            page = page.toInt(), pageCount = 52, onPage = { page = it.toFloat() },
            actions = listOf(
                ReaderAction("R → L", EchoIcons.MenuBook, {}, selected = true),
                ReaderAction("Rotate", EchoIcons.RotateLeft, {}),
                ReaderAction("Crop", EchoIcons.Crop, {}),
                ReaderAction("Pages", EchoIcons.GridView, {}),
                ReaderAction("Settings", EchoIcons.Settings, {}),
            ),
        )
        Label("Echo · Theme previews + Page indicator")
        ThemePreviews(listOf("Light", "Dark", "Pure black"), selected = theme, onSelect = { theme = it })
        Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) { PageIndicator(3, theme) }
        Label("Echo · Empty / error state")
        EmptyState(
            EchoIcons.WifiOff, "You’re offline", "Check your connection and try again.",
            action = EmptyStateAction("Try again", EchoIcons.Refresh, {}, ButtonStyle.Tonal),
        )
    }
}

/** Undo the Design system screen's side padding: the components bring their own screen margins. */
private fun Modifier.bleed(horizontal: Dp) = layout { measurable, constraints ->
    val extra = (horizontal * 2).roundToPx()
    val placeable = measurable.measure(
        constraints.copy(maxWidth = constraints.maxWidth + extra, minWidth = constraints.minWidth + extra),
    )
    layout(placeable.width - extra, placeable.height) { placeable.place(-extra / 2, 0) }
}

@Composable
private fun Label(text: String) = Text(
    text,
    style = MaterialTheme.typography.labelSmall,
    color = MaterialTheme.colorScheme.onSurfaceVariant,
    modifier = Modifier.padding(start = EchoSpacing.screenMargin, top = EchoSpacing.l),
)
