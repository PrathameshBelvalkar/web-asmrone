package app.echo.android.feature.hentai.title

import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.contentDescription
import app.echo.designsystem.component.echo.CoverKeys
import app.echo.designsystem.component.m3e.InfoChips
import android.content.ClipData
import android.content.Intent
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.windowInsetsTopHeight
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.FilledTonalIconButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.ClipEntry
import androidx.compose.ui.platform.LocalClipboard
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.tooling.preview.PreviewParameter
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.echo.android.R
import app.echo.android.feature.hentai.TitleRow
import app.echo.android.feature.hentai.GRID_COLUMNS
import app.echo.android.feature.hentai.compactCount
import app.echo.android.feature.hentai.titleCount
import app.echo.android.feature.jav.clock
import app.echo.android.feature.manga.LoadFallback
import app.echo.android.navigation.Route
import app.echo.android.navigation.ShellActions
import app.echo.android.ui.echoViewModel
import app.echo.data.fake.FakeCatalog
import app.echo.data.model.HentaiTitle
import app.echo.data.model.Section
import app.echo.data.repository.ErrorKind
import app.echo.data.repository.HentaiRepository
import app.echo.data.repository.LibraryRepository
import app.echo.data.repository.Load
import app.echo.designsystem.component.echo.CoverImage
import app.echo.designsystem.component.echo.LikeButton
import app.echo.designsystem.component.echo.ReaderTheme
import app.echo.designsystem.component.echo.ShelfHeader
import app.echo.designsystem.component.echo.StudioLink
import app.echo.designsystem.component.echo.TitleHero
import app.echo.designsystem.component.m3e.BadgeStyle
import app.echo.designsystem.component.m3e.ButtonStyle
import app.echo.designsystem.component.m3e.CarouselStyle
import app.echo.designsystem.component.m3e.ChipRow
import app.echo.designsystem.component.m3e.ChipSpec
import app.echo.designsystem.component.m3e.ChipStyle
import app.echo.designsystem.component.m3e.ComponentSize
import app.echo.designsystem.component.m3e.CoverBadge
import app.echo.designsystem.component.m3e.CoverCarousel
import app.echo.designsystem.component.m3e.EchoButton
import app.echo.designsystem.component.m3e.EchoIconButton
import app.echo.designsystem.component.m3e.IconButtonStyle
import app.echo.designsystem.component.m3e.SegmentedList
import app.echo.designsystem.component.m3e.SegmentedListItem
import app.echo.designsystem.icon.EchoIcons
import app.echo.designsystem.preview.EchoPreviewTheme
import app.echo.designsystem.preview.EchoPreviewThemes
import app.echo.designsystem.preview.EchoScreenPreviews
import app.echo.designsystem.theme.EchoShapes
import app.echo.designsystem.theme.EchoTheme
import app.echo.designsystem.tokens.EchoSpacing
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

// H.7 Title page -----------------------------------------------------------------------------------------------------

/** H.7: the title, where it was left (episode and position), similar titles and the studio's count. */
data class HentaiTitleUiState(
    val title: Load<HentaiTitle> = Load.Loading,
    val resumeEpisode: Int? = null,
    val resumeMs: Long = 0,
    val similar: List<HentaiTitle> = emptyList(),
    val studioCount: Int = 0,
)

class HentaiTitleViewModel(id: String, hentai: HentaiRepository, library: LibraryRepository) : ViewModel() {
    private val reloads = MutableStateFlow(0)

    val state: StateFlow<HentaiTitleUiState> = reloads.flatMapLatest {
        combine(hentai.title(id), hentai.catalog(), library.history(Section.HENTAI)) { title, all, history ->
            val t = (title as? Load.Content)?.value
            val catalog = (all as? Load.Content)?.value.orEmpty()
            val left = history.firstOrNull { it.id == id && !it.finished }
            HentaiTitleUiState(
                title = title,
                resumeEpisode = left?.episode,
                resumeMs = left?.positionMs ?: 0,
                similar = t?.let { me -> catalog.filter { it.id != me.id && it.tags.intersect(me.tags.toSet()).size >= 2 }.take(SIMILAR) }.orEmpty(),
                studioCount = t?.let { me -> catalog.count { it.studio == me.studio } } ?: 0,
            )
        }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), HentaiTitleUiState())

    fun retry() { reloads.value += 1 }

    private companion object {
        const val SIMILAR = 6
    }
}

private const val SITE = "https://hanime.tv/"

@Composable
fun HentaiTitleRoute(id: String, shell: ShellActions, contentPadding: PaddingValues) {
    val vm = echoViewModel(key = "hentai-$id") { HentaiTitleViewModel(id, it.hentai, it.library) }
    val state by vm.state.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val uri = LocalUriHandler.current
    val clipboard = LocalClipboard.current
    val scope = rememberCoroutineScope()
    HentaiTitleScreen(
        state = state,
        contentPadding = contentPadding,
        onBack = shell::back,
        onRetry = vm::retry,
        onCopy = { t -> scope.launch { clipboard.setClipEntry(ClipEntry(ClipData.newPlainText(t.title, t.title))) } },
        onCopyText = { text -> scope.launch { clipboard.setClipEntry(ClipEntry(ClipData.newPlainText(text, text))) } },
        onOpenSite = { uri.openUri(SITE) },
        onShare = { t ->
            val send = Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, "${t.title}\n$SITE")
            context.startActivity(Intent.createChooser(send, null))
        },
        onStudio = { shell.open(Route.HentaiTitles(studio = it)) },
        onWatch = { episode -> shell.open(Route.HentaiTheater(id, episode)) },
        onSimilar = { tag -> shell.open(Route.HentaiTitles(tag = tag)) },
        onTitle = { shell.open(Route.HentaiTitle(it)) },
    )
}

/** Figma H.7 Title page (28:6186). An error from the source shows the H.10 state instead. */
@Composable
fun HentaiTitleScreen(
    state: HentaiTitleUiState,
    contentPadding: PaddingValues,
    onBack: () -> Unit,
    onRetry: () -> Unit,
    onCopy: (HentaiTitle) -> Unit,
    onOpenSite: () -> Unit,
    onShare: (HentaiTitle) -> Unit,
    onStudio: (String) -> Unit,
    onWatch: (episode: Int) -> Unit,
    onSimilar: (String) -> Unit,
    onTitle: (String) -> Unit,
    onCopyText: (String) -> Unit = {},
) {
    var preview by rememberSaveable { mutableIntStateOf(-1) }
    var liked by rememberSaveable { mutableStateOf(false) }
    var synopsisOpen by rememberSaveable { mutableStateOf(false) }
    val load = state.title
    Box(Modifier.fillMaxSize().testTag("screen:H.7")) {
        when (load) {
            is Load.Error -> {
                TitleStates(load.kind, onRetry = onRetry, onBack = onBack)
                return@Box
            }
            !is Load.Content -> {
                LoadFallback(load, onRetry)
                return@Box
            }
            else -> Unit
        }
        val t = load.value
        val episode = state.resumeEpisode ?: t.episodes.firstOrNull()?.number ?: 1
        val minutes = (t.episodes.firstOrNull()?.durationMs ?: 0) / 60_000
        val list = rememberLazyListState()
        LazyColumn(
            Modifier.fillMaxSize(),
            state = list,
            contentPadding = PaddingValues(bottom = contentPadding.calculateBottomPadding() + EchoSpacing.l),
            verticalArrangement = Arrangement.spacedBy(EchoSpacing.m),
        ) {
            item("hero") {
                TitleHero(
                    backdrop = t.posterUrl, cover = t.coverUrl, title = t.title, onBack = onBack, coverKey = CoverKeys.title(t.id),
                    badges = {
                        if (t.uncensored) CoverBadge(stringResource(R.string.hentai_uncensored_badge).uppercase(), style = BadgeStyle.Overlay)
                        CoverBadge(stringResource(R.string.hentai_ep_badge, episode), style = BadgeStyle.Accent)
                    },
                    details = { StudioLink(t.studio, titleCount(state.studioCount), { onStudio(t.studio) }) },
                    actions = {
                        EchoIconButton(EchoIcons.ContentCopy, stringResource(R.string.hentai_copy_title), { onCopy(t) }, style = IconButtonStyle.Tonal)
                        EchoIconButton(EchoIcons.OpenInNew, stringResource(R.string.hentai_open_site), onOpenSite, style = IconButtonStyle.Tonal)
                    },
                )
            }
            item("dates") {
                Text(
                    stringResource(R.string.hentai_released_added, t.released, t.added),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(horizontal = 20.dp),
                )
            }
            item("chips") {
                // Facts about the video, not actions.
                InfoChips(
                    listOfNotNull(
                        ChipSpec(t.quality, EchoIcons.MovieFilled),
                        ChipSpec(stringResource(R.string.hentai_minutes, minutes), EchoIcons.Timer),
                        t.subtitles?.let { ChipSpec(stringResource(R.string.hentai_sub, it), EchoIcons.Subtitles) },
                        t.dub?.let { ChipSpec(stringResource(R.string.hentai_dub, it), EchoIcons.Language) },
                    ),
                )
            }
            item("actions") {
                Row(
                    Modifier.fillMaxWidth().padding(horizontal = EchoSpacing.screenMargin),
                    horizontalArrangement = Arrangement.spacedBy(EchoSpacing.s),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    EchoButton(
                        if (state.resumeEpisode != null) stringResource(R.string.hentai_resume_ep, episode, clock(state.resumeMs))
                        else stringResource(R.string.hentai_watch),
                        { onWatch(episode) }, Modifier.weight(1f), size = ComponentSize.M, icon = EchoIcons.PlayArrowFilled,
                    )
                    LikeButton(liked, { liked = !liked })
                    EchoIconButton(EchoIcons.Share, stringResource(R.string.hentai_share), { onShare(t) }, style = IconButtonStyle.Outlined, size = ComponentSize.M)
                }
            }
            item("stats") { Stats(t) }
            item("synopsis") {
                Column {
                    ShelfHeader(stringResource(R.string.hentai_synopsis))
                    Text(
                        t.synopsis, style = MaterialTheme.typography.bodyMedium,
                        maxLines = if (synopsisOpen) Int.MAX_VALUE else SYNOPSIS_LINES, overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.padding(horizontal = EchoSpacing.screenMargin),
                    )
                    EchoButton(
                        stringResource(if (synopsisOpen) R.string.hentai_show_less else R.string.hentai_show_more),
                        { synopsisOpen = !synopsisOpen }, Modifier.padding(start = EchoSpacing.xs), style = ButtonStyle.Text, size = ComponentSize.XS,
                    )
                }
            }
            if (t.altNames.isNotEmpty()) {
                item("alt") {
                    Column {
                        ShelfHeader(stringResource(R.string.hentai_alt_names))
                        // Tapping a name copies it.
                        ChipRow(t.altNames.map { ChipSpec(it, EchoIcons.ContentCopy) }, onClick = { onCopyText(t.altNames[it]) }, style = ChipStyle.Assist)
                    }
                }
            }
            item("preview") {
                Column {
                    ShelfHeader(stringResource(R.string.hentai_preview_frames, t.frames), onClick = { preview = 0 })
                    CoverCarousel(t.frames, style = CarouselStyle.MultiBrowse, height = 124.dp) { i ->
                        val frameLabel = stringResource(R.string.a11y_frame, i + 1, clock(frameTime(t, i)))
                        Box(
                            Modifier.fillMaxSize().maskClip(MaterialTheme.shapes.largeIncreased)
                                .semantics(mergeDescendants = true) { contentDescription = frameLabel }
                                .clickable { preview = i },
                        ) {
                            CoverImage(null, null, Modifier.fillMaxSize(), shape = null)
                            TimePill(clock(frameTime(t, i)), Modifier.align(Alignment.BottomStart).padding(EchoSpacing.s))
                        }
                    }
                }
            }
            item("episodes") {
                Column {
                    ShelfHeader(stringResource(R.string.hentai_more_from, t.series ?: t.title))
                    SegmentedList {
                        t.episodes.forEach { ep ->
                            item {
                                val current = ep.number == episode
                                SegmentedListItem(
                                    headline = stringResource(R.string.hentai_episode, ep.number),
                                    supporting = if (current) stringResource(R.string.hentai_this_title) else ep.released,
                                    onClick = { onWatch(ep.number) },
                                    selected = current,
                                    leading = {
                                        val shape = RoundedCornerShape(10.dp)
                                        CoverImage(null, null, Modifier.size(64.dp, 36.dp).border(1.dp, MaterialTheme.colorScheme.outlineVariant, shape), shape = shape)
                                    },
                                    trailing = if (current) null else {
                                        { EchoIconButton(EchoIcons.PlayArrowFilled, stringResource(R.string.hentai_watch), { onWatch(ep.number) }) }
                                    },
                                )
                            }
                        }
                    }
                }
            }
            if (state.similar.isNotEmpty()) {
                item("similar-head") { ShelfHeader(stringResource(R.string.hentai_similar), onClick = { t.tags.firstOrNull()?.let(onSimilar) }) }
                items(state.similar.chunked(GRID_COLUMNS), key = { "similar-" + it.first().id }) { row -> TitleRow(row, onTitle) }
            }
        }
        // The hero sits under the status bar; once it scrolls away, a surface strip keeps the content off the clock.
        val heroPx = with(androidx.compose.ui.platform.LocalDensity.current) { HERO_HEIGHT.toPx() }
        Box(
            Modifier.fillMaxWidth().windowInsetsTopHeight(WindowInsets.statusBars)
                .graphicsLayer {
                    alpha = if (list.firstVisibleItemIndex > 0) 1f else (list.firstVisibleItemScrollOffset / heroPx).coerceIn(0f, 1f)
                }
                .background(MaterialTheme.colorScheme.surface),
        )
        if (preview >= 0) PreviewViewer(t, preview, onDismiss = { preview = -1 })
    }
}

private const val SYNOPSIS_LINES = 3

/** Figma "Echo · Title hero": 372 dp. */
private val HERO_HEIGHT = 372.dp

/** Where storyboard frame [i] sits in the first episode. */
private fun frameTime(t: HentaiTitle, i: Int): Long = (t.episodes.firstOrNull()?.durationMs ?: 0) * i / t.frames.coerceAtLeast(1)

/** The four stat tiles (Figma "Cards (Filled) — stats"): views, likes, rating, downloads. */
@Composable
private fun Stats(t: HentaiTitle) {
    Row(Modifier.fillMaxWidth().padding(horizontal = EchoSpacing.screenMargin), horizontalArrangement = Arrangement.spacedBy(EchoSpacing.s)) {
        Stat(EchoIcons.VisibilityFilled, compactCount(t.views), R.string.hentai_views, Modifier.weight(1f))
        Stat(EchoIcons.ThumbUpFilled, compactCount(t.likes), R.string.hentai_likes, Modifier.weight(1f))
        Stat(EchoIcons.StarFilled, "${t.rating}%", R.string.hentai_rating, Modifier.weight(1f))
        Stat(EchoIcons.DownloadFilled, compactCount(t.downloads), R.string.hentai_downloads, Modifier.weight(1f))
    }
}

@Composable
private fun Stat(icon: Int, value: String, label: Int, modifier: Modifier) {
    Column(
        modifier.clip(MaterialTheme.shapes.large).background(MaterialTheme.colorScheme.surfaceContainer).padding(vertical = 10.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        Icon(painterResource(icon), null, Modifier.size(18.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value, style = MaterialTheme.typography.titleSmall)
        Text(stringResource(label), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun TimePill(text: String, modifier: Modifier = Modifier) = Text(
    text,
    style = MaterialTheme.typography.labelSmallEmphasized,
    color = MaterialTheme.colorScheme.inverseOnSurface,
    modifier = modifier.clip(EchoShapes.Full).background(MaterialTheme.colorScheme.inverseSurface.copy(alpha = 0.85f))
        .padding(horizontal = 8.dp, vertical = 2.dp),
)

// H.8 Preview viewer -------------------------------------------------------------------------------------------------

/** Figma H.8 Preview viewer (28:5951): full-screen, dark; the frame, its time, a strip of frames, previous · next. */
@Composable
private fun PreviewViewer(t: HentaiTitle, start: Int, onDismiss: () -> Unit) {
    var index by rememberSaveable { mutableIntStateOf(start) }
    val strip = rememberLazyListState()
    val res = androidx.compose.ui.platform.LocalContext.current.resources
    val frameLabel = { i: Int -> res.getString(R.string.a11y_frame, i + 1, clock(frameTime(t, i))) }
    LaunchedEffect(index) { strip.animateScrollToItem((index - STRIP_CENTRE).coerceAtLeast(0)) }
    Dialog(onDismissRequest = onDismiss, properties = DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false)) {
        ReaderTheme {
            Surface(color = PreviewBackground, contentColor = Color.White) {
            Column(Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding().testTag("overlay:H.8")) {
                Row(Modifier.fillMaxWidth().padding(horizontal = EchoSpacing.xs, vertical = EchoSpacing.s), verticalAlignment = Alignment.CenterVertically) {
                    EchoIconButton(EchoIcons.Close, stringResource(app.echo.designsystem.R.string.echo_cd_back), onDismiss)
                    Text(stringResource(R.string.hentai_preview), style = MaterialTheme.typography.titleLarge, modifier = Modifier.weight(1f))
                    Text(
                        stringResource(R.string.hentai_frame_of, index + 1, t.frames),
                        style = MaterialTheme.typography.labelMediumEmphasized,
                        color = MaterialTheme.colorScheme.inverseOnSurface,
                        modifier = Modifier.padding(end = EchoSpacing.l).clip(EchoShapes.Full).background(MaterialTheme.colorScheme.inverseSurface)
                            .padding(horizontal = 10.dp, vertical = 4.dp),
                    )
                }
                Spacer(Modifier.weight(1f))
                CoverImage(null, null, Modifier.fillMaxWidth().padding(horizontal = 12.dp).aspectRatio(16f / 9f), shape = MaterialTheme.shapes.extraLarge)
                TimePill(clock(frameTime(t, index)), Modifier.align(Alignment.CenterHorizontally).padding(top = EchoSpacing.l))
                Spacer(Modifier.weight(1f))
                LazyRow(
                    state = strip,
                    contentPadding = PaddingValues(horizontal = EchoSpacing.screenMargin),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    items(t.frames) { i ->
                        val shape = RoundedCornerShape(6.dp)
                        Box(
                            Modifier.width(48.dp).height(28.dp).clip(shape)
                                .border(if (i == index) 2.dp else 0.dp, if (i == index) Color.White else Color.Transparent, shape)
                                .semantics { contentDescription = frameLabel(i); selected = i == index }
                                .clickable { index = i },
                        ) { CoverImage(null, null, Modifier.fillMaxSize(), shape = null) }
                    }
                }
                Row(
                    Modifier.align(Alignment.CenterHorizontally).padding(vertical = EchoSpacing.l),
                    horizontalArrangement = Arrangement.spacedBy(EchoSpacing.m),
                ) {
                    // Figma: previous / next, tonal, wide (64 × 56).
                    FilledTonalIconButton(
                        onClick = { index = (index - 1).coerceAtLeast(0) }, enabled = index > 0,
                        shape = EchoShapes.Full, modifier = Modifier.size(64.dp, 56.dp),
                    ) { Icon(painterResource(EchoIcons.ArrowLeftFilled), stringResource(R.string.hentai_previous)) }
                    FilledTonalIconButton(
                        onClick = { index = (index + 1).coerceAtMost(t.frames - 1) }, enabled = index < t.frames - 1,
                        shape = EchoShapes.Full, modifier = Modifier.size(64.dp, 56.dp),
                    ) { Icon(painterResource(EchoIcons.ArrowRightFilled), stringResource(R.string.hentai_next)) }
                }
            }
            }
        }
    }
}

/** Figma H.8: #111111 behind the frames. */
private val PreviewBackground = Color(0xFF111111)

private const val STRIP_CENTRE = 3

// H.10 Title states --------------------------------------------------------------------------------------------------

/** The H.10 state for a source error: blocked (no retry), busy (Try again), no video (Back). */
@Composable
fun TitleStates(kind: ErrorKind, onRetry: () -> Unit, onBack: () -> Unit, modifier: Modifier = Modifier) {
    Column(modifier.fillMaxSize().statusBarsPadding()) {
        EchoIconButton(EchoIcons.ArrowBack, stringResource(app.echo.designsystem.R.string.echo_cd_back), onBack, Modifier.padding(4.dp))
        when (kind) {
            ErrorKind.BUSY -> StateCard(EchoIcons.Timer, R.string.hentai_busy_title, R.string.hentai_busy_body) {
                EchoButton(stringResource(R.string.hentai_try_again), onRetry, style = ButtonStyle.Tonal, icon = EchoIcons.Refresh)
            }
            ErrorKind.NO_VIDEO -> StateCard(EchoIcons.MovieFilled, R.string.hentai_no_video_title, R.string.hentai_no_video_body) {
                EchoButton(stringResource(R.string.hentai_back), onBack, style = ButtonStyle.Text, icon = EchoIcons.ArrowBack)
            }
            else -> StateCard(EchoIcons.LockFilled, R.string.hentai_blocked_title, R.string.hentai_blocked_body)
        }
    }
}

/** One H.10 card: an icon in a circle, the title, the reason, and an optional action. */
@Composable
private fun StateCard(icon: Int, title: Int, body: Int, action: (@Composable () -> Unit)? = null) {
    Column(
        Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = EchoSpacing.l).clip(MaterialTheme.shapes.extraLarge)
            .background(MaterialTheme.colorScheme.surfaceContainer).padding(EchoSpacing.xxl),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(EchoSpacing.s),
    ) {
        Box(Modifier.size(56.dp).clip(EchoShapes.Full).background(MaterialTheme.colorScheme.surfaceContainerHighest), contentAlignment = Alignment.Center) {
            Icon(painterResource(icon), null)
        }
        Text(stringResource(title), style = MaterialTheme.typography.titleMediumEmphasized)
        Text(stringResource(body), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        action?.invoke()
    }
}

/** H.10 as a route (the frame's sample): "unavailable"/"blocked", "busy" or "novideo". */
@Composable
fun TitleStateRoute(kind: String, shell: ShellActions) {
    Box(Modifier.fillMaxSize().testTag("screen:H.10")) {
        TitleStates(
            kind = when (kind) {
                "busy" -> ErrorKind.BUSY
                "novideo" -> ErrorKind.NO_VIDEO
                else -> ErrorKind.BLOCKED
            },
            onRetry = shell::back,
            onBack = shell::back,
        )
    }
}

// Previews -----------------------------------------------------------------------------------------------------------

@EchoScreenPreviews
@Composable
private fun HentaiTitleScreenPreview(@PreviewParameter(EchoPreviewThemes::class) theme: EchoPreviewTheme) = EchoTheme(theme.config) {
    Surface {
        val t = FakeCatalog.hentaiTitles[3]
        HentaiTitleScreen(
            state = HentaiTitleUiState(Load.Content(t), similar = FakeCatalog.hentaiTitles.take(3), studioCount = 7),
            contentPadding = PaddingValues(), onBack = {}, onRetry = {}, onCopy = {}, onOpenSite = {}, onShare = {},
            onStudio = {}, onWatch = {}, onSimilar = {}, onTitle = {},
        )
    }
}
