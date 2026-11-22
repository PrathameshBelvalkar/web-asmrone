package app.echo.android.feature.settings

import android.content.Context
import android.text.format.Formatter
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.echo.android.R
import app.echo.android.navigation.Route
import app.echo.android.navigation.ShellActions
import app.echo.android.ui.echoViewModel
import app.echo.data.fake.FakeUpdates
import app.echo.designsystem.component.m3e.ButtonStyle
import app.echo.designsystem.component.m3e.ComponentSize
import app.echo.designsystem.component.m3e.EchoButton
import app.echo.designsystem.component.m3e.SegmentedList
import app.echo.designsystem.component.m3e.SegmentedListItem
import app.echo.designsystem.icon.EchoIcons
import app.echo.designsystem.tokens.EchoSpacing
import coil3.SingletonImageLoader
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File

// S.6 Storage + S.7 Clear all data -----------------------------------------------------------------------------------

/** Bytes in the two caches S.6 shows. */
data class CacheSizes(val images: Long = 0, val sources: Long = 0)

/**
 * The caches on this device: Coil's image cache (covers and pages), and everything else in the app's cache folder
 * (feeds and search results). Sizes are measured on the IO dispatcher.
 */
class StorageViewModel(context: Context) : ViewModel() {
    private val app = context.applicationContext
    private val _sizes = MutableStateFlow(CacheSizes())
    val sizes: StateFlow<CacheSizes> = _sizes

    init { refresh() }

    private fun imageDir(): File? = SingletonImageLoader.get(app).diskCache?.directory?.toFile()

    private fun refresh() = viewModelScope.launch {
        _sizes.value = withContext(Dispatchers.IO) {
            val imageDir = imageDir()
            val images = imageDir?.let(::sizeOf) ?: 0L
            val sources = app.cacheDir.listFiles().orEmpty().filter { it != imageDir }.sumOf(::sizeOf)
            CacheSizes(images, sources)
        }
    }

    fun clearImages() = viewModelScope.launch {
        val loader = SingletonImageLoader.get(app)
        loader.memoryCache?.clear()
        withContext(Dispatchers.IO) { loader.diskCache?.clear() }
        refresh()
    }

    fun clearSources() = viewModelScope.launch {
        withContext(Dispatchers.IO) {
            val imageDir = imageDir()
            app.cacheDir.listFiles().orEmpty().filter { it != imageDir }.forEach { it.deleteRecursively() }
        }
        refresh()
    }

    /** S.7 also empties both caches. */
    fun clearCaches() = viewModelScope.launch {
        SingletonImageLoader.get(app).memoryCache?.clear()
        withContext(Dispatchers.IO) { app.cacheDir.listFiles().orEmpty().forEach { it.deleteRecursively() } }
        refresh()
    }

    private fun sizeOf(file: File): Long = file.walkBottomUp().filter { it.isFile }.sumOf { it.length() }
}

@Composable
fun StorageRoute(shell: ShellActions, onClearAll: () -> Unit) {
    val context = LocalContext.current
    val vm = echoViewModel { StorageViewModel(context) }
    val sizes by vm.sizes.collectAsStateWithLifecycle()
    StorageScreen(
        sizes = sizes,
        onBack = shell::back,
        onClearImages = vm::clearImages,
        onClearSources = vm::clearSources,
        onClearAll = { vm.clearCaches(); onClearAll() },
    )
}

/** Figma S.6 Storage (29:29039) with the S.7 Clear all data dialog (29:29079). */
@Composable
fun StorageScreen(
    sizes: CacheSizes,
    onBack: () -> Unit,
    onClearImages: () -> Unit,
    onClearSources: () -> Unit,
    onClearAll: () -> Unit,
) {
    val context = LocalContext.current
    var confirming by rememberSaveable { mutableStateOf(false) }
    SettingsFrame("S.6", stringResource(R.string.settings_storage), onBack, subtitle = stringResource(R.string.settings_storage_subtitle)) {
        SegmentedList {
            item {
                SegmentedListItem(
                    headline = stringResource(R.string.settings_image_cache),
                    supporting = stringResource(R.string.settings_image_cache_summary, Formatter.formatShortFileSize(context, sizes.images)),
                    onClick = onClearImages,
                    trailing = { EchoButton(stringResource(R.string.settings_clear), onClearImages, style = ButtonStyle.Outlined) },
                )
            }
            item {
                SegmentedListItem(
                    headline = stringResource(R.string.settings_source_caches),
                    supporting = stringResource(R.string.settings_source_caches_summary, Formatter.formatShortFileSize(context, sizes.sources)),
                    onClick = onClearSources,
                    trailing = { EchoButton(stringResource(R.string.settings_clear), onClearSources, style = ButtonStyle.Outlined) },
                )
            }
        }
        GroupLabel(stringResource(R.string.settings_group_danger))
        SegmentedListItem(
            headline = stringResource(R.string.settings_clear_all),
            supporting = stringResource(R.string.settings_clear_all_summary),
            onClick = { confirming = true },
            trailing = { DangerButton(stringResource(R.string.settings_clear), icon = true) { confirming = true } },
            modifier = Modifier.padding(horizontal = EchoSpacing.screenMargin),
        )
    }
    if (confirming) {
        AlertDialog(
            onDismissRequest = { confirming = false },
            title = { Text(stringResource(R.string.settings_clear_all_title)) },
            text = { Text(stringResource(R.string.settings_clear_all_body)) },
            confirmButton = { DangerButton(stringResource(R.string.settings_clear_all)) { confirming = false; onClearAll() } },
            dismissButton = { TextButton(onClick = { confirming = false }) { Text(stringResource(android.R.string.cancel)) } },
        )
    }
}

/** Filled, S, in the error colours (S.6 Clear, S.7 Clear all data). */
@Composable
private fun DangerButton(text: String, icon: Boolean = false, onClick: () -> Unit) {
    Button(
        onClick = onClick,
        colors = ButtonDefaults.buttonColors(
            containerColor = MaterialTheme.colorScheme.error,
            contentColor = MaterialTheme.colorScheme.onError,
        ),
        contentPadding = ButtonDefaults.contentPaddingFor(ComponentSize.S.height, hasStartIcon = icon),
    ) {
        if (icon) {
            Icon(painterResource(EchoIcons.Delete), null, Modifier.size(ButtonDefaults.iconSizeFor(ComponentSize.S.height)))
            androidx.compose.foundation.layout.Spacer(Modifier.size(ButtonDefaults.iconSpacingFor(ComponentSize.S.height)))
        }
        Text(text)
    }
}

// S.11 About ---------------------------------------------------------------------------------------------------------

private const val ECHO_REPO = "https://github.com/brahmkshatriya/echo"
private const val MIHON_REPO = "https://github.com/mihonapp/mihon"

@Composable
fun AboutRoute(shell: ShellActions) = AboutScreen(onBack = shell::back, onOpen = shell::open)

/** Figma S.11 About (29:29387). */
@Composable
fun AboutScreen(onBack: () -> Unit, onOpen: (Route) -> Unit) {
    val uri = LocalUriHandler.current
    val update = FakeUpdates.available
    SettingsFrame("S.11", stringResource(R.string.settings_about), onBack, subtitle = stringResource(R.string.settings_about_subtitle)) {
        Column(
            Modifier.fillMaxWidth().padding(vertical = EchoSpacing.l),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(EchoSpacing.s),
        ) {
            Box(
                Modifier.size(80.dp).clip(MaterialTheme.shapes.extraLarge).background(MaterialTheme.colorScheme.primaryContainer),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    painterResource(EchoIcons.MusicNoteFilled), null,
                    tint = MaterialTheme.colorScheme.onPrimaryContainer, modifier = Modifier.size(36.dp),
                )
            }
            Text(stringResource(R.string.app_name), style = MaterialTheme.typography.headlineSmallEmphasized)
            Text(
                stringResource(R.string.settings_about_version, FakeUpdates.installed.version),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
            )
        }
        GroupLabel(stringResource(R.string.settings_group_project))
        SegmentedList {
            item {
                SegmentedListItem(
                    headline = stringResource(R.string.settings_updates), onClick = { onOpen(Route.Updates) },
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
                    headline = stringResource(R.string.settings_source_code), onClick = { uri.openUri(ECHO_REPO) },
                    leading = { TileIcon(EchoIcons.OpenInNew) }, trailing = { ValueTrailing(null) },
                )
            }
            item {
                SegmentedListItem(
                    headline = stringResource(R.string.settings_whats_new), onClick = { onOpen(Route.Updates) },
                    leading = { TileIcon(EchoIcons.Info) }, trailing = { ValueTrailing(null) },
                )
            }
        }
        GroupLabel(stringResource(R.string.settings_group_licences))
        SegmentedList {
            item {
                SegmentedListItem(
                    headline = stringResource(R.string.settings_credit_echo),
                    supporting = stringResource(R.string.settings_credit_echo_summary),
                    onClick = { uri.openUri(ECHO_REPO) }, trailing = { ValueTrailing(null) },
                )
            }
            item {
                SegmentedListItem(
                    headline = stringResource(R.string.settings_credit_mihon),
                    supporting = stringResource(R.string.settings_credit_mihon_summary),
                    onClick = { uri.openUri(MIHON_REPO) }, trailing = { ValueTrailing(null) },
                )
            }
            item {
                SegmentedListItem(
                    headline = stringResource(R.string.settings_oss_licences),
                    onClick = { uri.openUri("$ECHO_REPO/blob/main/LICENSE") }, trailing = { ValueTrailing(null) },
                )
            }
        }
    }
}
