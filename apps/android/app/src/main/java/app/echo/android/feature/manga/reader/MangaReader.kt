package app.echo.android.feature.manga.reader

import android.content.res.Configuration
import androidx.compose.foundation.gestures.animateScrollBy
import androidx.compose.foundation.gestures.scrollBy
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.pager.VerticalPager
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.key
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.layout.layout
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.DpSize
import app.echo.data.model.ScaleType
import app.echo.data.model.TapZones
import app.echo.designsystem.component.echo.PageMockMargin
import app.echo.designsystem.component.echo.TapZoneKind
import app.echo.designsystem.component.echo.TapZonesGrid
import kotlin.math.roundToInt
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlin.math.abs
import androidx.compose.ui.semantics.customActions
import androidx.compose.ui.semantics.CustomAccessibilityAction
import app.echo.android.feature.manga.galleryUrl
import app.echo.android.ui.shareText
import androidx.compose.ui.res.painterResource
import androidx.compose.material3.Icon
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.DropdownMenu
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.platform.LocalContext
import android.content.pm.ActivityInfo
import android.content.ContextWrapper
import android.content.Context
import app.echo.designsystem.theme.BaselineLightColorScheme
import app.echo.data.model.ReaderBackground
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import android.app.Activity
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.runtime.DisposableEffect
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import app.echo.designsystem.component.echo.PageMock
import app.echo.designsystem.theme.EchoShapes
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.tooling.preview.PreviewParameter
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.echo.android.R
import app.echo.android.feature.manga.LoadFallback
import app.echo.android.navigation.Route
import app.echo.android.navigation.ShellActions
import app.echo.android.ui.echoViewModel
import app.echo.data.model.Gallery
import app.echo.data.model.ReaderSettings
import app.echo.data.model.ReadingMode
import app.echo.data.repository.GalleryReaderPrefs
import app.echo.data.repository.LibraryRepository
import app.echo.data.repository.Load
import app.echo.data.repository.MangaRepository
import app.echo.data.repository.ReaderPrefsRepository
import app.echo.data.repository.SettingsRepository
import app.echo.data.repository.withOverrides
import app.echo.designsystem.component.echo.PageNumber
import app.echo.designsystem.component.echo.ReaderAction
import app.echo.designsystem.component.echo.ReaderBottomBar
import app.echo.designsystem.component.echo.ReaderTheme
import app.echo.designsystem.component.echo.ReadingModeHint
import app.echo.designsystem.component.echo.TapZonesOverlay
import app.echo.designsystem.component.m3e.CoverBadge
import app.echo.designsystem.component.m3e.EchoIconButton
import app.echo.designsystem.component.m3e.EchoSmallAppBar
import app.echo.designsystem.component.m3e.SmallAppBarStyle
import app.echo.designsystem.icon.EchoIcons
import app.echo.designsystem.preview.EchoPreviewTheme
import app.echo.designsystem.preview.EchoPreviewThemes
import app.echo.designsystem.preview.EchoScreenPreviews
import app.echo.designsystem.theme.EchoTheme
import app.echo.designsystem.tokens.EchoSpacing
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

enum class ReaderSheet { NONE, SETTINGS, PAGES }

data class MangaReaderUiState(
    val gallery: Load<Gallery> = Load.Loading,
    /** 1-based, like the page counter. */
    val page: Int = 1,
    /** The settings this gallery reads with: the defaults, with its overrides on top. */
    val settings: ReaderSettings = ReaderSettings(),
    val hasOverride: Boolean = false,
    val menusShown: Boolean = false,
    val sheet: ReaderSheet = ReaderSheet.NONE,
    /** The tap-zone and reading-mode hints, shown for a moment after opening. */
    val hintsShown: Boolean = true,
)

private data class ReaderSnapshot(val gallery: Load<Gallery>, val page: Int, val settings: ReaderSettings, val hasOverride: Boolean)

class MangaReaderViewModel(
    private val galleryId: String,
    initialPage: Int,
    openPages: Boolean,
    manga: MangaRepository,
    private val library: LibraryRepository,
    private val settings: SettingsRepository,
    private val prefs: ReaderPrefsRepository,
    /** Outlives the reader, so the last page is still saved when it closes right after a turn. */
    private val saveScope: CoroutineScope,
) : ViewModel() {
    private val reloads = MutableStateFlow(0)
    private val page = MutableStateFlow(initialPage.coerceAtLeast(1))
    private val menus = MutableStateFlow(false)
    private val sheet = MutableStateFlow(if (openPages) ReaderSheet.PAGES else ReaderSheet.NONE)
    private val hints = MutableStateFlow(true)

    private val gallery: StateFlow<Load<Gallery>> = reloads.flatMapLatest { manga.gallery(galleryId) }
        .stateIn(viewModelScope, SharingStarted.Eagerly, Load.Loading)
    private val overrides: StateFlow<GalleryReaderPrefs?> = prefs.forGallery(galleryId)
        .stateIn(viewModelScope, SharingStarted.Eagerly, null)
    private val effective: Flow<ReaderSettings> = combine(settings.settings.map { it.reader }, overrides) { defaults, o ->
        defaults.withOverrides(o)
    }

    val state: StateFlow<MangaReaderUiState> = combine(
        combine(gallery, page, effective, overrides) { g, p, e, o -> ReaderSnapshot(g, p, e, o != null) },
        menus, sheet, hints,
    ) { s, m, sh, h ->
        // History can point past the end of the gallery (the seeded rows don't match the catalogue): clamp.
        val count = (s.gallery as? Load.Content)?.value?.pageCount
        val shown = if (count != null) s.page.coerceIn(1, count) else s.page
        MangaReaderUiState(s.gallery, shown, s.settings, s.hasOverride, m, sh, h)
    }.stateIn(viewModelScope, SharingStarted.Eagerly, MangaReaderUiState())

    /** A page was reached (1-based). Saves the position to history; finishing the last page marks it read. */
    fun setPage(index: Int) {
        val loaded = (gallery.value as? Load.Content)?.value
        val clamped = if (loaded != null) index.coerceIn(1, loaded.pageCount) else index.coerceAtLeast(1)
        page.value = clamped
        // Saved once the page stops changing, not for every step of a slider drag.
        saveJob?.cancel()
        if (loaded != null) {
            saveJob = saveScope.launch {
                delay(SAVE_DELAY_MS)
                library.saveReadProgress(loaded, clamped, finished = clamped >= loaded.pageCount)
            }
        }
    }
    private var saveJob: Job? = null

    fun toggleMenus() { menus.value = !menus.value }
    fun openSheet(which: ReaderSheet) { menus.value = false; sheet.value = which }
    fun closeSheet() { sheet.value = ReaderSheet.NONE }
    fun hideHints() { hints.value = false }
    fun retry() { reloads.value += 1 }

    /** Background, page number, screen on: always the defaults. */
    fun editDisplay(transform: ReaderSettings.() -> ReaderSettings) {
        viewModelScope.launch { settings.updateReader(transform) }
    }

    /**
     * Reading mode, tap zones, scale, crop and two pages: this gallery's own settings when it has overrides, the
     * defaults otherwise.
     */
    fun editReading(transform: ReaderSettings.() -> ReaderSettings) {
        val current = state.value
        viewModelScope.launch {
            if (!current.hasOverride) {
                settings.updateReader(transform)
            } else {
                val next = current.settings.transform()
                prefs.save(galleryId, next.toOverrides())
            }
        }
    }

    /** 2.8 "For this gallery": turn this gallery's own settings on (from what it reads with now) or off. */
    fun toggleForGallery() {
        val current = state.value
        viewModelScope.launch {
            if (current.hasOverride) prefs.reset(galleryId) else prefs.save(galleryId, current.settings.toOverrides())
        }
    }
}

private fun ReaderSettings.toOverrides() = GalleryReaderPrefs(readingMode, tapZones, scaleType, cropBorders, dualPageLandscape)

@Composable
fun MangaReaderRoute(galleryId: String, page: Int, showPages: Boolean, shell: ShellActions) {
    val vm = echoViewModel(key = "$galleryId/$page/$showPages") {
        MangaReaderViewModel(galleryId, page, showPages, it.manga, it.library, it.settings, it.readerPrefs, it.appScope)
    }
    val state by vm.state.collectAsStateWithLifecycle()
    MangaReaderScreen(
        state = state,
        onBack = shell::back,
        onPage = vm::setPage,
        onCentreTap = vm::toggleMenus,
        // Replace, not open: a reader left under 2.10 sits on its "past the end" slot and would bounce straight back
        // to 2.10 when Back returns to it (after Read again, for one).
        onEnd = { shell.replace(Route.EndOfGallery(galleryId)) },
        onOpenSheet = vm::openSheet,
        onCloseSheet = vm::closeSheet,
        onHideHints = vm::hideHints,
        onRetry = vm::retry,
        onEditDisplay = vm::editDisplay,
        onEditReading = vm::editReading,
        onToggleForGallery = vm::toggleForGallery,
    )
}

/**
 * Figma 2.6 Reader (menus shown) and 2.7 (menus hidden): pages full screen, the bar and the page number switch with
 * the menus. Always dark. Tap the left or right third to turn the page; the middle shows the menus.
 */
@Composable
fun MangaReaderScreen(
    state: MangaReaderUiState,
    onBack: () -> Unit,
    onPage: (Int) -> Unit,
    onCentreTap: () -> Unit,
    onEnd: () -> Unit,
    onOpenSheet: (ReaderSheet) -> Unit,
    onCloseSheet: () -> Unit,
    onHideHints: () -> Unit,
    onRetry: () -> Unit,
    onEditDisplay: (ReaderSettings.() -> ReaderSettings) -> Unit,
    onEditReading: (ReaderSettings.() -> ReaderSettings) -> Unit,
    onToggleForGallery: () -> Unit,
    modifier: Modifier = Modifier,
) {
    // Keep screen on (2.8 General / S.10): the screen stays awake while the reader is open.
    val view = LocalView.current
    DisposableEffect(view, state.settings.keepScreenOn) {
        view.keepScreenOn = state.settings.keepScreenOn
        onDispose { view.keepScreenOn = false }
    }
    ReaderTheme {
        Box(modifier.fillMaxSize().background(readerBackground(state.settings.background)).testTag("screen:2.6")) {
            val gallery = state.gallery
            if (gallery is Load.Content) {
                ReaderPages(state, gallery.value, onPage, onCentreTap, onEnd)
                ReaderOverlays(state, gallery.value, onBack, onPage, onOpenSheet, onEditReading)
                LaunchedEffect(Unit) {
                    delay(HintMillis)
                    onHideHints()
                }
            } else {
                LoadFallback(gallery, onRetry)
            }
        }
    }
    // The sheets are light, as in Figma: they follow the app theme, not the dark reader.
    when (state.sheet) {
        ReaderSheet.SETTINGS -> ReaderSettingsSheet(
            settings = state.settings,
            hasOverride = state.hasOverride,
            onEditReading = onEditReading,
            onEditDisplay = onEditDisplay,
            onToggleForGallery = onToggleForGallery,
            onDismiss = onCloseSheet,
        )
        ReaderSheet.PAGES -> ReaderPagesSheet(
            page = state.page,
            pageCount = (state.gallery as? Load.Content)?.value?.pageCount ?: 0,
            onPage = { onPage(it); onCloseSheet() },
            onDismiss = onCloseSheet,
        )
        ReaderSheet.NONE -> Unit
    }
}

private const val HintMillis = 1_500L
private const val SAVE_DELAY_MS = 400L

@Composable
private fun ReaderPages(
    state: MangaReaderUiState,
    gallery: Gallery,
    onPage: (Int) -> Unit,
    onCentreTap: () -> Unit,
    onEnd: () -> Unit,
) {
    val settings = state.settings
    val landscape = LocalConfiguration.current.orientation == Configuration.ORIENTATION_LANDSCAPE
    when (settings.readingMode) {
        ReadingMode.PAGED_RTL, ReadingMode.PAGED_LTR, ReadingMode.TWO_PAGES -> PagedReader(
            pageCount = gallery.pageCount, page = state.page, settings = settings, vertical = false,
            rtl = settings.readingMode == ReadingMode.PAGED_RTL,
            // Two pages: always in that mode; in the other paged modes when the screen is landscape and "Two pages
            // in landscape" is on.
            spreads = settings.readingMode == ReadingMode.TWO_PAGES || (settings.dualPageLandscape && landscape),
            onPage = onPage, onCentreTap = onCentreTap, onEnd = onEnd,
        )
        ReadingMode.PAGED_VERTICAL -> PagedReader(
            pageCount = gallery.pageCount, page = state.page, settings = settings, vertical = true, rtl = false, spreads = false,
            onPage = onPage, onCentreTap = onCentreTap, onEnd = onEnd,
        )
        ReadingMode.LONG_STRIP, ReadingMode.LONG_STRIP_GAPS -> StripReader(gallery.pageCount, state.page, settings, onPage, onCentreTap)
    }
}

/**
 * Paged modes: swipe, or tap a zone (the tap-zones setting). Sideways for left to right / right to left / two pages,
 * up and down for paged vertical. Swiping past the last page opens 2.10. In [spreads], each slot shows two pages side
 * by side (1–2, 3–4, …) and the counter reports the later one.
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun PagedReader(
    pageCount: Int,
    page: Int,
    settings: ReaderSettings,
    vertical: Boolean,
    rtl: Boolean,
    spreads: Boolean,
    onPage: (Int) -> Unit,
    onCentreTap: () -> Unit,
    onEnd: () -> Unit,
) {
    val slots = remember(pageCount, spreads) { (1..pageCount).chunked(if (spreads) 2 else 1) }
    fun slotOf(p: Int) = ((p.coerceIn(1, pageCount) - 1) / if (spreads) 2 else 1).coerceIn(0, slots.lastIndex)
    // One extra slot after the last page: reaching it means the gallery is finished. A fresh pager when spreads turn
    // on or off, so it opens at the page being read.
    val pagerState = key(spreads, vertical) { rememberPagerState(initialPage = slotOf(page), pageCount = { slots.size + 1 }) }
    val scope = rememberCoroutineScope()
    val animate = settings.animatePageTransitions
    // Animate page transitions off: taps and the accessibility actions land at once instead of sliding.
    suspend fun go(slot: Int) {
        val target = slot.coerceIn(0, slots.size)
        if (animate) pagerState.animateScrollToPage(target) else pagerState.scrollToPage(target)
    }
    LaunchedEffect(pagerState, pagerState.settledPage) {
        val settled = pagerState.settledPage
        if (settled < slots.size) onPage(slots[settled].last()) else onEnd()
    }
    LaunchedEffect(pagerState, page) {
        val target = slotOf(page)
        // A neighbour slides (when animating); a jump (slider, first / last page) lands at once, without flicking
        // through every page in between and reporting them back while the slider is still moving.
        when {
            pagerState.currentPage == target -> Unit
            animate && abs(pagerState.currentPage - target) == 1 -> pagerState.animateScrollToPage(target)
            else -> pagerState.scrollToPage(target)
        }
    }
    val nextLabel = stringResource(R.string.reader_tap_next)
    val previousLabel = stringResource(R.string.reader_tap_previous)
    val menusLabel = stringResource(R.string.reader_tap_menus)
    val zones = settings.tapZones
    val modifier = Modifier.fillMaxSize()
        // TalkBack can't tap a part of the screen: the same moves as actions.
        .semantics {
            customActions = listOf(
                CustomAccessibilityAction(nextLabel) { scope.launch { go(pagerState.currentPage + 1) }; true },
                CustomAccessibilityAction(previousLabel) { scope.launch { go(pagerState.currentPage - 1) }; true },
                CustomAccessibilityAction(menusLabel) { onCentreTap(); true },
            )
        }
        .pointerInput(zones, rtl, slots.size, animate) {
            detectTapGestures { offset ->
                // Right to left mirrors the zones: the left side moves forward there.
                when (tapZoneAt(zones, offset.x / size.width, offset.y / size.height, mirror = rtl)) {
                    TapZoneKind.MENU -> onCentreTap()
                    TapZoneKind.PREVIOUS -> scope.launch { go(pagerState.currentPage - 1) }
                    TapZoneKind.NEXT -> scope.launch { go(pagerState.currentPage + 1) }
                }
            }
        }
    val slot: @Composable (Int) -> Unit = { index ->
        if (index < slots.size) PageSlot(slots[index], rtl, settings, Modifier.fillMaxSize()) else Box(Modifier.fillMaxSize())
    }
    if (vertical) {
        VerticalPager(state = pagerState, modifier = modifier) { slot(it) }
    } else {
        HorizontalPager(state = pagerState, reverseLayout = rtl, modifier = modifier) { slot(it) }
    }
}

/** One pager slot: a single page at the chosen scale, or a two-page spread fitted to the screen. */
@Composable
private fun PageSlot(pages: List<Int>, rtl: Boolean, settings: ReaderSettings, modifier: Modifier) {
    if (pages.size == 1) {
        ScaledPage(pages.single(), settings.scaleType, settings.cropBorders, rtl, modifier)
        return
    }
    // Right to left reads the right-hand page first.
    Box(modifier, contentAlignment = Alignment.Center) {
        Row(Modifier.aspectRatio(pageRatio(settings.cropBorders) * pages.size)) {
            (if (rtl) pages.reversed() else pages).forEach { number ->
                PageImage(number, settings.cropBorders, Modifier.weight(1f).fillMaxHeight())
            }
        }
    }
}

/**
 * A page at the scale type (2.8 / S.10): Fit screen keeps it whole; Fit width fills the width and scrolls down a page
 * taller than the screen; Fit height fills the height and scrolls sideways; Original is the page's own size, scrolling
 * either way it overflows. Centred and letterboxed by the reader background where it's smaller than the screen.
 */
@Composable
private fun ScaledPage(number: Int, scale: ScaleType, crop: Boolean, rtl: Boolean, modifier: Modifier) {
    val ratio = pageRatio(crop)
    BoxWithConstraints(modifier) {
        val size = when (scale) {
            ScaleType.FIT_SCREEN ->
                if (maxWidth / maxHeight < ratio) DpSize(maxWidth, maxWidth / ratio) else DpSize(maxHeight * ratio, maxHeight)
            ScaleType.FIT_WIDTH -> DpSize(maxWidth, maxWidth / ratio)
            ScaleType.FIT_HEIGHT -> DpSize(maxHeight * ratio, maxHeight)
            ScaleType.ORIGINAL -> (PAGE_WIDTH * if (crop) 1 - 2 * PageMockMargin else 1f).let { DpSize(it, it / ratio) }
        }
        Box(
            Modifier.fillMaxSize()
                .then(if (size.height > maxHeight) Modifier.verticalScroll(rememberScrollState()) else Modifier)
                // Right to left starts at the page's right edge, where its reading starts.
                .then(if (size.width > maxWidth) Modifier.horizontalScroll(rememberScrollState(), reverseScrolling = rtl) else Modifier),
            contentAlignment = Alignment.Center,
        ) {
            PageImage(number, crop, Modifier.size(size))
        }
    }
}

/**
 * Long strip modes: scroll down. Taps follow the tap-zones setting: back and forward scroll most of a screen (a strip
 * of the last view stays for context), the menu zone shows the menus.
 */
@Composable
private fun StripReader(
    pageCount: Int,
    page: Int,
    settings: ReaderSettings,
    onPage: (Int) -> Unit,
    onCentreTap: () -> Unit,
) {
    val listState = rememberLazyListState(initialFirstVisibleItemIndex = (page - 1).coerceIn(0, pageCount - 1))
    val scope = rememberCoroutineScope()
    val animate = settings.animatePageTransitions
    val zones = settings.tapZones
    val menusLabel = stringResource(R.string.reader_tap_menus)
    LaunchedEffect(listState.firstVisibleItemIndex) { onPage(listState.firstVisibleItemIndex + 1) }
    LaunchedEffect(page) {
        val target = (page - 1).coerceIn(0, pageCount - 1)
        when {
            listState.firstVisibleItemIndex == target -> Unit
            animate && abs(listState.firstVisibleItemIndex - target) == 1 -> listState.animateScrollToItem(target)
            else -> listState.scrollToItem(target)
        }
    }
    LazyColumn(
        state = listState,
        modifier = Modifier.fillMaxSize()
            .semantics { customActions = listOf(CustomAccessibilityAction(menusLabel) { onCentreTap(); true }) }
            .pointerInput(zones, animate) {
                detectTapGestures { offset ->
                    val step = size.height * STRIP_STEP
                    when (tapZoneAt(zones, offset.x / size.width, offset.y / size.height, mirror = false)) {
                        TapZoneKind.MENU -> onCentreTap()
                        TapZoneKind.PREVIOUS -> scope.launch { listState.scrollStrip(-step, animate) }
                        TapZoneKind.NEXT -> scope.launch { listState.scrollStrip(step, animate) }
                    }
                }
            },
        verticalArrangement = Arrangement.spacedBy(if (settings.readingMode == ReadingMode.LONG_STRIP_GAPS) EchoSpacing.s else 0.dp),
    ) {
        itemsIndexed(List(pageCount) { it }) { index, _ ->
            PageImage(index + 1, settings.cropBorders, Modifier.fillMaxWidth().aspectRatio(pageRatio(settings.cropBorders)))
        }
    }
}

private suspend fun LazyListState.scrollStrip(by: Float, animate: Boolean) {
    if (animate) animateScrollBy(by) else scrollBy(by)
}

/** How far a tap scrolls the long strip, as a share of the screen. */
private const val STRIP_STEP = 0.8f

/** Width / height of a page (Figma: 412 × 640). Real pages will bring their own ratio. */
private const val PAGE_RATIO = 412f / 640f
/** A page's own width, for the Original scale type (the Figma page is 412 dp wide). */
private val PAGE_WIDTH = 412.dp

/**
 * Width / height of a page as drawn: with "Crop borders" the paper margin is gone on all four sides. The margin is a
 * share of the page's shorter side (its width), so the height loses as much as the width does.
 */
private fun pageRatio(crop: Boolean) =
    if (!crop) PAGE_RATIO else (1 - 2 * PageMockMargin) / (1 / PAGE_RATIO - 2 * PageMockMargin)

/** Reader background setting (S.10 / 2.8): Black is the default, as in Figma. */
@Composable
private fun readerBackground(background: ReaderBackground) = when (background) {
    ReaderBackground.BLACK -> MaterialTheme.colorScheme.scrim
    ReaderBackground.GRAY -> MaterialTheme.colorScheme.surfaceContainerHighest
    ReaderBackground.WHITE -> BaselineLightColorScheme.surface
    ReaderBackground.AUTO -> MaterialTheme.colorScheme.background
}

/**
 * A page filling [modifier]'s size: a placeholder panel until the sources give real images. With [crop], the page is
 * drawn larger than its box, centred, and the paper margin round it clipped away (real pages will need their blank
 * edges measured instead).
 */
@Composable
private fun PageImage(number: Int, crop: Boolean, modifier: Modifier) {
    val described = Modifier.semantics { contentDescription = "Page $number" }
    if (!crop) {
        PageMock(modifier.then(described))
        return
    }
    Box(modifier.then(described).clipToBounds()) {
        PageMock(
            Modifier.layout { measurable, constraints ->
                val width = (constraints.maxWidth / (1 - 2 * PageMockMargin)).roundToInt()
                val height = (width / PAGE_RATIO).roundToInt()
                val placeable = measurable.measure(Constraints.fixed(width, height))
                layout(constraints.maxWidth, constraints.maxHeight) {
                    placeable.place((constraints.maxWidth - width) / 2, (constraints.maxHeight - height) / 2)
                }
            },
        )
    }
}

/** Status and navigation bars show with the menus and hide while reading (Figma 2.6 vs 2.7). */
@Composable
private fun ReaderSystemBars(menusShown: Boolean) {
    val view = LocalView.current
    if (view.isInEditMode) return
    DisposableEffect(menusShown) {
        val window = (view.context as? Activity)?.window
        val controller = window?.let { WindowCompat.getInsetsController(it, view) }
        controller?.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        if (menusShown) controller?.show(WindowInsetsCompat.Type.systemBars()) else controller?.hide(WindowInsetsCompat.Type.systemBars())
        onDispose { controller?.show(WindowInsetsCompat.Type.systemBars()) }
    }
}

@Composable
private fun ReaderOverlays(
    state: MangaReaderUiState,
    gallery: Gallery,
    onBack: () -> Unit,
    onPage: (Int) -> Unit,
    onOpenSheet: (ReaderSheet) -> Unit,
    onEditReading: (ReaderSettings.() -> ReaderSettings) -> Unit,
) {
    ReaderSystemBars(state.menusShown)
    val activity = LocalContext.current.findActivity()
    var landscape by rememberSaveable { mutableStateOf(false) }
    val rotate = { landscape = !landscape }
    DisposableEffect(activity, landscape) {
        activity?.requestedOrientation =
            if (landscape) ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE else ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
        // Leaving the reader gives the screen back its orientation. Not while the activity is recreated for the
        // rotation itself: resetting then would snap straight back to portrait.
        onDispose {
            if (activity?.isChangingConfigurations != true) activity?.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
        }
    }
    val rtl = state.settings.readingMode == ReadingMode.PAGED_RTL
    val zones = state.settings.tapZones

    // The hint shows the zones in use; none when tap zones are off.
    if (state.hintsShown && !state.menusShown && zones != TapZones.OFF) {
        val previous = stringResource(R.string.reader_tap_previous)
        val next = stringResource(R.string.reader_tap_next)
        val menus = stringResource(R.string.reader_tap_menus)
        if (zones == TapZones.DEFAULT) {
            TapZonesOverlay(
                leftLabel = if (rtl) next else previous,
                rightLabel = if (rtl) previous else next,
                centreLabel = menus,
                modifier = Modifier.fillMaxSize(),
            )
        } else {
            TapZonesGrid(tapZoneGrid(zones, mirror = rtl), previous, next, menus, Modifier.fillMaxSize())
        }
    }
    if (state.hintsShown && !state.menusShown) {
        Box(Modifier.fillMaxSize().padding(top = 96.dp), contentAlignment = Alignment.TopCenter) {
            ReadingModeHint(stringResource(modeHint(state.settings.readingMode)), EchoIcons.MenuBook)
        }
    }

    if (state.menusShown) {
        // Floating top bar below the status bar (Figma 2.6: title 16 sp semibold, page pill, more).
        Box(
            Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.statusBars)
                .padding(horizontal = EchoSpacing.m, vertical = EchoSpacing.s),
            contentAlignment = Alignment.TopCenter,
        ) {
            Surface(
                shape = MaterialTheme.shapes.extraLarge,
                color = MaterialTheme.colorScheme.surfaceContainer.copy(alpha = 0.86f),
                contentColor = MaterialTheme.colorScheme.onSurface,
            ) {
                Row(Modifier.fillMaxWidth().padding(EchoSpacing.xs), verticalAlignment = Alignment.CenterVertically) {
                    EchoIconButton(EchoIcons.ArrowBack, stringResource(app.echo.designsystem.R.string.echo_cd_back), onBack)
                    Column(Modifier.weight(1f).padding(start = EchoSpacing.xs)) {
                        Text(gallery.title, style = MaterialTheme.typography.titleMediumEmphasized, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        gallery.artist?.let {
                            Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1)
                        }
                    }
                    Surface(shape = EchoShapes.Full, color = MaterialTheme.colorScheme.inverseSurface) {
                        Text(
                            "${state.page} / ${gallery.pageCount}",
                            style = MaterialTheme.typography.labelLargeEmphasized,
                            modifier = Modifier.padding(horizontal = EchoSpacing.m, vertical = EchoSpacing.xs),
                        )
                    }
                    ReaderMenu(gallery)
                }
            }
        }
        Box(Modifier.fillMaxSize().padding(EchoSpacing.screenMargin), contentAlignment = Alignment.BottomCenter) {
            ReaderBottomBar(
                page = state.page,
                pageCount = gallery.pageCount,
                onPage = onPage,
                actions = listOf(
                    ReaderAction(
                        label = stringResource(if (rtl) R.string.reader_action_rtl else R.string.reader_action_ltr),
                        icon = EchoIcons.MenuBook,
                        onClick = { onEditReading { copy(readingMode = if (readingMode == ReadingMode.PAGED_RTL) ReadingMode.PAGED_LTR else ReadingMode.PAGED_RTL) } },
                        // The current reading mode is the highlighted action (Figma 2.6).
                        selected = true,
                    ),
                    // Rotate flips between portrait and landscape while the reader is open.
                    ReaderAction(stringResource(R.string.reader_action_rotate), EchoIcons.RotateLeft, onClick = rotate, selected = landscape),
                    ReaderAction(
                        label = stringResource(R.string.reader_action_crop), icon = EchoIcons.Crop,
                        onClick = { onEditReading { copy(cropBorders = !cropBorders) } },
                        selected = state.settings.cropBorders,
                    ),
                    ReaderAction(stringResource(R.string.reader_action_pages), EchoIcons.GridView, onClick = { onOpenSheet(ReaderSheet.PAGES) }),
                    ReaderAction(stringResource(R.string.reader_action_settings), EchoIcons.Settings, onClick = { onOpenSheet(ReaderSheet.SETTINGS) }),
                ),
            )
        }
    } else if (state.settings.showPageNumber) {
        Box(Modifier.fillMaxSize().padding(bottom = EchoSpacing.l), contentAlignment = Alignment.BottomCenter) {
            PageNumber(state.page, gallery.pageCount)
        }
    }
}

private fun modeHint(mode: ReadingMode) = when (mode) {
    ReadingMode.PAGED_RTL -> R.string.reader_mode_rtl_hint
    ReadingMode.PAGED_LTR, ReadingMode.TWO_PAGES -> R.string.reader_mode_ltr_hint
    ReadingMode.PAGED_VERTICAL -> R.string.reader_mode_vertical
    ReadingMode.LONG_STRIP, ReadingMode.LONG_STRIP_GAPS -> R.string.reader_mode_strip
}

@EchoScreenPreviews
@Composable
private fun MangaReaderScreenPreview(@PreviewParameter(EchoPreviewThemes::class) theme: EchoPreviewTheme) = EchoTheme(theme.config) {
    Surface {
        MangaReaderScreen(
            state = MangaReaderUiState(
                gallery = Load.Content(Gallery("g1", "Gallery title placeholder", "Artist Name", 52, "JP")),
                page = 34, menusShown = true, hintsShown = false,
            ),
            onBack = {}, onPage = {}, onCentreTap = {}, onEnd = {}, onOpenSheet = {}, onCloseSheet = {}, onHideHints = {},
            onRetry = {}, onEditDisplay = {}, onEditReading = {}, onToggleForGallery = {},
        )
    }
}

/** The reader's ⋮: Share and Open on 3hentai. */
@Composable
private fun ReaderMenu(gallery: Gallery) {
    var open by remember { mutableStateOf(false) }
    val context = LocalContext.current
    val uri = LocalUriHandler.current
    Box {
        EchoIconButton(EchoIcons.MoreVert, stringResource(app.echo.designsystem.R.string.echo_cd_more), { open = true })
        DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            DropdownMenuItem(
                text = { Text(stringResource(R.string.menu_share)) },
                leadingIcon = { Icon(painterResource(EchoIcons.Share), null) },
                onClick = { open = false; context.shareText("${gallery.title}\n${galleryUrl(gallery.id)}") },
            )
            DropdownMenuItem(
                text = { Text(stringResource(R.string.menu_open_site, "3hentai")) },
                leadingIcon = { Icon(painterResource(EchoIcons.OpenInNew), null) },
                onClick = { open = false; uri.openUri(galleryUrl(gallery.id)) },
            )
        }
    }
}

private fun Context.findActivity(): Activity? = when (this) {
    is Activity -> this
    is ContextWrapper -> baseContext.findActivity()
    else -> null
}
