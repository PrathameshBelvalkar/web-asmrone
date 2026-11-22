package app.echo.android.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.ContainedLoadingIndicator
import androidx.compose.material3.ExperimentalMaterial3ExpressiveApi
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import app.echo.android.R
import app.echo.data.repository.ErrorKind
import app.echo.data.repository.Load
import app.echo.designsystem.component.echo.EmptyState
import app.echo.designsystem.component.echo.EmptyStateAction
import app.echo.designsystem.component.m3e.ButtonStyle
import app.echo.designsystem.icon.EchoIcons

/**
 * The states every screen shares (design.md §13): Loading = contained loading indicator, centred; Empty and Error =
 * [EmptyState] (0.4 / H.10 copy) with Try again where it helps.
 */
@Composable
fun <T> LoadContent(
    load: Load<T>,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier,
    contentPadding: PaddingValues = PaddingValues(),
    empty: EmptyCopy = EmptyCopy.Default,
    content: @Composable (T) -> Unit,
) {
    when (load) {
        Load.Loading -> LoadingState(modifier.padding(contentPadding))
        is Load.Content -> content(load.value)
        Load.Empty -> CenteredState(modifier.padding(contentPadding)) {
            EmptyState(empty.icon, stringResource(empty.title), stringResource(empty.body))
        }
        is Load.Error -> CenteredState(modifier.padding(contentPadding)) { ErrorState(load.kind, onRetry) }
    }
}

/** Title and body of an empty list. */
data class EmptyCopy(val icon: Int, val title: Int, val body: Int) {
    companion object {
        val Default = EmptyCopy(EchoIcons.Search, R.string.state_empty_title, R.string.state_empty_body)
    }
}

@OptIn(ExperimentalMaterial3ExpressiveApi::class)
@Composable
fun LoadingState(modifier: Modifier = Modifier) {
    Box(modifier.fillMaxSize().testTag("state:loading"), contentAlignment = Alignment.Center) { ContainedLoadingIndicator() }
}

@Composable
private fun CenteredState(modifier: Modifier, content: @Composable () -> Unit) {
    Box(modifier.fillMaxSize(), contentAlignment = Alignment.Center) { content() }
}

@Composable
fun ErrorState(kind: ErrorKind, onRetry: () -> Unit, modifier: Modifier = Modifier) {
    val retry = EmptyStateAction(stringResource(R.string.state_try_again), EchoIcons.Refresh, onRetry, ButtonStyle.Tonal)
    val (icon, title, body) = when (kind) {
        ErrorKind.OFFLINE -> Triple(EchoIcons.WifiOff, R.string.state_offline_title, R.string.state_offline_body)
        ErrorKind.NOT_FOUND -> Triple(EchoIcons.Search, R.string.state_not_found_title, R.string.state_not_found_body)
        ErrorKind.BLOCKED -> Triple(EchoIcons.Lock, R.string.state_blocked_title, R.string.state_blocked_body)
        ErrorKind.BUSY -> Triple(EchoIcons.Timer, R.string.state_busy_title, R.string.state_busy_body)
        ErrorKind.NO_VIDEO -> Triple(EchoIcons.Movie, R.string.state_no_video_title, R.string.state_no_video_body)
    }
    EmptyState(
        icon, stringResource(title), stringResource(body), modifier.testTag("state:error"),
        action = if (kind == ErrorKind.NOT_FOUND) null else retry,
    )
}
