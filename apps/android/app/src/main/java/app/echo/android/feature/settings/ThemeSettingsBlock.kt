package app.echo.android.feature.settings

import android.os.Build
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import app.echo.android.R
import app.echo.data.model.ThemeMode
import app.echo.data.model.ThemeSettings
import app.echo.designsystem.component.m3e.ConnectedButtonGroup
import app.echo.designsystem.component.m3e.ConnectedOption
import app.echo.designsystem.component.m3e.SegmentedList
import app.echo.designsystem.component.m3e.SwitchListItem
import app.echo.designsystem.theme.LocalEchoTheme
import app.echo.designsystem.tokens.EchoSpacing

/** The theme part of S.8, early: mode, dynamic colour, pure black (greyed out while the mode resolves to light). */
@Composable
fun ThemeSettingsBlock(theme: ThemeSettings, onTheme: (ThemeSettings.() -> ThemeSettings) -> Unit) {
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
