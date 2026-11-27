package app.echo.android.feature.jav.news

import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.foundation.layout.windowInsetsTopHeight
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.WindowInsets
import android.content.Intent
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.tooling.preview.PreviewParameter
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.echo.android.R
import app.echo.android.feature.jav.JavHeader
import app.echo.android.feature.jav.JavTab
import app.echo.android.feature.jav.label
import app.echo.android.feature.manga.LoadFallback
import app.echo.android.navigation.Route
import app.echo.android.navigation.ShellActions
import app.echo.android.ui.echoViewModel
import app.echo.data.fake.FakeCatalog
import app.echo.data.model.NewsCategory
import app.echo.data.model.NewsPost
import app.echo.data.model.Source
import app.echo.data.repository.JavRepository
import app.echo.data.repository.Load
import app.echo.designsystem.component.echo.ArticleHero
import app.echo.designsystem.component.echo.CoverImage
import app.echo.designsystem.component.echo.ShelfHeader
import app.echo.designsystem.component.m3e.ChipRow
import app.echo.designsystem.component.m3e.ChipSpec
import app.echo.designsystem.component.m3e.ChipStyle
import app.echo.designsystem.component.m3e.EchoFloatingToolbar
import app.echo.designsystem.component.m3e.EchoIconButton
import app.echo.designsystem.component.m3e.IconButtonStyle
import app.echo.designsystem.component.m3e.SegmentedList
import app.echo.designsystem.component.m3e.SegmentedListItem
import app.echo.designsystem.component.m3e.ToolbarAction
import app.echo.designsystem.icon.EchoIcons
import app.echo.designsystem.preview.EchoPreviewTheme
import app.echo.designsystem.preview.EchoPreviewThemes
import app.echo.designsystem.preview.EchoScreenPreviews
import app.echo.designsystem.theme.EchoTheme
import app.echo.designsystem.tokens.EchoSpacing
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn

// 3.1 News -----------------------------------------------------------------------------------------------------------

/** 3.1: the category chip (null = For you) and its stories. */
data class JavNewsUiState(val category: NewsCategory? = null, val news: Load<List<NewsPost>> = Load.Loading)

class JavNewsViewModel(private val jav: JavRepository) : ViewModel() {
    private val category = MutableStateFlow<NewsCategory?>(null)
    private val reloads = MutableStateFlow(0)

    val state: StateFlow<JavNewsUiState> = combine(category, reloads) { c, _ -> c }
        .flatMapLatest { c -> jav.news(c).map { JavNewsUiState(c, it) } }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), JavNewsUiState())

    fun setCategory(value: NewsCategory?) { category.value = value }
    fun retry() { reloads.value += 1 }
}

@Composable
fun JavNewsRoute(shell: ShellActions, source: Source, contentPadding: PaddingValues) {
    val vm = echoViewModel { JavNewsViewModel(it.jav) }
    val state by vm.state.collectAsStateWithLifecycle()
    JavNewsScreen(
        state = state,
        header = { JavHeader(JavTab.NEWS, shell, source) },
        contentPadding = contentPadding,
        onCategory = vm::setCategory,
        onRetry = vm::retry,
        onPost = { shell.open(Route.NewsPost(it)) },
        onTrending = { shell.open(Route.Latest) },
    )
}

/** Figma 3.1 News (28:3332): categories, the top story, Trending, then Today's list. */
@Composable
fun JavNewsScreen(
    state: JavNewsUiState,
    header: @Composable () -> Unit,
    contentPadding: PaddingValues,
    onCategory: (NewsCategory?) -> Unit,
    onRetry: () -> Unit,
    onPost: (String) -> Unit,
    onTrending: () -> Unit,
) {
    val categories = listOf(null) + NewsCategory.entries
    Column(Modifier.fillMaxSize().testTag("screen:3.1")) {
        header()
        ChipRow(
            chips = categories.map { ChipSpec(stringResource(it?.label() ?: R.string.jav_for_you)) },
            onClick = { onCategory(categories[it]) },
            selected = setOf(categories.indexOf(state.category)),
            modifier = Modifier.padding(vertical = EchoSpacing.xs + EchoSpacing.xxs),
        )
        val news = state.news
        if (news !is Load.Content) {
            LoadFallback(news, onRetry)
            return@Column
        }
        val posts = news.value
        val top = posts.first()
        val rest = posts.drop(1)
        LazyColumn(
            Modifier.weight(1f),
            contentPadding = PaddingValues(top = EchoSpacing.xs, bottom = contentPadding.calculateBottomPadding() + EchoSpacing.l),
            verticalArrangement = Arrangement.spacedBy(EchoSpacing.s + EchoSpacing.xxs),
        ) {
            item { TopStory(top) { onPost(top.id) } }
            if (rest.isNotEmpty()) {
                item { ShelfHeader(stringResource(R.string.jav_trending), onClick = onTrending) }
                item {
                    LazyRow(
                        contentPadding = PaddingValues(horizontal = EchoSpacing.screenMargin),
                        horizontalArrangement = Arrangement.spacedBy(EchoSpacing.m),
                    ) {
                        items(rest.reversed(), key = { it.id }) { post -> TrendingStory(post) { onPost(post.id) } }
                    }
                }
                item {
                    Text(
                        stringResource(R.string.jav_today).uppercase(),
                        style = MaterialTheme.typography.labelMediumEmphasized,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(start = EchoSpacing.screenMargin, top = EchoSpacing.m, bottom = EchoSpacing.xs),
                    )
                }
                item {
                    SegmentedList {
                        rest.forEach { post -> item { NewsRow(post) { onPost(post.id) } } }
                    }
                }
            }
        }
    }
}

/** The top story (Figma "M3E · Card (Elevated) — top story"): 236 dp image, a scrim, then the caption over it. */
@Composable
private fun TopStory(post: NewsPost, onClick: () -> Unit) {
    Card(
        onClick = onClick,
        shape = MaterialTheme.shapes.extraLarge,
        elevation = CardDefaults.elevatedCardElevation(),
        modifier = Modifier.fillMaxWidth().padding(horizontal = EchoSpacing.screenMargin).height(236.dp),
    ) {
        Box(Modifier.fillMaxSize()) {
            CoverImage(post.imageUrl, null, Modifier.fillMaxSize(), shape = null)
            Box(Modifier.fillMaxSize().background(Brush.verticalGradient(0.35f to Color.Transparent, 1f to Color.Black.copy(alpha = 0.75f))))
            Column(
                Modifier.align(Alignment.BottomStart).padding(18.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Text(
                    stringResource(R.string.jav_top_story, stringResource(post.category.label())).uppercase(),
                    fontSize = 10.sp,
                    style = MaterialTheme.typography.labelSmallEmphasized,
                    color = Color(0xFF1C1C1C),
                    modifier = Modifier.clip(RoundedCornerShape(8.dp)).background(Color.White).padding(horizontal = 8.dp, vertical = 2.dp),
                )
                Text(post.headline, style = MaterialTheme.typography.titleLargeEmphasized, color = Color.White, maxLines = 2, overflow = TextOverflow.Ellipsis)
                Text(
                    stringResource(R.string.jav_read_meta, post.published, post.readMinutes),
                    style = MaterialTheme.typography.labelSmall,
                    color = Color.White.copy(alpha = 0.75f),
                )
            }
        }
    }
}

/** A Trending story (Figma "Story"): 220 × 124 image, the category, one line of headline. */
@Composable
private fun TrendingStory(post: NewsPost, onClick: () -> Unit) {
    Column(Modifier.width(220.dp).clickable(onClick = onClick), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        val shape = MaterialTheme.shapes.largeIncreased
        CoverImage(
            post.imageUrl, null,
            Modifier.fillMaxWidth().height(124.dp).border(1.dp, MaterialTheme.colorScheme.outlineVariant, shape),
            shape = shape,
        )
        CategoryLabel(post.category)
        Text(post.headline, style = MaterialTheme.typography.titleSmall, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

@Composable
private fun CategoryLabel(category: NewsCategory) = Text(
    stringResource(category.label()).uppercase(),
    style = MaterialTheme.typography.labelSmallEmphasized,
    color = MaterialTheme.colorScheme.onSurfaceVariant,
)

/** A Today row (Figma "News/…"): category, headline, when · read time, and a 92 × 72 thumbnail. */
@Composable
private fun NewsRow(post: NewsPost, onClick: () -> Unit) = SegmentedListItem(
    headline = post.headline,
    overline = stringResource(post.category.label()).uppercase(),
    supporting = stringResource(R.string.jav_read_meta, post.published, post.readMinutes),
    onClick = onClick,
    headlineMaxLines = 1,
    trailing = {
        val shape = RoundedCornerShape(14.dp)
        CoverImage(
            post.imageUrl, null,
            Modifier.size(92.dp, 72.dp).border(1.dp, MaterialTheme.colorScheme.outlineVariant, shape),
            shape = shape,
        )
    },
)

// 3.2 News post ------------------------------------------------------------------------------------------------------

class JavNewsPostViewModel(id: String, jav: JavRepository) : ViewModel() {
    val post: StateFlow<Load<NewsPost>> = jav.newsPost(id).stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), Load.Loading)
}

private const val NEWS_URL = "https://www.javdatabase.com/news/"

@Composable
fun JavNewsPostRoute(id: String, shell: ShellActions, contentPadding: PaddingValues) {
    // Try again builds a fresh ViewModel, which loads again.
    var attempt by rememberSaveable { mutableIntStateOf(0) }
    val vm = echoViewModel(key = "news-$id-$attempt") { JavNewsPostViewModel(id, it.jav) }
    val post by vm.post.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val uri = LocalUriHandler.current
    JavNewsPostScreen(
        onRetry = { attempt++ },
        post = post,
        contentPadding = contentPadding,
        onBack = shell::back,
        onShare = { p ->
            val send = Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, "${p.headline}\n$NEWS_URL")
            context.startActivity(Intent.createChooser(send, null))
        },
        onSource = { uri.openUri(NEWS_URL) },
        onMovie = { shell.open(Route.Movie(it)) },
        onIdol = { shell.open(Route.Idol(it)) },
        onStudio = { shell.open(Route.MovieList("studio:$it")) },
    )
}

/** Figma "Echo · Article hero": 300 dp. */
private val HERO_HEIGHT = 300.dp

/** Body text scales the Text button steps through. */
private val TextScales = listOf(1f, 1.15f, 1.3f)

/** Figma 3.2 News post (28:3458): the hero, the story, what it mentions, and a floating toolbar. */
@Composable
fun JavNewsPostScreen(
    post: Load<NewsPost>,
    contentPadding: PaddingValues,
    onBack: () -> Unit,
    onShare: (NewsPost) -> Unit,
    onSource: () -> Unit,
    onMovie: (String) -> Unit,
    onIdol: (String) -> Unit,
    onStudio: (String) -> Unit,
    onRetry: () -> Unit = {},
) {
    var saved by rememberSaveable { mutableStateOf(false) }
    var scale by rememberSaveable { mutableIntStateOf(0) }
    Box(Modifier.fillMaxSize().testTag("screen:3.2")) {
        if (post !is Load.Content) {
            LoadFallback(post, onRetry = onRetry)
            return@Box
        }
        val p = post.value
        val colors = MaterialTheme.colorScheme
        val bodyStyle = MaterialTheme.typography.bodyLarge.let { it.copy(fontSize = it.fontSize * TextScales[scale], lineHeight = it.lineHeight * TextScales[scale]) }
        val scroll = rememberScrollState()
        Column(
            Modifier.fillMaxSize().verticalScroll(scroll)
                .padding(bottom = contentPadding.calculateBottomPadding() + 96.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            ArticleHero(p.imageUrl, onBack) {
                EchoIconButton(
                    if (saved) EchoIcons.BookmarkFilled else EchoIcons.Bookmark, stringResource(R.string.jav_save), { saved = !saved },
                    style = IconButtonStyle.Tonal,
                )
                EchoIconButton(EchoIcons.Share, stringResource(R.string.jav_share), { onShare(p) }, style = IconButtonStyle.Tonal)
            }
            Column(Modifier.padding(horizontal = 20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(EchoSpacing.s)) {
                    Text(
                        stringResource(p.category.label()).uppercase(),
                        style = MaterialTheme.typography.labelSmallEmphasized,
                        color = colors.onPrimary,
                        modifier = Modifier.clip(RoundedCornerShape(8.dp)).background(colors.primary).padding(horizontal = 10.dp, vertical = 4.dp),
                    )
                    Text(stringResource(R.string.jav_read_minutes, p.readMinutes), style = MaterialTheme.typography.labelMedium, color = colors.onSurfaceVariant)
                }
                Text(p.headline, style = MaterialTheme.typography.headlineMediumEmphasized)
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    CoverImage(null, null, Modifier.size(32.dp), shape = RoundedCornerShape(16.dp))
                    Column {
                        Text(stringResource(R.string.jav_news_source), style = MaterialTheme.typography.labelLargeEmphasized)
                        Text(p.published, style = MaterialTheme.typography.labelSmall, color = colors.onSurfaceVariant)
                    }
                }
            }
            p.body.take(2).forEach { Paragraph(it, bodyStyle) }
            p.pullQuote?.let { quote ->
                Row(Modifier.padding(horizontal = 20.dp).height(androidx.compose.foundation.layout.IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Box(Modifier.width(4.dp).fillMaxSize().clip(RoundedCornerShape(2.dp)).background(colors.primary))
                    Text("“$quote”", style = MaterialTheme.typography.titleLarge)
                }
            }
            Column(Modifier.padding(horizontal = 20.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                val shape = MaterialTheme.shapes.largeIncreased
                CoverImage(null, null, Modifier.fillMaxWidth().height(200.dp).border(1.dp, colors.outlineVariant, shape), shape = shape)
                p.caption?.let { Text(it, style = MaterialTheme.typography.labelSmall, color = colors.onSurfaceVariant) }
            }
            p.body.drop(2).forEach { Paragraph(it, bodyStyle) }
            Mentioned(p, onMovie, onIdol, onStudio)
        }
        // The hero sits under the status bar; once it scrolls away, a surface strip keeps the text off the clock.
        val heroPx = with(androidx.compose.ui.platform.LocalDensity.current) { HERO_HEIGHT.toPx() }
        Box(
            Modifier.fillMaxWidth().windowInsetsTopHeight(WindowInsets.statusBars)
                .graphicsLayer { alpha = (scroll.value / heroPx).coerceIn(0f, 1f) }
                .background(colors.surface),
        )
        EchoFloatingToolbar(
            Modifier.align(Alignment.BottomCenter).padding(bottom = contentPadding.calculateBottomPadding() + EchoSpacing.l),
        ) {
            ToolbarAction(stringResource(R.string.jav_share), EchoIcons.Share, { onShare(p) })
            ToolbarAction(
                stringResource(if (saved) R.string.jav_saved else R.string.jav_save),
                if (saved) EchoIcons.BookmarkFilled else EchoIcons.Bookmark, { saved = !saved }, selected = saved,
            )
            ToolbarAction(stringResource(R.string.jav_text_size), EchoIcons.FormatSize, { scale = (scale + 1) % TextScales.size })
            ToolbarAction(stringResource(R.string.jav_source), EchoIcons.OpenInNew, onSource)
        }
    }
}

@Composable
private fun Paragraph(text: String, style: androidx.compose.ui.text.TextStyle) =
    Text(text, style = style, modifier = Modifier.padding(horizontal = 20.dp))

/** "Mentioned in this story": the movie code, the idol (with a photo) and the studio. */
@Composable
private fun Mentioned(post: NewsPost, onMovie: (String) -> Unit, onIdol: (String) -> Unit, onStudio: (String) -> Unit) {
    if (post.movieId == null && post.idolId == null && post.studio == null) return
    Column {
        Text(
            stringResource(R.string.jav_news_mentioned).uppercase(),
            style = MaterialTheme.typography.labelMediumEmphasized,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(start = 20.dp, top = EchoSpacing.m, bottom = EchoSpacing.xs),
        )
        val chips = listOfNotNull(
            post.movieId?.let { id -> ChipSpec(post.movieCode ?: id, EchoIcons.ContentCopy) to { onMovie(id) } },
            post.idolId?.let { id -> ChipSpec(post.idolName ?: id, EchoIcons.Person) to { onIdol(id) } },
            post.studio?.let { ChipSpec(it, EchoIcons.OpenInNew) to { onStudio(it) } },
        )
        ChipRow(chips.map { it.first }, onClick = { chips[it].second() }, style = ChipStyle.Assist)
    }
}

// Previews -----------------------------------------------------------------------------------------------------------

@EchoScreenPreviews
@Composable
private fun JavNewsScreenPreview(@PreviewParameter(EchoPreviewThemes::class) theme: EchoPreviewTheme) = EchoTheme(theme.config) {
    Surface {
        JavNewsScreen(
            state = JavNewsUiState(news = Load.Content(FakeCatalog.news)),
            header = {
                JavHeader(JavTab.NEWS, "javdatabase", EchoIcons.Movie, "P", onSearch = {}, onSwitchSource = {}, onProfile = {}, onTab = {})
            },
            contentPadding = PaddingValues(), onCategory = {}, onRetry = {}, onPost = {}, onTrending = {},
        )
    }
}
