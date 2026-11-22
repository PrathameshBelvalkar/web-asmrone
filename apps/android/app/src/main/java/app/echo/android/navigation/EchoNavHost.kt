package app.echo.android.navigation

import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.windowInsetsTopHeight
import androidx.compose.runtime.Composable
import androidx.compose.runtime.State
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.navigation.NavGraphBuilder
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.toRoute
import app.echo.android.R
import app.echo.android.feature.placeholder.PlaceholderAction
import app.echo.android.feature.placeholder.PlaceholderScreen
import app.echo.data.model.Section
import app.echo.data.model.Source
import app.echo.data.model.Track
import app.echo.designsystem.component.m3e.EchoSearchAppBar
import app.echo.designsystem.component.m3e.EchoSmallAppBar
import kotlin.reflect.KClass

/** What screens can ask the shell for. The active source comes in as state (see [EchoNavHost]). */
interface ShellActions {
    val profileInitial: String
    fun open(route: Route)
    fun back()
    fun openSourceSwitcher()
    fun openProfile()
    fun playSample()
    /** Queue [tracks] from [index] and open the full player (1.8). */
    fun play(tracks: List<Track>, index: Int, playingFrom: String)
    fun finishOnboarding()
    fun sectionIcon(section: Section): Int
}

/**
 * One NavHost for every screen (design.md §5.4). Each destination is a placeholder until its phase replaces it:
 * section homes get the search app bar (source switcher + profile avatar), other screens a back arrow, immersive
 * screens nothing.
 */
@Composable
fun EchoNavHost(
    nav: NavHostController,
    start: Route,
    shell: ShellActions,
    source: Source,
    contentPadding: PaddingValues,
    modifier: Modifier = Modifier,
    extras: @Composable (Route) -> Unit = {},
) {
    // Read through a State so screens recompose when the source changes (the graph itself is built once).
    val currentSource = rememberUpdatedState(source)
    NavHost(navController = nav, startDestination = start, modifier = modifier) {
        // Built screens (Phase 5 onwards). Everything else is still a placeholder.
        val built = realScreens(shell, currentSource, contentPadding)
        ScreenSpecs.all.map { it.routeClass }.distinct().filterNot { it in built }.forEach { routeClass ->
            placeholder(routeClass, shell, currentSource, contentPadding, extras)
        }
    }
}

private fun NavGraphBuilder.placeholder(
    routeClass: KClass<out Route>,
    shell: ShellActions,
    source: State<Source>,
    contentPadding: PaddingValues,
    extras: @Composable (Route) -> Unit,
) {
    @Suppress("UNCHECKED_CAST")
    val cls = routeClass as KClass<Route>
    composable(route = cls, typeMap = emptyMap(), deepLinks = emptyList()) { entry ->
        val route: Route = entry.toRoute(cls)
        RoutePlaceholder(route, shell, source.value, contentPadding, extras)
    }
}

@Composable
private fun RoutePlaceholder(
    route: Route,
    shell: ShellActions,
    source: Source,
    contentPadding: PaddingValues,
    extras: @Composable (Route) -> Unit,
) {
    val spec = ScreenSpecs.of(route)
    // A root of any section: right after a switch the stored source may not have caught up yet.
    val isTabRoot = Section.entries.any { section -> Tab.entries.any { SectionNav.root(section, it) == route } }
    val actions = buildList {
        if (route is Route.AsmrHome || route is Route.Work || route is Route.Playlist || route is Route.Library) {
            add(PlaceholderAction(stringResource(R.string.placeholder_play), shell::playSample))
        }
        if (route is Route.MakeItYours) add(PlaceholderAction(stringResource(R.string.placeholder_start_exploring), shell::finishOnboarding))
        else if (spec.code.startsWith("O.")) add(PlaceholderAction(stringResource(R.string.placeholder_skip), shell::finishOnboarding))
    }
    PlaceholderScreen(
        spec = spec,
        onOpen = shell::open,
        contentPadding = contentPadding,
        actions = actions,
        extra = { extras(route) },
        topBar = {
            when {
                isTabRoot && spec.code != "0.2" -> EchoSearchAppBar(
                    source = source.name,
                    sectionIcon = shell.sectionIcon(source.section),
                    profileInitial = shell.profileInitial,
                    onSearch = { shell.open(SectionNav.root(source.section, Tab.SEARCH)) },
                    onSwitchSource = shell::openSourceSwitcher,
                    onProfile = shell::openProfile,
                )
                // Onboarding has no app bar; keep the content below the status bar.
                spec.chrome == Chrome.IMMERSIVE && spec.code.startsWith("O.") ->
                    Spacer(Modifier.windowInsetsTopHeight(WindowInsets.statusBars))
                else -> EchoSmallAppBar(title = "${spec.code} ${spec.name}", onBack = if (isTabRoot) null else shell::back)
            }
        },
    )
}
