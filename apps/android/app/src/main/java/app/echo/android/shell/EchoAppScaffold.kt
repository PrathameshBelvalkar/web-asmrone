package app.echo.android.shell

import android.app.Activity
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavHostController
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import app.echo.android.R
import app.echo.android.feature.asmr.player.PlayerMoreSheet
import app.echo.android.feature.asmr.player.PlayerNav
import app.echo.android.feature.asmr.player.PlayerPages
import app.echo.android.feature.asmr.player.PlayerViewModel
import app.echo.android.ui.echoViewModel
import app.echo.data.repository.PlaySource
import app.echo.android.feature.settings.ProfileSettingsBlock
import app.echo.android.feature.settings.ThemeSettingsBlock
import app.echo.android.navigation.Chrome
import app.echo.android.navigation.EchoNavHost
import app.echo.android.navigation.Route
import app.echo.android.navigation.ScreenSpecs
import app.echo.android.navigation.SectionNav
import app.echo.android.navigation.ShellActions
import app.echo.android.navigation.Tab
import app.echo.data.model.Section
import app.echo.data.model.Track
import app.echo.designsystem.component.echo.MiniPlayer
import app.echo.designsystem.component.echo.PlayerPage
import app.echo.designsystem.component.echo.PlayerSheet
import app.echo.designsystem.component.echo.PlayerSheetValue
import app.echo.designsystem.component.echo.rememberPlayerSheetState
import app.echo.designsystem.component.m3e.EchoNavigationBar
import app.echo.designsystem.component.m3e.EchoSmallAppBar
import app.echo.designsystem.component.m3e.sectionDestinations
import app.echo.designsystem.icon.EchoIcons
import app.echo.designsystem.tokens.EchoSpacing

/**
 * The app shell (design.md §10.1): the NavHost, the floating navigation bar, the player sheet (mini ↔ full) and the
 * snackbar host, plus the shell's own sheets (0.1 Source switcher, P.1 Profile). What is shown around a screen comes
 * from its [ScreenSpecs] chrome.
 */
@Composable
fun EchoAppScaffold(vm: ShellViewModel, start: Route, nav: NavHostController = rememberNavController()) {
    val state by vm.state.collectAsStateWithLifecycle()
    val shell = state ?: return
    val entry by nav.currentBackStackEntryAsState()
    val spec = ScreenSpecs.of(entry?.destination)
    val chrome = spec?.chrome ?: Chrome.PLAIN
    val section = shell.source.section

    var tab by rememberSaveable { mutableStateOf(Tab.HOME) }
    LaunchedEffect(spec, section) { spec?.let { SectionNav.tabOf(section, it.sample) }?.let { tab = it } }

    var showSwitcher by rememberSaveable { mutableStateOf(false) }
    var showProfile by rememberSaveable { mutableStateOf(false) }
    var playerPage by rememberSaveable { mutableStateOf(PlayerPage.NowPlaying) }
    var showPlayerMore by rememberSaveable { mutableStateOf(false) }
    val sheet = rememberPlayerSheetState()
    val playerVm = echoViewModel { PlayerViewModel(it.player, it.playlists, it.asmr) }
    val playerState by playerVm.state.collectAsStateWithLifecycle()
    val playerNav = remember(nav) {
        PlayerNav(
            collapse = sheet::collapse,
            openPage = { playerPage = it },
            openMore = { showPlayerMore = true },
            goToWork = { sheet.collapse(); nav.navigate(Route.Work(it)) },
            goToArtist = { sheet.collapse(); nav.navigate(Route.Artist(it)) },
        )
    }
    val snackbar = remember { SnackbarHostState() }

    ImmersiveSystemBars(hidden = spec?.hidesSystemBars == true)

    val actions = remember(nav, vm) {
        object : ShellActions {
            override val profileInitial get() = vm.state.value?.profile?.name ?: shell.profile.name
            override fun open(route: Route) = nav.navigate(route)
            override fun back() { nav.popBackStack() }
            override fun openSourceSwitcher() { showSwitcher = true }
            override fun openProfile() { showProfile = true }
            override fun playSample() = vm.playSample()
            override fun play(tracks: List<Track>, index: Int, playingFrom: String, source: PlaySource) {
                vm.player.play(tracks, index, playingFrom, source)
                playerPage = PlayerPage.NowPlaying
                sheet.expand()
            }
            override fun finishOnboarding() {
                vm.finishOnboarding()
                val section = vm.state.value?.source?.section ?: Section.ASMR
                nav.navigate(SectionNav.root(section, Tab.HOME)) { popUpTo(nav.graph.id) { inclusive = true } }
            }
            override fun sectionIcon(section: Section) = section.icon()
        }
    }

    val density = LocalDensity.current
    var navBarHeightPx by remember { mutableIntStateOf(0) }
    val navBarHeight = with(density) { navBarHeightPx.toDp() }
    val showNavBar = chrome == Chrome.SECTION
    val hasQueue = shell.player.current != null
    val showPlayer = hasQueue && (showNavBar || sheet.currentValue == PlayerSheetValue.Expanded)
    val bottomPadding = (if (showNavBar) navBarHeight else 0.dp) +
        (if (showPlayer && showNavBar) MiniPlayerReserve else 0.dp)

    // A Surface, not just a background: it also sets the content colour (onSurface), so plain Text reads in dark.
    androidx.compose.material3.Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.surface) { Box(Modifier.fillMaxSize()) {
        EchoNavHost(
            nav = nav,
            start = start,
            shell = actions,
            source = shell.source,
            contentPadding = PaddingValues(bottom = bottomPadding),
            modifier = Modifier.fillMaxSize(),
            extras = { route ->
                if (route == Route.LookAndFeel) {
                    val theme by vm.theme.collectAsStateWithLifecycle(initialValue = null)
                    theme?.let { ThemeSettingsBlock(it) { change -> vm.updateTheme(change) } }
                }
                if (route == Route.EditProfile) {
                    ProfileSettingsBlock(shell.profile) { change -> vm.updateProfile(change) }
                }
            },
        )

        if (showNavBar) {
            EchoNavigationBar(
                destinations = sectionDestinations(
                    stringResource(R.string.nav_home), stringResource(R.string.nav_search), stringResource(R.string.nav_library),
                ),
                selected = tab.ordinal,
                onSelect = { i -> nav.navigateToTab(section, Tab.entries[i]); tab = Tab.entries[i] },
                modifier = Modifier.align(Alignment.BottomCenter).onSizeChanged { navBarHeightPx = it.height }.testTag("navbar"),
            )
        }

        if (showPlayer) {
            PlayerSheet(
                state = sheet,
                collapsedBottom = if (showNavBar) navBarHeight + EchoSpacing.miniPlayerAboveNavBar else 0.dp,
                miniPlayer = {
                    val p = shell.player
                    MiniPlayer(
                        title = p.current?.title.orEmpty(),
                        artist = p.current?.artist.orEmpty(),
                        cover = null,
                        isPlaying = p.isPlaying,
                        progress = { vm.state.value?.player?.progress ?: 0f },
                        onPlayPause = vm.player::playPause,
                        onNext = vm.player::next,
                        onClick = sheet::expand,
                        modifier = Modifier.testTag("miniplayer"),
                    )
                },
                fullPlayer = { PlayerPages(playerState, playerPage, playerVm, playerNav) },
            )
        }

        SnackbarHost(snackbar, Modifier.align(Alignment.BottomCenter).padding(bottom = bottomPadding + EchoSpacing.s))
    } }

    // Back: a player page → now playing → collapse the sheet; otherwise the NavHost handles it.
    BackHandler(enabled = sheet.currentValue == PlayerSheetValue.Expanded) {
        if (playerPage != PlayerPage.NowPlaying) playerPage = PlayerPage.NowPlaying else sheet.collapse()
    }

    if (showSwitcher) {
        SourceSwitcherSheet(
            sources = shell.visibleSources,
            selected = shell.source,
            onSelect = { source ->
                showSwitcher = false
                if (source != shell.source) {
                    vm.selectSource(source)
                    tab = Tab.HOME
                    // Switching section clears the back stack to that section's Home (§10.2).
                    nav.navigate(SectionNav.root(source.section, Tab.HOME)) { popUpTo(nav.graph.id) { inclusive = true } }
                }
            },
            onSettings = { showSwitcher = false; nav.navigate(Route.Settings) },
            onDismiss = { showSwitcher = false },
        )
    }
    if (showProfile) {
        ProfileSheet(shell.profile, onOpen = { showProfile = false; nav.navigate(it) }, onDismiss = { showProfile = false })
    }
    if (showPlayerMore) {
        PlayerMoreSheet(playerState, playerVm, playerNav, onDismiss = { showPlayerMore = false })
    }
}

/** Room for the mini player above the navigation bar: its height plus the 8 dp gap. */
private val MiniPlayerReserve = app.echo.designsystem.component.echo.MiniPlayerHeight + 8.dp

/** Tabs keep their own back stacks (saveState / restoreState), anchored on the section's Home (§10.2). */
fun NavHostController.navigateToTab(section: Section, tab: Tab) {
    val home = SectionNav.root(section, Tab.HOME)
    navigate(SectionNav.root(section, tab)) {
        popUpTo(home) { saveState = true }
        launchSingleTop = true
        restoreState = true
    }
}

/** Reader and theaters hide the system bars (§10.1); they come back on any other screen. */
@Composable
private fun ImmersiveSystemBars(hidden: Boolean) {
    val view = LocalView.current
    if (view.isInEditMode) return
    DisposableEffect(hidden) {
        val window = (view.context as? Activity)?.window
        val controller = window?.let { WindowCompat.getInsetsController(it, view) }
        if (hidden) {
            controller?.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            controller?.hide(WindowInsetsCompat.Type.systemBars())
        } else {
            controller?.show(WindowInsetsCompat.Type.systemBars())
        }
        onDispose { }
    }
}
