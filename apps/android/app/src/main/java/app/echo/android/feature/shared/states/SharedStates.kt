package app.echo.android.feature.shared.states

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.tooling.preview.PreviewParameter
import app.echo.android.R
import app.echo.android.navigation.ShellActions
import app.echo.android.navigation.SectionNav
import app.echo.android.navigation.Tab
import app.echo.data.model.Source
import app.echo.designsystem.component.echo.EmptyState
import app.echo.designsystem.component.echo.EmptyStateAction
import app.echo.designsystem.component.m3e.ButtonStyle
import app.echo.designsystem.component.m3e.EchoSmallAppBar
import app.echo.designsystem.icon.EchoIcons
import app.echo.designsystem.preview.EchoPreviewTheme
import app.echo.designsystem.preview.EchoPreviewThemes
import app.echo.designsystem.preview.EchoScreenPreviews
import app.echo.designsystem.theme.EchoTheme
import app.echo.designsystem.tokens.EchoSpacing

@Composable
fun SharedStatesRoute(shell: ShellActions, source: Source, contentPadding: PaddingValues) {
    SharedStatesScreen(
        contentPadding = contentPadding,
        onBack = shell::back,
        onHome = { shell.open(SectionNav.root(source.section, Tab.HOME)) },
        // Try again goes back to the screen that failed, which loads again.
        onRetry = shell::back,
    )
}

/** Figma 0.4 Not found & empty (28:6895): the shared empty and error states, as three cards. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SharedStatesScreen(
    contentPadding: PaddingValues,
    onBack: () -> Unit,
    onHome: () -> Unit,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(modifier.fillMaxSize().testTag("screen:0.4")) {
        Column(
            Modifier.fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(bottom = contentPadding.calculateBottomPadding()),
        ) {
            EchoSmallAppBar(title = "", onBack = onBack, navigationIcon = EchoIcons.ArrowBack)
            Column(
                Modifier.padding(top = EchoSpacing.l),
                verticalArrangement = Arrangement.spacedBy(EchoSpacing.l),
            ) {
                EmptyState(
                    icon = EchoIcons.Search,
                    title = stringResource(R.string.state_not_found_title),
                    body = stringResource(R.string.state_not_found_body),
                    action = EmptyStateAction(stringResource(R.string.state_back_home), EchoIcons.Home, onHome),
                )
                EmptyState(
                    icon = EchoIcons.WifiOff,
                    title = stringResource(R.string.state_offline_title),
                    body = stringResource(R.string.state_offline_body),
                    action = EmptyStateAction(stringResource(R.string.state_try_again), EchoIcons.Refresh, onRetry, ButtonStyle.Tonal),
                )
                EmptyState(
                    icon = EchoIcons.History,
                    title = stringResource(R.string.state_nothing_watched_title),
                    body = stringResource(R.string.state_nothing_watched_body),
                )
            }
        }
    }
}

@EchoScreenPreviews
@Composable
private fun SharedStatesScreenPreview(@PreviewParameter(EchoPreviewThemes::class) theme: EchoPreviewTheme) = EchoTheme(theme.config) {
    Surface {
        SharedStatesScreen(contentPadding = PaddingValues(), onBack = {}, onHome = {}, onRetry = {})
    }
}
