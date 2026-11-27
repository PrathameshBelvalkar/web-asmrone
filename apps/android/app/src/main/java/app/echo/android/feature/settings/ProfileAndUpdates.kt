package app.echo.android.feature.settings

import app.echo.designsystem.component.m3e.SegmentedInfoItem
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.tooling.preview.PreviewParameter
import androidx.compose.ui.unit.dp
import app.echo.android.R
import app.echo.android.navigation.ShellActions
import app.echo.data.fake.AppRelease
import app.echo.data.fake.FakeUpdates
import app.echo.data.model.Profile
import app.echo.data.model.UpdateChannel
import app.echo.data.model.UpdateSettings
import app.echo.designsystem.component.echo.AvatarCircle
import app.echo.designsystem.component.echo.AvatarPicker
import app.echo.designsystem.component.m3e.ButtonStyle
import app.echo.designsystem.component.m3e.ConnectedButtonGroup
import app.echo.designsystem.component.m3e.ConnectedOption
import app.echo.designsystem.component.m3e.EchoButton
import app.echo.designsystem.component.m3e.EchoSheet
import app.echo.designsystem.component.m3e.SegmentedList
import app.echo.designsystem.component.m3e.SegmentedListItem
import app.echo.designsystem.component.m3e.SwitchListItem
import app.echo.designsystem.component.m3e.ValueIndicatorSlider
import app.echo.designsystem.icon.EchoIcons
import app.echo.designsystem.preview.EchoPreviewTheme
import app.echo.designsystem.preview.EchoPreviewThemes
import app.echo.designsystem.preview.EchoScreenPreviews
import app.echo.designsystem.theme.EchoTheme
import app.echo.designsystem.tokens.EchoSpacing

// S.12 Profile -------------------------------------------------------------------------------------------------------

private const val MIN_AGE = 13
private const val MAX_AGE = 80

@Composable
fun EditProfileRoute(shell: ShellActions, onReset: () -> Unit) = WithSettings("S.12") { state, vm ->
    EditProfileScreen(state.profile, onBack = shell::back, onProfile = vm::profile, onReset = onReset)
}

/** Figma S.12 Profile (29:29454). Name and age open dialogs; the avatar opens the picker sheet. */
@Composable
fun EditProfileScreen(profile: Profile, onBack: () -> Unit, onProfile: (Profile.() -> Profile) -> Unit, onReset: () -> Unit) {
    var dialog by rememberSaveable { mutableStateOf<String?>(null) }
    val adultAge = (profile.age ?: 0) >= Profile.ADULT_AGE
    SettingsFrame(
        "S.12", stringResource(R.string.settings_profile_title), onBack,
        subtitle = stringResource(R.string.settings_profile_subtitle),
    ) {
        Column(
            Modifier.fillMaxWidth().padding(vertical = EchoSpacing.l),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(EchoSpacing.m),
        ) {
            AvatarCircle(profile.avatarChoice(), profile.name, 96.dp)
            EchoButton(
                stringResource(R.string.settings_change_avatar), { dialog = DIALOG_AVATAR },
                style = ButtonStyle.Tonal, icon = EchoIcons.Edit,
            )
        }
        GroupLabel(stringResource(R.string.settings_group_about_you))
        SegmentedList {
            item {
                SegmentedListItem(
                    headline = stringResource(R.string.settings_name), onClick = { dialog = DIALOG_NAME },
                    trailing = { ValueTrailing(profile.name) },
                )
            }
            item {
                SegmentedListItem(
                    headline = stringResource(R.string.settings_age),
                    supporting = stringResource(R.string.settings_age_summary),
                    onClick = { dialog = DIALOG_AGE },
                    trailing = { ValueTrailing(profile.age?.toString() ?: "–") },
                )
            }
        }
        GroupLabel(stringResource(R.string.settings_group_content))
        SegmentedList {
            item {
                SwitchListItem(
                    stringResource(R.string.settings_adult_sources), profile.showAdultSources && adultAge,
                    { on -> onProfile { copy(showAdultSources = on) } },
                    supporting = stringResource(R.string.settings_adult_sources_summary),
                    enabled = adultAge,
                )
            }
            item {
                SegmentedListItem(
                    headline = stringResource(R.string.settings_reset_profile),
                    supporting = stringResource(R.string.settings_reset_profile_summary),
                    onClick = onReset,
                    trailing = { EchoButton(stringResource(R.string.settings_reset), onReset, style = ButtonStyle.Outlined) },
                )
            }
        }
    }
    when (dialog) {
        DIALOG_AVATAR -> EchoSheet(onDismiss = { dialog = null }, title = stringResource(R.string.settings_change_avatar)) {
            val pickPhoto = rememberAvatarPhotoPicker { photo -> onProfile { copy(avatar = photo.key()) }; dialog = null }
            AvatarPicker(
                name = profile.name,
                selected = profile.avatarChoice(),
                onSelect = { choice -> onProfile { copy(avatar = choice.key()) }; dialog = null },
                onPickPhoto = pickPhoto,
                modifier = Modifier.padding(bottom = EchoSpacing.xl),
            )
        }
        DIALOG_NAME -> NameDialog(profile.name, onSave = { name -> onProfile { copy(name = name.trim()) }; dialog = null }) { dialog = null }
        DIALOG_AGE -> AgeDialog(profile.age ?: Profile.ADULT_AGE, onSave = { age -> onProfile { copy(age = age) }; dialog = null }) {
            dialog = null
        }
    }
}

private const val DIALOG_AVATAR = "avatar"
private const val DIALOG_NAME = "name"
private const val DIALOG_AGE = "age"

@Composable
private fun NameDialog(initial: String, onSave: (String) -> Unit, onDismiss: () -> Unit) {
    var name by rememberSaveable { mutableStateOf(initial) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.settings_name)) },
        text = { OutlinedTextField(name, { name = it }, singleLine = true) },
        confirmButton = { TextButton(onClick = { onSave(name) }, enabled = name.isNotBlank()) { Text(stringResource(R.string.settings_save)) } },
        dismissButton = { TextButton(onClick = onDismiss) { Text(stringResource(android.R.string.cancel)) } },
    )
}

/** The `AgeSlider` dialog: 13 to 80+, with a mark at 18. */
@Composable
private fun AgeDialog(initial: Int, onSave: (Int) -> Unit, onDismiss: () -> Unit) {
    var age by rememberSaveable { mutableIntStateOf(initial) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.settings_age)) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(EchoSpacing.m)) {
                Text(stringResource(R.string.settings_age_summary), style = MaterialTheme.typography.bodyMedium)
                ValueIndicatorSlider(
                    value = age, onValueChange = { age = it }, range = MIN_AGE..MAX_AGE,
                    marker = Profile.ADULT_AGE, maxLabel = "$MAX_AGE+",
                )
            }
        },
        confirmButton = { TextButton(onClick = { onSave(age) }) { Text(stringResource(R.string.settings_save)) } },
        dismissButton = { TextButton(onClick = onDismiss) { Text(stringResource(android.R.string.cancel)) } },
    )
}

// S.13 App updates ---------------------------------------------------------------------------------------------------

@Composable
fun UpdatesRoute(shell: ShellActions) = WithSettings("S.13") { state, vm ->
    UpdatesScreen(
        state.settings.updates, onBack = shell::back, onUpdateNow = shell::startUpdate,
        onUpdates = { change ->
            // Turning the automatic check on checks straight away (Figma: the switch → S.14).
            val turnedOn = !state.settings.updates.autoCheck && state.settings.updates.change().autoCheck
            vm.updates(change)
            if (turnedOn) shell.checkForUpdates()
        },
    )
}

/** Figma S.13 App updates (29:29511). "Update now" opens the S.15 download sheet in the shell. */
@Composable
fun UpdatesScreen(
    updates: UpdateSettings,
    onBack: () -> Unit,
    onUpdates: (UpdateSettings.() -> UpdateSettings) -> Unit,
    onUpdateNow: () -> Unit,
    available: AppRelease? = FakeUpdates.available,
) {
    var notes by rememberSaveable { mutableStateOf(false) }
    val installed = FakeUpdates.installed
    SettingsFrame("S.13", stringResource(R.string.settings_updates), onBack, subtitle = stringResource(R.string.settings_updates_subtitle)) {
        if (available != null) {
            UpdateCard(available, installed, onUpdateNow, onNotes = { notes = true })
        } else {
            SegmentedInfoItem(
                headline = stringResource(R.string.settings_up_to_date, installed.version),
                leading = { TileIcon(EchoIcons.Check) },
                modifier = Modifier.padding(horizontal = EchoSpacing.screenMargin),
            )
        }
        GroupLabel(stringResource(R.string.settings_group_channel))
        ConnectedButtonGroup(
            options = listOf(
                ConnectedOption(stringResource(R.string.settings_channel_stable)),
                ConnectedOption(stringResource(R.string.settings_channel_beta)),
                ConnectedOption(stringResource(R.string.settings_channel_nightly)),
            ),
            selected = updates.channel.ordinal,
            onSelect = { i -> onUpdates { copy(channel = UpdateChannel.entries[i]) } },
            modifier = Modifier.padding(horizontal = EchoSpacing.screenMargin),
        )
        GroupLabel(stringResource(R.string.settings_group_options))
        SegmentedList {
            item {
                SwitchListItem(
                    stringResource(R.string.settings_auto_check), updates.autoCheck, { on -> onUpdates { copy(autoCheck = on) } },
                    supporting = stringResource(R.string.settings_auto_check_summary),
                )
            }
            item { SwitchListItem(stringResource(R.string.settings_wifi_only), updates.wifiOnly, { on -> onUpdates { copy(wifiOnly = on) } }) }
            item {
                SwitchListItem(
                    stringResource(R.string.settings_whats_new_after), updates.showWhatsNew,
                    { on -> onUpdates { copy(showWhatsNew = on) } },
                )
            }
        }
        GroupLabel(stringResource(R.string.settings_group_history))
        SegmentedList {
            FakeUpdates.history.forEach { release ->
                item {
                    val current = release.version == installed.version
                    SegmentedInfoItem(
                        headline = release.version,
                        supporting = if (current) stringResource(R.string.settings_installed_on, release.date) else release.date,
                        leading = { TileIcon(if (current) EchoIcons.Check else EchoIcons.History) },
                    )
                }
            }
        }
    }
    if (notes && available != null) {
        AlertDialog(
            onDismissRequest = { notes = false },
            title = { Text(stringResource(R.string.settings_update_available, available.version)) },
            text = { ReleaseNotes(available.notes) },
            confirmButton = { TextButton(onClick = { notes = false }) { Text(stringResource(android.R.string.ok)) } },
        )
    }
}

/** The filled card at the top of S.13: the new version, its notes, Update now · Release notes. */
@Composable
private fun UpdateCard(release: AppRelease, installed: AppRelease, onUpdateNow: () -> Unit, onNotes: () -> Unit) {
    Card(
        Modifier.fillMaxWidth().padding(horizontal = EchoSpacing.screenMargin, vertical = EchoSpacing.s),
        shape = MaterialTheme.shapes.extraLarge,
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerHigh),
    ) {
        Column(Modifier.padding(EchoSpacing.l), verticalArrangement = Arrangement.spacedBy(EchoSpacing.m)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(EchoSpacing.m)) {
                UpdateIcon()
                Column {
                    Text(stringResource(R.string.settings_update_available, release.version), style = MaterialTheme.typography.titleMediumEmphasized)
                    Text(
                        stringResource(R.string.settings_update_meta, installed.version, release.sizeMb.toString(), release.date),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            ReleaseNotes(release.notes)
            Row(horizontalArrangement = Arrangement.spacedBy(EchoSpacing.s)) {
                EchoButton(stringResource(R.string.settings_update_now), onUpdateNow, icon = EchoIcons.Download)
                EchoButton(stringResource(R.string.settings_release_notes), onNotes, style = ButtonStyle.Text, icon = EchoIcons.OpenInNew)
            }
        }
    }
}

/** The square download icon of S.13–S.15. */
@Composable
fun UpdateIcon(modifier: Modifier = Modifier) {
    Box(
        modifier.size(48.dp).clip(MaterialTheme.shapes.medium).background(MaterialTheme.colorScheme.primary),
        contentAlignment = Alignment.Center,
    ) {
        Icon(painterResource(EchoIcons.Download), null, tint = MaterialTheme.colorScheme.onPrimary)
    }
}

/** Release notes as a bullet list. */
@Composable
fun ReleaseNotes(notes: List<String>, modifier: Modifier = Modifier) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(EchoSpacing.xs)) {
        notes.forEach { note -> Text("•  $note", style = MaterialTheme.typography.bodyMedium) }
    }
}

// Previews -----------------------------------------------------------------------------------------------------------

@EchoScreenPreviews
@Composable
private fun EditProfileScreenPreview(@PreviewParameter(EchoPreviewThemes::class) theme: EchoPreviewTheme) = EchoTheme(theme.config) {
    Surface { EditProfileScreen(Profile(age = 24, showAdultSources = true), {}, {}, {}) }
}

@EchoScreenPreviews
@Composable
private fun UpdatesScreenPreview(@PreviewParameter(EchoPreviewThemes::class) theme: EchoPreviewTheme) = EchoTheme(theme.config) {
    Surface { UpdatesScreen(UpdateSettings(), {}, {}, {}) }
}
