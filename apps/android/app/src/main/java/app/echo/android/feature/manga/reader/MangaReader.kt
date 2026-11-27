package app.echo.android.feature.manga.reader

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
        if (loaded != null) viewModelScope.launch { library.saveReadProgress(loaded, clamped, finished = clamped >= loaded.pageCount) }
    }

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
        MangaReaderViewModel(galleryId, page, showPages, it.manga, it.library, it.settings, it.readerPrefs)
    }
    val state by vm.state.collectAsStateWithLifecycle()
    MangaReaderScreen(
        state = state,
        onBack = shell::back,
        onPage = vm::setPage,
        onCentreTap = vm::toggleMenus,
        onEnd = { shell.open(Route.EndOfGallery(galleryId)) },
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

@Composable
private fun ReaderPages(
    state: MangaReaderUiState,
    gallery: Gallery,
    onPage: (Int) -> Unit,
    onCentreTap: () -> Unit,
    onEnd: () -> Unit,
) {
    when (state.settings.readingMode) {
        ReadingMode.PAGED_RTL -> PagedReader(gallery.pageCount, state.page, rtl = true, onPage, onCentreTap, onEnd)
        ReadingMode.PAGED_LTR, ReadingMode.TWO_PAGES -> PagedReader(gallery.pageCount, state.page, rtl = false, onPage, onCentreTap, onEnd)
        ReadingMode.PAGED_VERTICAL, ReadingMode.LONG_STRIP, ReadingMode.LONG_STRIP_GAPS ->
            StripReader(gallery.pageCount, state.page, gaps = state.settings.readingMode == ReadingMode.LONG_STRIP_GAPS, onPage, onCentreTap)
    }
}

/** Paged modes: swipe, or tap a side. Swiping past the last page opens 2.10. */
@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun PagedReader(
    pageCount: Int,
    page: Int,
    rtl: Boolean,
    onPage: (Int) -> Unit,
    onCentreTap: () -> Unit,
    onEnd: () -> Unit,
) {
    // One extra slot after the last page: reaching it means the gallery is finished.
    val pagerState = rememberPagerState(initialPage = (page - 1).coerceIn(0, pageCount - 1), pageCount = { pageCount + 1 })
    val scope = rememberCoroutineScope()
    LaunchedEffect(pagerState.settledPage) {
        if (pagerState.settledPage < pageCount) onPage(pagerState.settledPage + 1) else onEnd()
    }
    LaunchedEffect(page) {
        val target = (page - 1).coerceIn(0, pageCount - 1)
        if (pagerState.currentPage != target) pagerState.animateScrollToPage(target)
    }
    val nextLabel = stringResource(R.string.reader_tap_next)
    val previousLabel = stringResource(R.string.reader_tap_previous)
    val menusLabel = stringResource(R.string.reader_tap_menus)
    HorizontalPager(
        state = pagerState,
        reverseLayout = rtl,
        // TalkBack can't tap a third of the screen: the same moves as actions.
        modifier = Modifier.fillMaxSize()
            .semantics {
                customActions = listOf(
                    CustomAccessibilityAction(nextLabel) { scope.launch { pagerState.animateScrollToPage((pagerState.currentPage + 1).coerceIn(0, pageCount)) }; true },
                    CustomAccessibilityAction(previousLabel) { scope.launch { pagerState.animateScrollToPage((pagerState.currentPage - 1).coerceAtLeast(0)) }; true },
                    CustomAccessibilityAction(menusLabel) { onCentreTap(); true },
                )
            }
            .pointerInput(rtl, pageCount) {
            detectTapGestures { offset ->
                val third = size.width / 3f
                val step = when {
                    offset.x < third -> if (rtl) 1 else -1
                    offset.x > size.width - third -> if (rtl) -1 else 1
                    else -> 0
                }
                if (step == 0) {
                    onCentreTap()
                } else {
                    scope.launch { pagerState.animateScrollToPage((pagerState.currentPage + step).coerceIn(0, pageCount)) }
                }
            }
        },
    ) { index ->
        // Each slot is the whole screen; the page inside keeps its ratio ("Fit screen", Figma 2.6 / 2.7).
        if (index < pageCount) ReaderPage(index + 1, Modifier.fillMaxSize()) else Box(Modifier.fillMaxSize())
    }
}

/** Long strip modes: scroll down, tap the middle to show the menus. */
@Composable
private fun StripReader(
    pageCount: Int,
    page: Int,
    gaps: Boolean,
    onPage: (Int) -> Unit,
    onCentreTap: () -> Unit,
) {
    val listState = rememberLazyListState(initialFirstVisibleItemIndex = (page - 1).coerceIn(0, pageCount - 1))
    val menusLabel = stringResource(R.string.reader_tap_menus)
    LaunchedEffect(listState.firstVisibleItemIndex) { onPage(listState.firstVisibleItemIndex + 1) }
    LaunchedEffect(page) {
        val target = (page - 1).coerceIn(0, pageCount - 1)
        if (listState.firstVisibleItemIndex != target) listState.animateScrollToItem(target)
    }
    LazyColumn(
        state = listState,
        modifier = Modifier.fillMaxSize()
            .semantics { customActions = listOf(CustomAccessibilityAction(menusLabel) { onCentreTap(); true }) }
            .pointerInput(Unit) { detectTapGestures { onCentreTap() } },
        verticalArrangement = Arrangement.spacedBy(if (gaps) EchoSpacing.s else 0.dp),
    ) {
        itemsIndexed(List(pageCount) { it }) { index, _ ->
            ReaderPage(index + 1, Modifier.fillMaxWidth().aspectRatio(PAGE_RATIO))
        }
    }
}

/** Width / height of a page (Figma: 412 × 640). Real pages will bring their own ratio. */
private const val PAGE_RATIO = 412f / 640f

/** Reader background setting (S.10 / 2.8): Black is the default, as in Figma. */
@Composable
private fun readerBackground(background: ReaderBackground) = when (background) {
    ReaderBackground.BLACK -> MaterialTheme.colorScheme.scrim
    ReaderBackground.GRAY -> MaterialTheme.colorScheme.surfaceContainerHighest
    ReaderBackground.WHITE -> BaselineLightColorScheme.surface
    ReaderBackground.AUTO -> MaterialTheme.colorScheme.background
}

/** A page: a placeholder panel until the sources give real images. */
@Composable
private fun ReaderPage(number: Int, modifier: Modifier = Modifier) {
    // Full bleed: a page fills its slot edge to edge, as in the immersive frames.
    // Fit screen: the page keeps its ratio inside its slot and is centred, letterboxed by the reader background
    // (Figma "Page 34 (Fit screen)" 412 × 640 on a 412 × 917 screen). Never stretched past the screen.
    Box(modifier, contentAlignment = Alignment.Center) {
        PageMock(Modifier.aspectRatio(PAGE_RATIO).semantics { contentDescription = "Page $number" })
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
    val rotate = {
        landscape = !landscape
        activity?.requestedOrientation =
            if (landscape) ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE else ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
    }
    // Leaving the reader gives the screen back its orientation.
    DisposableEffect(Unit) { onDispose { activity?.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED } }
    val rtl = state.settings.readingMode == ReadingMode.PAGED_RTL
    val paged = rtl || state.settings.readingMode == ReadingMode.PAGED_LTR || state.settings.readingMode == ReadingMode.TWO_PAGES

    if (state.hintsShown && !state.menusShown && paged) {
        TapZonesOverlay(
            leftLabel = stringResource(if (rtl) R.string.reader_tap_next else R.string.reader_tap_previous),
            rightLabel = stringResource(if (rtl) R.string.reader_tap_previous else R.string.reader_tap_next),
            centreLabel = stringResource(R.string.reader_tap_menus),
            modifier = Modifier.fillMaxSize(),
        )
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
    } else {
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
