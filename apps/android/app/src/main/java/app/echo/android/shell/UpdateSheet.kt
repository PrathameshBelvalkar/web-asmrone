package app.echo.android.shell

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearWavyProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import app.echo.android.R
import app.echo.android.feature.settings.ReleaseNotes
import app.echo.android.feature.settings.UpdateIcon
import app.echo.data.fake.AppRelease
import app.echo.designsystem.component.m3e.ButtonStyle
import app.echo.designsystem.component.m3e.ComponentSize
import app.echo.designsystem.component.m3e.EchoButton
import app.echo.designsystem.component.m3e.EchoButtonGroup
import app.echo.designsystem.component.m3e.EchoSheet
import app.echo.designsystem.icon.EchoIcons
import app.echo.designsystem.tokens.EchoSpacing
import java.util.Locale
import kotlin.math.roundToInt

private const val DOWNLOAD_SECONDS = 20

/** "Install when ready" is longer than Cancel: it gets more of the row so it stays on one line. */
private const val INSTALL_WEIGHT = 1.5f

/**
 * The update sheet over the shell. [UpdateStep.OFFER] is Figma S.14 Update available (29:29607), Later · Update
 * now; [UpdateStep.DOWNLOADING] is S.15 Downloading update (29:29765), Cancel · Install when ready.
 */
@Composable
fun UpdateSheet(
    release: AppRelease,
    step: UpdateStep,
    progress: Float,
    onLater: () -> Unit,
    onHide: () -> Unit,
    onUpdate: () -> Unit,
    onCancel: () -> Unit,
    onInstall: () -> Unit,
) {
    val downloading = step == UpdateStep.DOWNLOADING
    EchoSheet(
        onDismiss = if (downloading) onCancel else onHide,
        modifier = Modifier.testTag(if (downloading) "overlay:S.15" else "overlay:S.14"),
    ) {
        Column(
            Modifier.fillMaxWidth().padding(horizontal = EchoSpacing.screenMargin + EchoSpacing.xs),
            verticalArrangement = Arrangement.spacedBy(EchoSpacing.m),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(EchoSpacing.m)) {
                UpdateIcon(Modifier.size(56.dp))
                Column {
                    Text(
                        if (downloading) stringResource(R.string.update_downloading, release.version)
                        else stringResource(R.string.update_ready, release.version),
                        style = MaterialTheme.typography.titleLargeEmphasized,
                    )
                    Text(
                        if (downloading) {
                            val done = String.format(Locale.ROOT, "%.1f", release.sizeMb * progress)
                            stringResource(
                                R.string.update_progress, done, release.sizeMb.toString(),
                                ((1f - progress) * DOWNLOAD_SECONDS).roundToInt(),
                            )
                        } else {
                            stringResource(R.string.update_ready_meta, release.sizeMb.toString(), release.date)
                        },
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            if (downloading) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(EchoSpacing.m)) {
                    LinearWavyProgressIndicator(progress = { progress }, modifier = Modifier.weight(1f))
                    Text(stringResource(R.string.update_percent, (progress * 100).roundToInt()), style = MaterialTheme.typography.labelLarge)
                }
                Row(horizontalArrangement = Arrangement.spacedBy(EchoSpacing.s)) {
                    Icon(
                        painterResource(EchoIcons.Info), null,
                        tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(16.dp),
                    )
                    Text(
                        stringResource(R.string.update_install_note),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            } else {
                Text(
                    stringResource(R.string.update_whats_new).uppercase(),
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                ReleaseNotes(release.notes)
            }
        }
        EchoButtonGroup(Modifier.padding(top = EchoSpacing.l, bottom = EchoSpacing.l)) {
            if (downloading) {
                EchoButton(stringResource(android.R.string.cancel), onCancel, Modifier.weight(1f), ButtonStyle.Outlined, ComponentSize.M)
                EchoButton(
                    stringResource(if (progress >= 1f) R.string.update_install else R.string.update_install_when_ready),
                    onInstall, Modifier.weight(INSTALL_WEIGHT), size = ComponentSize.M, icon = EchoIcons.Download, enabled = progress >= 1f,
                )
            } else {
                EchoButton(stringResource(R.string.update_later), onLater, Modifier.weight(1f), ButtonStyle.Outlined, ComponentSize.M)
                EchoButton(
                    stringResource(R.string.settings_update_now), onUpdate, Modifier.weight(1f),
                    size = ComponentSize.M, icon = EchoIcons.Download,
                )
            }
        }
    }
}
