package app.echo.android.feature.settings

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.tooling.preview.PreviewParameter
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.echo.android.R
import app.echo.android.navigation.Route
import app.echo.android.navigation.ShellActions
import app.echo.android.ui.echoViewModel
import app.echo.data.fake.FakeUpdates
import app.echo.data.model.Profile
import app.echo.data.model.Section
import app.echo.data.model.Settings
import app.echo.data.model.Source
import app.echo.data.model.Sources
import app.echo.designsystem.component.echo.AvatarChoice
import app.echo.designsystem.component.echo.AvatarCircle
import app.echo.designsystem.component.m3e.FlexibleAppBarSize
import app.echo.designsystem.component.m3e.RadioOption
import app.echo.designsystem.component.m3e.SegmentedList
import app.echo.designsystem.component.m3e.SegmentedListItem
import app.echo.designsystem.component.m3e.SwitchListItem
import app.echo.designsystem.icon.EchoIcons
import app.echo.designsystem.preview.EchoPreviewTheme
import app.echo.designsystem.preview.EchoPreviewThemes
import app.echo.designsystem.preview.EchoScreenPreviews
import app.echo.designsystem.theme.EchoTheme
import app.echo.designsystem.tokens.EchoSpacing

/** Prefix of a stored photo avatar: "photo:content://…". */
private const val PHOTO_PREFIX = "photo:"

/** The stored avatar ("initial", an icon's name or "photo:<uri>") as the picker's choice. */
internal fun Profile.avatarChoice(): AvatarChoice = when {
    avatar.startsWith(PHOTO_PREFIX) -> AvatarChoice.Photo(avatar.removePrefix(PHOTO_PREFIX))
    else -> EchoIcons.All.firstOrNull { it.name == avatar }?.let { AvatarChoice.Icon(it.outlined) } ?: AvatarChoice.Initial
}

/** The picker's choice as the stored avatar. */
internal fun AvatarChoice.key(): String = when (this) {
    AvatarChoice.Initial -> Profile.AVATAR_INITIAL
    is AvatarChoice.Icon -> EchoIcons.All.firstOrNull { it.outlined == icon }?.name ?: Profile.AVATAR_INITIAL
    is AvatarChoice.Photo -> PHOTO_PREFIX + uri
}

/** The ASMR catalogues the profile may use (S.3): adult ones only when adult content is allowed. */
internal fun Profile.musicSources(): List<Source> = visibleSources().filter { it.section == Section.ASMR }

internal fun Settings.musicSourceName(): String =
    (Sources.all.firstOrNull { it.id == asmr.musicSource } ?: Sources.asmrOne).name

/** Opens a settings screen with its ViewModel, once settings and profile have loaded. */
@Composable
internal fun WithSettings(content: @Composable (SettingsUiState, SettingsViewModel) -> Unit) {
    val vm = echoViewModel { SettingsViewModel(it) }
    val state by vm.state.collectAsStateWithLifecycle()
    state?.let { content(it, vm) }
}

/** S.3 Music source dialog. Picking one also makes it the active ASMR source, so Home and Search follow it. */
@Composable
internal fun MusicSourceDialog(state: SettingsUiState, onPick: (Source) -> Unit, onDismiss: () -> Unit) {
    val sources = state.profile.musicSources()
    ChoiceDialog(
        title = stringResource(R.string.settings_music_source),
        body = stringResource(R.string.settings_music_source_body),
        options = sources.map { RadioOption(it.name, it.description) },
        selected = sources.indexOfFirst { it.id == state.settings.asmr.musicSource }.coerceAtLeast(0),
        onConfirm = { onPick(sources[it]); onDismiss() },
        onDismiss = onDismiss,
    )
}

// S.1 Settings ------------------------------------------------------------------------------------------------------

@Composable
fun SettingsRoute(shell: ShellActions) = WithSettings { state, vm ->
    SettingsScreen(state, onBack = shell::back, onOpen = shell::open, onMusicSource = { vm.musicSource(it.id) })
}

/** Figma S.1 Settings (29:28648). */
@Composable
fun SettingsScreen(
    state: SettingsUiState,
    onBack: () -> Unit,
    onOpen: (Route) -> Unit,
    onMusicSource: (Source) -> Unit,
) {
    var picking by rememberSaveable { mutableStateOf(false) }
    val sourceName = state.settings.musicSourceName()
    val update = FakeUpdates.available
    SettingsFrame("S.1", stringResource(R.string.settings_title), onBack, size = FlexibleAppBarSize.Large) {
        GroupLabel(stringResource(R.string.settings_group_you))
        SegmentedList {
            item {
                SegmentedListItem(
                    headline = state.profile.name,
                    supporting = stringResource(R.string.settings_profile_summary),
                    onClick = { onOpen(Route.EditProfile) },
                    leading = { AvatarCircle(state.profile.avatarChoice(), state.profile.name, 40.dp) },
                    trailing = { ValueTrailing(null) },
                )
            }
        }
        GroupLabel(stringResource(R.string.settings_group_sources))
        SegmentedList {
            item {
                SegmentedListItem(
                    headline = stringResource(R.string.settings_music_source),
                    supporting = stringResource(R.string.settings_music_source_summary),
                    onClick = { picking = true },
                    leading = { TileIcon(EchoIcons.MusicNote) },
                    trailing = { ValueTrailing(sourceName) },
                )
            }
            item {
                SegmentedListItem(
                    headline = stringResource(R.string.settings_asmr_prefs, sourceName),
                    supporting = stringResource(R.string.settings_asmr_prefs_summary),
                    onClick = { onOpen(Route.Preferences) },
                    leading = { TileIcon(EchoIcons.Tune) },
                    trailing = { ValueTrailing(null) },
                )
            }
            if (state.profile.adultAllowed) {
                item {
                    SegmentedListItem(
                        headline = stringResource(R.string.settings_jav),
                        supporting = stringResource(R.string.settings_hide_upcoming),
                        onClick = { onOpen(Route.JavSettings) },
                        leading = { TileIcon(EchoIcons.Movie) },
                        trailing = { ValueTrailing(null) },
                    )
                }
            }
        }
        GroupLabel(stringResource(R.string.settings_group_app))
        SegmentedList {
            item { NavTile(R.string.settings_look, R.string.settings_look_summary, EchoIcons.Palette) { onOpen(Route.LookAndFeel) } }
            item { NavTile(R.string.settings_playback, R.string.settings_playback_summary, EchoIcons.Speed) { onOpen(Route.Playback) } }
            item { NavTile(R.string.settings_reader, R.string.settings_reader_summary, EchoIcons.MenuBook) { onOpen(Route.ReaderDefaults) } }
            item { NavTile(R.string.settings_ai, R.string.settings_ai_summary, EchoIcons.Subtitles) { onOpen(Route.AiSubtitles) } }
        }
        GroupLabel(stringResource(R.string.settings_group_device))
        SegmentedList {
            item { NavTile(R.string.settings_storage, R.string.settings_storage_summary, EchoIcons.Storage) { onOpen(Route.Storage) } }
            item {
                SegmentedListItem(
                    headline = stringResource(R.string.settings_updates),
                    onClick = { onOpen(Route.Updates) },
                    leading = { TileIcon(EchoIcons.Download) },
                    trailing = {
                        ValueTrailing(
                            if (update != null) stringResource(R.string.settings_updates_available, update.version)
                            else stringResource(R.string.settings_updates_none),
                        )
                    },
                )
            }
            item {
                SegmentedListItem(
                    headline = stringResource(R.string.settings_about),
                    supporting = stringResource(R.string.settings_about_summary, FakeUpdates.installed.version),
                    onClick = { onOpen(Route.About) },
                    leading = { TileIcon(EchoIcons.Info) },
                    trailing = { ValueTrailing(null) },
                )
            }
        }
    }
    if (picking) MusicSourceDialog(state, onMusicSource) { picking = false }
}

/** A tile that opens another screen: icon, title, summary, chevron. */
@Composable
private fun NavTile(title: Int, summary: Int, icon: Int, onClick: () -> Unit) = SegmentedListItem(
    headline = stringResource(title),
    supporting = stringResource(summary),
    onClick = onClick,
    leading = { TileIcon(icon) },
    trailing = { ValueTrailing(null) },
)

// S.2 Preferences + S.3 Music source ---------------------------------------------------------------------------------

/** Mirrors of asmr.one (S.2 Site mirror). */
internal val AsmrMirrors = listOf("asmr-100", "asmr-200", "asmr-300")

/** Languages asmr.one translates titles into (S.2 Translation language). */
internal val TranslationLanguages = listOf("English", "Japanese", "Chinese", "Korean")

/** Tags offered for the 1.1 Home rows (S.2 "Show tags on home page"). */
internal val HomeTagChoices = listOf("Binaural", "Ear cleaning", "Rain", "Whisper", "Heartbeat", "Roleplay", "No talking", "Sleep")

@Composable
fun AsmrPreferencesRoute(shell: ShellActions) = WithSettings { state, vm ->
    AsmrPreferencesScreen(state, onBack = shell::back, onMusicSource = { vm.musicSource(it.id) }, onAsmr = vm::asmr)
}

/** Figma S.2 Preferences (29:28765) with the S.3 Music source dialog (29:28844). */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun AsmrPreferencesScreen(
    state: SettingsUiState,
    onBack: () -> Unit,
    onMusicSource: (Source) -> Unit,
    onAsmr: (app.echo.data.model.AsmrSettings.() -> app.echo.data.model.AsmrSettings) -> Unit,
) {
    val asmr = state.settings.asmr
    var dialog by rememberSaveable { mutableStateOf<String?>(null) }
    SettingsFrame(
        "S.2", stringResource(R.string.settings_prefs_title), onBack,
        subtitle = stringResource(R.string.settings_prefs_subtitle, state.settings.musicSourceName()),
    ) {
        SegmentedListItem(
            headline = stringResource(R.string.settings_music_source),
            supporting = stringResource(R.string.settings_music_source_which),
            onClick = { dialog = DIALOG_SOURCE },
            trailing = { ValueTrailing(state.settings.musicSourceName()) },
            modifier = Modifier.padding(horizontal = EchoSpacing.screenMargin),
        )
        GroupLabel(stringResource(R.string.settings_group_browse))
        SegmentedList {
            item {
                SwitchListItem(stringResource(R.string.settings_subtitles_only), asmr.subtitlesOnly, { on -> onAsmr { copy(subtitlesOnly = on) } })
            }
            item {
                SwitchListItem(stringResource(R.string.settings_sfw_only), asmr.sfwOnly, { on -> onAsmr { copy(sfwOnly = on) } })
            }
        }
        GroupLabel(stringResource(R.string.settings_group_source))
        SegmentedList {
            item {
                SegmentedListItem(
                    headline = stringResource(R.string.settings_mirror), onClick = { dialog = DIALOG_MIRROR },
                    trailing = { ValueTrailing(asmr.mirror) },
                )
            }
            item {
                SegmentedListItem(
                    headline = stringResource(R.string.settings_translation), onClick = { dialog = DIALOG_LANGUAGE },
                    trailing = { ValueTrailing(asmr.translationLanguage) },
                )
            }
        }
        GroupLabel(stringResource(R.string.settings_home_tags, asmr.homeTags.size))
        FlowRow(
            Modifier.fillMaxWidth().padding(horizontal = EchoSpacing.screenMargin),
            horizontalArrangement = Arrangement.spacedBy(EchoSpacing.s),
        ) {
            HomeTagChoices.forEach { tag ->
                val on = tag in asmr.homeTags
                FilterChip(
                    selected = on,
                    onClick = { onAsmr { copy(homeTags = if (on) homeTags - tag else homeTags + tag) } },
                    label = { Text(tag) },
                    leadingIcon = if (on) {
                        { Icon(painterResource(EchoIcons.Check), null, Modifier.size(FilterChipDefaults.IconSize)) }
                    } else {
                        null
                    },
                )
            }
        }
    }
    when (dialog) {
        DIALOG_SOURCE -> MusicSourceDialog(state, onMusicSource) { dialog = null }
        DIALOG_MIRROR -> ChoiceDialog(
            title = stringResource(R.string.settings_mirror),
            options = AsmrMirrors.map { RadioOption(it) },
            selected = AsmrMirrors.indexOf(asmr.mirror).coerceAtLeast(0),
            onConfirm = { i -> onAsmr { copy(mirror = AsmrMirrors[i]) }; dialog = null },
            onDismiss = { dialog = null },
        )
        DIALOG_LANGUAGE -> ChoiceDialog(
            title = stringResource(R.string.settings_translation),
            options = TranslationLanguages.map { RadioOption(it) },
            selected = TranslationLanguages.indexOf(asmr.translationLanguage).coerceAtLeast(0),
            onConfirm = { i -> onAsmr { copy(translationLanguage = TranslationLanguages[i]) }; dialog = null },
            onDismiss = { dialog = null },
        )
    }
}

private const val DIALOG_SOURCE = "source"
private const val DIALOG_MIRROR = "mirror"
private const val DIALOG_LANGUAGE = "language"

// S.4 AI subtitles ---------------------------------------------------------------------------------------------------

/** Whisper models offered in S.4: the stored key, and its label. */
internal val AiModels = listOf("tiny" to "Tiny · 75 MB", "base" to "Base · 142 MB", "small" to "Small · 466 MB")

@Composable
fun AiSubtitlesRoute(shell: ShellActions) = WithSettings { state, vm ->
    AiSubtitlesScreen(state, onBack = shell::back, onAi = vm::aiSubtitles)
}

/** Figma S.4 AI subtitles (29:28958). UI only: the engine arrives with Android Phase 2. */
@Composable
fun AiSubtitlesScreen(
    state: SettingsUiState,
    onBack: () -> Unit,
    onAi: (app.echo.data.model.AiSubtitleSettings.() -> app.echo.data.model.AiSubtitleSettings) -> Unit,
) {
    val ai = state.settings.aiSubtitles
    var picking by rememberSaveable { mutableStateOf(false) }
    val modelLabel = AiModels.firstOrNull { it.first == ai.model }?.second ?: ai.model
    SettingsFrame("S.4", stringResource(R.string.settings_ai), onBack, subtitle = stringResource(R.string.settings_ai_subtitle)) {
        NoteCard(stringResource(R.string.settings_ai_note))
        SwitchListItem(
            stringResource(R.string.settings_ai), ai.enabled, { on -> onAi { copy(enabled = on) } },
            supporting = stringResource(R.string.settings_ai_switch_summary),
            modifier = Modifier.padding(horizontal = EchoSpacing.screenMargin),
        )
        GroupLabel(stringResource(R.string.settings_group_model))
        SegmentedList {
            item {
                SegmentedListItem(
                    headline = stringResource(R.string.settings_engine), onClick = {},
                    leading = { TileIcon(EchoIcons.Settings) },
                    trailing = { ValueTrailing(stringResource(R.string.settings_engine_value, ai.engine), chevron = false) },
                )
            }
            item {
                SegmentedListItem(
                    headline = stringResource(R.string.settings_model), onClick = { picking = true },
                    leading = { TileIcon(EchoIcons.Dns) },
                    trailing = { ValueTrailing(modelLabel) },
                )
            }
            item {
                SegmentedListItem(
                    headline = stringResource(R.string.settings_speed_device), onClick = {},
                    leading = { TileIcon(EchoIcons.Speed) },
                    trailing = { ValueTrailing(stringResource(R.string.settings_speed_device_value), chevron = false) },
                )
            }
        }
    }
    if (picking) {
        ChoiceDialog(
            title = stringResource(R.string.settings_model),
            options = AiModels.map { RadioOption(it.second) },
            selected = AiModels.indexOfFirst { it.first == ai.model }.coerceAtLeast(0),
            onConfirm = { i -> onAi { copy(model = AiModels[i].first) }; picking = false },
            onDismiss = { picking = false },
        )
    }
}

// S.5 JAV ------------------------------------------------------------------------------------------------------------

@Composable
fun JavSettingsRoute(shell: ShellActions) = WithSettings { state, vm ->
    JavSettingsScreen(state, onBack = shell::back, onHideUpcoming = { on -> vm.jav { copy(hideUpcoming = on) } })
}

/** Figma S.5 JAV (29:29011). */
@Composable
fun JavSettingsScreen(state: SettingsUiState, onBack: () -> Unit, onHideUpcoming: (Boolean) -> Unit) {
    SettingsFrame("S.5", stringResource(R.string.settings_jav), onBack, subtitle = stringResource(R.string.settings_saved_on_device)) {
        SwitchListItem(
            stringResource(R.string.settings_hide_upcoming), state.settings.jav.hideUpcoming, onHideUpcoming,
            supporting = stringResource(R.string.settings_hide_upcoming_summary),
            modifier = Modifier.padding(horizontal = EchoSpacing.screenMargin),
        )
        NoteCard(stringResource(R.string.settings_jav_note))
    }
}

// Previews -----------------------------------------------------------------------------------------------------------

internal val PreviewSettingsState = SettingsUiState(
    Settings(asmr = app.echo.data.model.AsmrSettings(sfwOnly = true, homeTags = setOf("Binaural", "Ear cleaning", "Rain"))),
    Profile(age = 24, showAdultSources = true, onboardingDone = true),
)

@EchoScreenPreviews
@Composable
private fun SettingsScreenPreview(@PreviewParameter(EchoPreviewThemes::class) theme: EchoPreviewTheme) = EchoTheme(theme.config) {
    Surface { SettingsScreen(PreviewSettingsState, {}, {}, {}) }
}

@EchoScreenPreviews
@Composable
private fun AsmrPreferencesScreenPreview(@PreviewParameter(EchoPreviewThemes::class) theme: EchoPreviewTheme) = EchoTheme(theme.config) {
    Surface { AsmrPreferencesScreen(PreviewSettingsState, {}, {}, {}) }
}
