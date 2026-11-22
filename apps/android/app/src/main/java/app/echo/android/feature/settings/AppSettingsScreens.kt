package app.echo.android.feature.settings

import android.os.Build
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.tooling.preview.PreviewParameter
import app.echo.android.R
import app.echo.android.feature.manga.reader.label
import app.echo.android.feature.manga.reader.readingModes
import app.echo.android.navigation.ShellActions
import app.echo.data.model.PlaybackSettings
import app.echo.data.model.ReaderBackground
import app.echo.data.model.ReaderSettings
import app.echo.data.model.ScaleType
import app.echo.data.model.TapZones
import app.echo.data.model.ThemeMode
import app.echo.data.model.ThemeSettings
import app.echo.data.model.VideoQuality
import app.echo.designsystem.component.m3e.ConnectedButtonGroup
import app.echo.designsystem.component.m3e.ConnectedOption
import app.echo.designsystem.component.m3e.EchoSlider
import app.echo.designsystem.component.m3e.RadioOption
import app.echo.designsystem.component.m3e.SegmentedList
import app.echo.designsystem.component.m3e.SegmentedListItem
import app.echo.designsystem.component.m3e.SelectableCard
import app.echo.designsystem.component.m3e.SwitchListItem
import app.echo.designsystem.preview.EchoPreviewTheme
import app.echo.designsystem.preview.EchoPreviewThemes
import app.echo.designsystem.preview.EchoScreenPreviews
import app.echo.designsystem.theme.EchoTheme
import app.echo.designsystem.theme.LocalEchoTheme
import app.echo.designsystem.tokens.EchoSpacing

// S.8 Look and feel --------------------------------------------------------------------------------------------------

@Composable
fun LookAndFeelRoute(shell: ShellActions) = WithSettings { state, vm ->
    LookAndFeelScreen(state.settings.theme, onBack = shell::back, onTheme = vm::theme)
}

/** Figma S.8 Look and feel (29:29128). Every change applies live (§7.3): this screen is the theme-switching test. */
@Composable
fun LookAndFeelScreen(theme: ThemeSettings, onBack: () -> Unit, onTheme: (ThemeSettings.() -> ThemeSettings) -> Unit) {
    val modes = listOf(ThemeMode.SYSTEM, ThemeMode.LIGHT, ThemeMode.DARK)
    SettingsFrame("S.8", stringResource(R.string.settings_look), onBack, subtitle = stringResource(R.string.settings_look_subtitle)) {
        GroupLabel(stringResource(R.string.settings_theme))
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
        GroupLabel(stringResource(R.string.settings_group_colour))
        SegmentedList {
            item {
                SwitchListItem(
                    stringResource(R.string.settings_dynamic_colour), theme.dynamicColor, { on -> onTheme { copy(dynamicColor = on) } },
                    supporting = stringResource(R.string.settings_dynamic_colour_summary),
                    enabled = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S,
                )
            }
            item {
                SwitchListItem(
                    stringResource(R.string.settings_pure_black), theme.pureBlack, { on -> onTheme { copy(pureBlack = on) } },
                    supporting = stringResource(R.string.settings_pure_black_summary),
                    enabled = LocalEchoTheme.current.isDark,
                )
            }
        }
        GroupLabel(stringResource(R.string.settings_group_player))
        SegmentedList {
            item {
                SwitchListItem(
                    stringResource(R.string.settings_dynamic_player), theme.dynamicPlayerColor,
                    { on -> onTheme { copy(dynamicPlayerColor = on) } },
                    supporting = stringResource(R.string.settings_dynamic_player_summary),
                )
            }
            item {
                SwitchListItem(
                    stringResource(R.string.settings_blurred_cover), theme.blurredPlayerBackground,
                    { on -> onTheme { copy(blurredPlayerBackground = on) } },
                )
            }
        }
        GroupLabel(stringResource(R.string.settings_group_layout))
        SegmentedList {
            item {
                SwitchListItem(
                    stringResource(R.string.settings_bigger_covers), theme.biggerCovers, { on -> onTheme { copy(biggerCovers = on) } },
                    supporting = stringResource(R.string.settings_bigger_covers_summary),
                )
            }
            item {
                SwitchListItem(stringResource(R.string.settings_animations), theme.animations, { on -> onTheme { copy(animations = on) } })
            }
        }
    }
}

// S.9 Playback -------------------------------------------------------------------------------------------------------

private val Speeds = listOf(0.75f, 1f, 1.25f, 1.5f)
private const val SKIP_MIN = 5
private const val SKIP_MAX = 30
private const val SKIP_STEP = 5
private const val MINUTE_MS = 60_000L

/** S.9 "Count as finished" choices: minutes from the end, or percent. */
private val FinishedThresholds = listOf(1 to 2, 2 to 5, 5 to 10)

@Composable
fun PlaybackRoute(shell: ShellActions) = WithSettings { state, vm ->
    PlaybackScreen(state.settings.playback, onBack = shell::back, onPlayback = vm::playback)
}

/** Figma S.9 Playback (29:29207). */
@Composable
fun PlaybackScreen(playback: PlaybackSettings, onBack: () -> Unit, onPlayback: (PlaybackSettings.() -> PlaybackSettings) -> Unit) {
    var dialog by rememberSaveable { mutableStateOf<String?>(null) }
    val minutes = (playback.finishedThresholdMs / MINUTE_MS).toInt()
    SettingsFrame("S.9", stringResource(R.string.settings_playback), onBack, subtitle = stringResource(R.string.settings_playback_subtitle)) {
        GroupLabel(stringResource(R.string.settings_default_speed))
        ConnectedButtonGroup(
            options = Speeds.map { ConnectedOption(speedLabel(it)) },
            selected = Speeds.indexOf(playback.defaultSpeed),
            onSelect = { i -> onPlayback { copy(defaultSpeed = Speeds[i]) } },
            modifier = Modifier.padding(horizontal = EchoSpacing.screenMargin),
        )
        GroupLabel(stringResource(R.string.settings_skip_label), value = stringResource(R.string.settings_seconds, playback.skipSeconds))
        EchoSlider(
            value = playback.skipSeconds.toFloat(),
            onValueChange = { v -> onPlayback { copy(skipSeconds = v.toInt()) } },
            valueRange = SKIP_MIN.toFloat()..SKIP_MAX.toFloat(),
            steps = (SKIP_MAX - SKIP_MIN) / SKIP_STEP - 1,
            modifier = Modifier.fillMaxWidth().padding(horizontal = EchoSpacing.screenMargin),
        )
        GroupLabel(stringResource(R.string.settings_group_resume))
        SegmentedList {
            item {
                SwitchListItem(
                    stringResource(R.string.settings_resume), playback.resume, { on -> onPlayback { copy(resume = on) } },
                    supporting = stringResource(R.string.settings_playback_subtitle),
                )
            }
            item {
                SegmentedListItem(
                    headline = stringResource(R.string.settings_count_finished),
                    supporting = stringResource(R.string.settings_count_finished_summary, minutes, playback.finishedThresholdPercent),
                    onClick = { dialog = DIALOG_FINISHED },
                    trailing = { ValueTrailing(stringResource(R.string.settings_minutes, minutes)) },
                )
            }
        }
        GroupLabel(stringResource(R.string.settings_group_video))
        SegmentedList {
            item {
                SegmentedListItem(
                    headline = stringResource(R.string.settings_default_quality),
                    onClick = { dialog = DIALOG_QUALITY },
                    trailing = { ValueTrailing(qualityLabel(playback.defaultQuality)) },
                )
            }
            item {
                SwitchListItem(
                    stringResource(R.string.settings_pip), playback.pictureInPicture, { on -> onPlayback { copy(pictureInPicture = on) } },
                    supporting = stringResource(R.string.settings_pip_summary),
                )
            }
        }
    }
    when (dialog) {
        DIALOG_FINISHED -> ChoiceDialog(
            title = stringResource(R.string.settings_count_finished),
            options = FinishedThresholds.map { (m, p) -> RadioOption(stringResource(R.string.settings_count_finished_summary, m, p)) },
            selected = FinishedThresholds.indexOfFirst { it.first == minutes }.coerceAtLeast(0),
            onConfirm = { i ->
                val (m, p) = FinishedThresholds[i]
                onPlayback { copy(finishedThresholdMs = m * MINUTE_MS, finishedThresholdPercent = p) }
                dialog = null
            },
            onDismiss = { dialog = null },
        )
        DIALOG_QUALITY -> ChoiceDialog(
            title = stringResource(R.string.settings_default_quality),
            options = VideoQuality.entries.map { RadioOption(qualityLabel(it)) },
            selected = playback.defaultQuality.ordinal,
            onConfirm = { i -> onPlayback { copy(defaultQuality = VideoQuality.entries[i]) }; dialog = null },
            onDismiss = { dialog = null },
        )
    }
}

private const val DIALOG_FINISHED = "finished"
private const val DIALOG_QUALITY = "quality"

/** "0.75×", "1.0×", "1.25×". */
private fun speedLabel(speed: Float): String = "${if (speed == 1f) "1.0" else speed.toString().trimEnd('0')}×"

@Composable
private fun qualityLabel(quality: VideoQuality): String = when (quality) {
    VideoQuality.AUTO -> stringResource(R.string.settings_quality_auto)
    VideoQuality.P1080 -> "1080p"
    VideoQuality.P720 -> "720p"
    VideoQuality.P480 -> "480p"
}

// S.10 Reader --------------------------------------------------------------------------------------------------------

@Composable
fun ReaderDefaultsRoute(shell: ShellActions) = WithSettings { state, vm ->
    ReaderDefaultsScreen(state.settings.reader, onBack = shell::back, onReader = vm::reader)
}

/** Figma S.10 Reader (29:29279): the defaults the 2.8 reader sheet starts from. */
@Composable
fun ReaderDefaultsScreen(reader: ReaderSettings, onBack: () -> Unit, onReader: (ReaderSettings.() -> ReaderSettings) -> Unit) {
    var dialog by rememberSaveable { mutableStateOf<String?>(null) }
    SettingsFrame("S.10", stringResource(R.string.settings_reader), onBack, subtitle = stringResource(R.string.settings_reader_subtitle)) {
        GroupLabel(stringResource(R.string.settings_default_mode))
        readingModes.chunked(MODE_COLUMNS).forEach { row ->
            Row(
                Modifier.fillMaxWidth().padding(horizontal = EchoSpacing.screenMargin, vertical = EchoSpacing.xs),
                horizontalArrangement = Arrangement.spacedBy(EchoSpacing.s),
            ) {
                row.forEach { card ->
                    SelectableCard(
                        title = stringResource(card.title),
                        subtitle = stringResource(card.subtitle),
                        icon = card.icon,
                        selected = reader.readingMode == card.mode,
                        onClick = { onReader { copy(readingMode = card.mode) } },
                        modifier = Modifier.weight(1f),
                    )
                }
            }
        }
        GroupLabel(stringResource(R.string.settings_group_paged))
        SegmentedList {
            item {
                SegmentedListItem(
                    headline = stringResource(R.string.settings_tap_zones), onClick = { dialog = DIALOG_ZONES },
                    trailing = { ValueTrailing(stringResource(reader.tapZones.label())) },
                )
            }
            item {
                SegmentedListItem(
                    headline = stringResource(R.string.reader_scale_type), onClick = { dialog = DIALOG_SCALE },
                    trailing = { ValueTrailing(stringResource(reader.scaleType.label())) },
                )
            }
            item {
                SwitchListItem(stringResource(R.string.reader_crop_borders), reader.cropBorders, { on -> onReader { copy(cropBorders = on) } })
            }
            item {
                SwitchListItem(
                    stringResource(R.string.reader_dual_page), reader.dualPageLandscape,
                    { on -> onReader { copy(dualPageLandscape = on) } },
                )
            }
        }
        GroupLabel(stringResource(R.string.settings_group_general))
        SegmentedList {
            item {
                SegmentedListItem(
                    headline = stringResource(R.string.settings_background_colour), onClick = { dialog = DIALOG_BACKGROUND },
                    trailing = { ValueTrailing(stringResource(reader.background.label())) },
                )
            }
            item {
                SwitchListItem(
                    stringResource(R.string.reader_show_page_number), reader.showPageNumber,
                    { on -> onReader { copy(showPageNumber = on) } },
                )
            }
            item {
                SwitchListItem(
                    stringResource(R.string.reader_keep_screen_on), reader.keepScreenOn,
                    { on -> onReader { copy(keepScreenOn = on) } },
                )
            }
            item {
                SwitchListItem(
                    stringResource(R.string.reader_animate_transitions), reader.animatePageTransitions,
                    { on -> onReader { copy(animatePageTransitions = on) } },
                )
            }
        }
    }
    when (dialog) {
        DIALOG_ZONES -> ChoiceDialog(
            title = stringResource(R.string.settings_tap_zones),
            options = TapZones.entries.map { RadioOption(stringResource(it.label())) },
            selected = reader.tapZones.ordinal,
            onConfirm = { i -> onReader { copy(tapZones = TapZones.entries[i]) }; dialog = null },
            onDismiss = { dialog = null },
        )
        DIALOG_SCALE -> ChoiceDialog(
            title = stringResource(R.string.reader_scale_type),
            options = ScaleType.entries.map { RadioOption(stringResource(it.label())) },
            selected = reader.scaleType.ordinal,
            onConfirm = { i -> onReader { copy(scaleType = ScaleType.entries[i]) }; dialog = null },
            onDismiss = { dialog = null },
        )
        DIALOG_BACKGROUND -> ChoiceDialog(
            title = stringResource(R.string.settings_background_colour),
            options = ReaderBackground.entries.map { RadioOption(stringResource(it.label())) },
            selected = reader.background.ordinal,
            onConfirm = { i -> onReader { copy(background = ReaderBackground.entries[i]) }; dialog = null },
            onDismiss = { dialog = null },
        )
    }
}

private const val MODE_COLUMNS = 3
private const val DIALOG_ZONES = "zones"
private const val DIALOG_SCALE = "scale"
private const val DIALOG_BACKGROUND = "background"

// Previews -----------------------------------------------------------------------------------------------------------

@EchoScreenPreviews
@Composable
private fun LookAndFeelScreenPreview(@PreviewParameter(EchoPreviewThemes::class) theme: EchoPreviewTheme) = EchoTheme(theme.config) {
    Surface { LookAndFeelScreen(ThemeSettings(), {}, {}) }
}

@EchoScreenPreviews
@Composable
private fun ReaderDefaultsScreenPreview(@PreviewParameter(EchoPreviewThemes::class) theme: EchoPreviewTheme) = EchoTheme(theme.config) {
    Surface { ReaderDefaultsScreen(ReaderSettings(), {}, {}) }
}
