package app.echo.android

import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.echo.android.theme.AppTheme
import app.echo.core.Section
import app.echo.core.SourceId
import app.echo.data.model.ThemeMode
import app.echo.data.model.ThemeSettings
import app.echo.designsystem.component.m3e.ConnectedButtonGroup
import app.echo.designsystem.component.m3e.ConnectedOption
import app.echo.designsystem.component.m3e.SegmentedList
import app.echo.designsystem.component.m3e.SwitchListItem
import app.echo.designsystem.theme.LocalEchoTheme
import app.echo.designsystem.tokens.EchoSpacing
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    @Volatile private var themeReady = false

    override fun onCreate(savedInstanceState: Bundle?) {
        val splash = installSplashScreen()
        super.onCreate(savedInstanceState)
        val container = (application as EchoApp).container

        // Keep the system splash until the stored theme is known and drawn, so the first frame is already right.
        splash.setKeepOnScreenCondition { !themeReady }

        setContent {
            val theme by container.settings.theme.collectAsStateWithLifecycle(initialValue = null)
            val current = theme ?: return@setContent
            SideEffect { themeReady = true }
            AppTheme(current) {
                val scope = rememberCoroutineScope()
                PlaceholderScreen(
                    sources = container.sources,
                    theme = current,
                    onTheme = { change -> scope.launch { container.settings.updateTheme(change) } },
                )
            }
        }
    }
}

/**
 * Placeholder until the app shell (Phase 4). Shows the sources, and the theme settings so Phase 3 can be checked:
 * they change live and survive a restart.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun PlaceholderScreen(
    sources: List<SourceId>,
    theme: ThemeSettings = ThemeSettings(),
    onTheme: (ThemeSettings.() -> ThemeSettings) -> Unit = {},
) {
    Scaffold(topBar = { TopAppBar(title = { Text(stringResource(R.string.app_name)) }) }) { padding ->
        Column(
            modifier = Modifier.padding(padding).verticalScroll(rememberScrollState()).padding(vertical = EchoSpacing.s),
            verticalArrangement = Arrangement.spacedBy(EchoSpacing.xs),
        ) {
            ThemeSettingsBlock(theme, onTheme)
            Section.entries.forEach { section ->
                Text(
                    text = section.name,
                    style = MaterialTheme.typography.titleSmall,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.padding(horizontal = EchoSpacing.screenMargin, vertical = EchoSpacing.s),
                )
                sources.filter { it.section == section }.forEach { source ->
                    ListItem(headlineContent = { Text(source.id) })
                }
            }
        }
    }
}

/** The theme part of S.8, early: mode, dynamic colour, pure black (greyed out while the mode resolves to light). */
@Composable
private fun ThemeSettingsBlock(theme: ThemeSettings, onTheme: (ThemeSettings.() -> ThemeSettings) -> Unit) {
    val modes = listOf(ThemeMode.SYSTEM, ThemeMode.LIGHT, ThemeMode.DARK)
    Column(verticalArrangement = Arrangement.spacedBy(EchoSpacing.s)) {
        Text(
            stringResource(R.string.settings_theme),
            style = MaterialTheme.typography.titleSmall,
            color = MaterialTheme.colorScheme.primary,
            modifier = Modifier.padding(horizontal = EchoSpacing.screenMargin),
        )
        ConnectedButtonGroup(
            options = listOf(
                ConnectedOption(stringResource(R.string.settings_theme_system)),
                ConnectedOption(stringResource(R.string.settings_theme_light)),
                ConnectedOption(stringResource(R.string.settings_theme_dark)),
            ),
            selected = modes.indexOf(theme.mode),
            onSelect = { i -> onTheme { copy(mode = modes[i]) } },
            modifier = Modifier.padding(horizontal = EchoSpacing.screenMargin),
        )
        SegmentedList {
            item {
                SwitchListItem(
                    headline = stringResource(R.string.settings_dynamic_colour),
                    supporting = stringResource(R.string.settings_dynamic_colour_summary),
                    checked = theme.dynamicColor,
                    onCheckedChange = { on -> onTheme { copy(dynamicColor = on) } },
                    enabled = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S,
                )
            }
            item {
                SwitchListItem(
                    headline = stringResource(R.string.settings_pure_black),
                    supporting = stringResource(R.string.settings_pure_black_summary),
                    checked = theme.pureBlack,
                    onCheckedChange = { on -> onTheme { copy(pureBlack = on) } },
                    enabled = LocalEchoTheme.current.isDark,
                )
            }
        }
    }
}
