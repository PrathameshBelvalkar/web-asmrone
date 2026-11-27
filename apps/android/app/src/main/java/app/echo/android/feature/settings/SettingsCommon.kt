package app.echo.android.feature.settings

import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.heading
import androidx.annotation.DrawableRes
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.windowInsetsBottomHeight
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.echo.android.AppContainer
import app.echo.data.model.AiSubtitleSettings
import app.echo.data.model.AsmrSettings
import app.echo.data.model.JavSettings
import app.echo.data.model.PlaybackSettings
import app.echo.data.model.Profile
import app.echo.data.model.ReaderSettings
import app.echo.data.model.Settings
import app.echo.data.model.ThemeSettings
import app.echo.data.model.UpdateSettings
import app.echo.designsystem.component.m3e.EchoFlexibleAppBar
import app.echo.designsystem.component.m3e.FlexibleAppBarSize
import app.echo.designsystem.component.m3e.RadioOption
import app.echo.designsystem.component.m3e.RadioOptionList
import app.echo.designsystem.icon.EchoIcons
import app.echo.designsystem.tokens.EchoSpacing
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

/** What every S screen reads: the settings DataStore and the profile. Null until both have loaded. */
data class SettingsUiState(val settings: Settings, val profile: Profile)

/** One ViewModel for the S screens. Every change is written straight away; there's no Save button (Phase 10). */
class SettingsViewModel(private val container: AppContainer) : ViewModel() {
    val state: StateFlow<SettingsUiState?> = combine(container.settings.settings, container.profile.profile, ::SettingsUiState)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)

    fun theme(change: ThemeSettings.() -> ThemeSettings) = viewModelScope.launch { container.settings.updateTheme(change) }
    fun playback(change: PlaybackSettings.() -> PlaybackSettings) = viewModelScope.launch { container.settings.updatePlayback(change) }
    fun reader(change: ReaderSettings.() -> ReaderSettings) = viewModelScope.launch { container.settings.updateReader(change) }
    fun asmr(change: AsmrSettings.() -> AsmrSettings) = viewModelScope.launch { container.settings.updateAsmr(change) }
    fun jav(change: JavSettings.() -> JavSettings) = viewModelScope.launch { container.settings.updateJav(change) }
    fun updates(change: UpdateSettings.() -> UpdateSettings) = viewModelScope.launch { container.settings.updateUpdates(change) }
    fun aiSubtitles(change: AiSubtitleSettings.() -> AiSubtitleSettings) =
        viewModelScope.launch { container.settings.updateAiSubtitles(change) }
    fun profile(change: Profile.() -> Profile) = viewModelScope.launch { container.profile.update(change) }

    /** S.3: the ASMR catalogue. When ASMR is the active section, Home and Search switch to it too. */
    fun musicSource(id: String) = viewModelScope.launch {
        container.settings.updateAsmr { copy(musicSource = id) }
        val last = container.settings.settings.first().lastSourceId
        if (app.echo.data.model.Sources.all.firstOrNull { it.id == last }?.section == app.echo.data.model.Section.ASMR) {
            container.settings.setLastSource(id)
        }
    }
}

/**
 * The frame of every S screen (Figma S.1–S.13): a flexible app bar with back, the title and a subtitle, then the
 * groups in a scrolling column. No navigation bar.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun SettingsFrame(
    code: String,
    title: String,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
    subtitle: String? = null,
    size: FlexibleAppBarSize = FlexibleAppBarSize.Medium,
    content: @Composable ColumnScope.() -> Unit,
) {
    val scroll = TopAppBarDefaults.exitUntilCollapsedScrollBehavior()
    Column(modifier.fillMaxSize().nestedScroll(scroll.nestedScrollConnection).testTag("screen:$code")) {
        EchoFlexibleAppBar(title = title, subtitle = subtitle, size = size, onBack = onBack, scrollBehavior = scroll)
        Column(
            Modifier.fillMaxWidth().weight(1f).verticalScroll(rememberScrollState()).padding(top = EchoSpacing.xs),
        ) {
            content()
            Spacer(Modifier.padding(bottom = EchoSpacing.xxl).windowInsetsBottomHeight(WindowInsets.navigationBars))
        }
    }
}

/** A group's overline ("YOU", "SOURCES" …), lined up with the text inside the tiles. [value] keeps its case ("10 s"). */
@Composable
internal fun GroupLabel(text: String, modifier: Modifier = Modifier, value: String? = null) {
    Text(
        text.uppercase() + value?.let { " · $it" }.orEmpty(),
        style = MaterialTheme.typography.labelMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = modifier.semantics { heading() }.padding(
            start = EchoSpacing.screenMargin + EchoSpacing.l, end = EchoSpacing.screenMargin,
            top = EchoSpacing.l, bottom = EchoSpacing.s,
        ),
    )
}

/** A tile's leading icon. */
@Composable
internal fun TileIcon(@DrawableRes icon: Int) = Icon(painterResource(icon), contentDescription = null)

/** A tile's trailing value and chevron ("asmr-100 ›"); [chevron] off for read-only values. */
@Composable
internal fun ValueTrailing(value: String?, chevron: Boolean = true) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(EchoSpacing.s)) {
        if (value != null) {
            Text(value, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        if (chevron) {
            Icon(
                painterResource(EchoIcons.ChevronRight), contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

/** A dashed note (Figma S.4, S.5): an info icon and a line or two of small text. */
@Composable
internal fun NoteCard(text: String, modifier: Modifier = Modifier) {
    val outline = MaterialTheme.colorScheme.outlineVariant
    Row(
        modifier
            .fillMaxWidth()
            .padding(horizontal = EchoSpacing.screenMargin, vertical = EchoSpacing.s)
            .drawBehind {
                val stroke = 1.dp.toPx()
                drawRoundRect(
                    color = outline,
                    cornerRadius = CornerRadius(12.dp.toPx()),
                    style = Stroke(stroke, pathEffect = PathEffect.dashPathEffect(floatArrayOf(4.dp.toPx(), 3.dp.toPx()))),
                )
            }
            .padding(horizontal = EchoSpacing.m, vertical = EchoSpacing.s),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(EchoSpacing.s),
    ) {
        Icon(
            painterResource(EchoIcons.Info), contentDescription = null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(16.dp),
        )
        Text(text, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

/**
 * A single-choice dialog (Figma S.3): title, an optional line, the radio group, Cancel · OK. OK saves; the
 * choice isn't written until then.
 */
@Composable
internal fun ChoiceDialog(
    title: String,
    options: List<RadioOption>,
    selected: Int,
    onConfirm: (Int) -> Unit,
    onDismiss: () -> Unit,
    body: String? = null,
) {
    var choice by rememberSaveable { mutableIntStateOf(selected) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(EchoSpacing.s)) {
                if (body != null) Text(body, style = MaterialTheme.typography.bodyMedium)
                RadioOptionList(options, choice, onSelect = { choice = it })
            }
        },
        confirmButton = { TextButton(onClick = { onConfirm(choice) }) { Text(stringResource(android.R.string.ok)) } },
        dismissButton = { TextButton(onClick = onDismiss) { Text(stringResource(android.R.string.cancel)) } },
    )
}
