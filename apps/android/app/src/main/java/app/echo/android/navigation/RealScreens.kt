package app.echo.android.navigation

import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.runtime.State
import androidx.navigation.NavGraphBuilder
import androidx.navigation.compose.composable
import app.echo.android.feature.asmr.home.AsmrHomeRoute
import app.echo.data.model.Source
import kotlin.reflect.KClass

/**
 * Registers the screens that are built, and returns their route classes so [EchoNavHost] skips their placeholders.
 * Grows phase by phase.
 */
internal fun NavGraphBuilder.realScreens(
    shell: ShellActions,
    source: State<Source>,
    contentPadding: PaddingValues,
): Set<KClass<out Route>> {
    composable<Route.AsmrHome> { AsmrHomeRoute(shell, source.value, contentPadding) }
    return setOf(Route.AsmrHome::class)
}
