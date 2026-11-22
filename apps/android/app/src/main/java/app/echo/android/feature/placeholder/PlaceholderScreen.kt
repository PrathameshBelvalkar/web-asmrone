package app.echo.android.feature.placeholder

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import app.echo.android.R
import app.echo.android.navigation.Route
import app.echo.android.navigation.ScreenSpec
import app.echo.android.navigation.ScreenSpecs
import app.echo.designsystem.component.m3e.ButtonStyle
import app.echo.designsystem.component.m3e.EchoButton
import app.echo.designsystem.component.m3e.EchoSheet
import app.echo.designsystem.component.m3e.SegmentedList
import app.echo.designsystem.component.m3e.SegmentedListItem
import app.echo.designsystem.icon.EchoIcons
import app.echo.designsystem.tokens.EchoSpacing

/** An extra button on a placeholder (play the sample, finish onboarding …). */
data class PlaceholderAction(val label: String, val onClick: () -> Unit)

/**
 * Stand-in for a screen until its phase builds it (design.md §2, Phase 4): the Figma code and name, the screens it
 * opens (from the Figma prototype), its overlays, and any [actions]. [topBar] is the shell's app bar for this
 * route (search app bar on section homes, back arrow elsewhere).
 */
@Composable
fun PlaceholderScreen(
    spec: ScreenSpec,
    onOpen: (Route) -> Unit,
    contentPadding: PaddingValues,
    modifier: Modifier = Modifier,
    actions: List<PlaceholderAction> = emptyList(),
    extra: @Composable () -> Unit = {},
    topBar: @Composable () -> Unit = {},
) {
    var overlay by remember { mutableStateOf<OverlaySpec?>(null) }
    Column(modifier.fillMaxSize().testTag("screen:${spec.code}")) {
        topBar()
        Column(
            Modifier.verticalScroll(rememberScrollState()).padding(contentPadding),
            verticalArrangement = Arrangement.spacedBy(EchoSpacing.s),
        ) {
            Column(Modifier.padding(horizontal = EchoSpacing.screenMargin, vertical = EchoSpacing.l)) {
                Text(spec.code, style = MaterialTheme.typography.displaySmall, color = MaterialTheme.colorScheme.primary)
                Text(spec.name, style = MaterialTheme.typography.headlineSmall)
                Text(
                    stringResource(R.string.placeholder_note, "${spec.code} ${spec.name}"),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            extra()
            actions.forEach { action ->
                EchoButton(action.label, action.onClick, Modifier.padding(horizontal = EchoSpacing.screenMargin))
            }
            if (spec.links.isNotEmpty()) {
                Label(stringResource(R.string.placeholder_opens))
                SegmentedList {
                    spec.links.forEach { target ->
                        val t = ScreenSpecs.of(target)
                        item {
                            SegmentedListItem(
                                headline = "${t.code} ${t.name}",
                                supporting = target.toString().substringAfter("Route."),
                                onClick = { onOpen(target) },
                                modifier = Modifier.testTag("link:${t.code}"),
                            )
                        }
                    }
                }
            }
            val overlays = Overlays.byScreen[spec.code].orEmpty()
            if (overlays.isNotEmpty()) {
                Label(stringResource(R.string.placeholder_overlays))
                SegmentedList {
                    overlays.forEach { o ->
                        item { SegmentedListItem("${o.code} ${o.name}", onClick = { overlay = o }, supporting = o.kind.name.lowercase()) }
                    }
                }
            }
            Spacer(Modifier.height(EchoSpacing.xxxl))
        }
    }
    overlay?.let { OverlayPlaceholder(it, onDismiss = { overlay = null }) }
}

/** A sheet or dialog standing in for an overlay frame. */
@Composable
fun OverlayPlaceholder(overlay: OverlaySpec, onDismiss: () -> Unit) {
    val text = stringResource(R.string.placeholder_note, "${overlay.code} ${overlay.name}")
    when (overlay.kind) {
        OverlayKind.DIALOG -> AlertDialog(
            onDismissRequest = onDismiss,
            title = { Text("${overlay.code} ${overlay.name}") },
            text = { Text(text) },
            confirmButton = { TextButton(onClick = onDismiss) { Text(stringResource(android.R.string.ok)) } },
            modifier = Modifier.testTag("overlay:${overlay.code}"),
        )
        OverlayKind.SHEET, OverlayKind.PAGE -> EchoSheet(
            onDismiss = onDismiss,
            title = "${overlay.code} ${overlay.name}",
            subtitle = text,
            modifier = Modifier.testTag("overlay:${overlay.code}"),
        ) {
            EchoButton(
                stringResource(android.R.string.ok), onDismiss, style = ButtonStyle.Tonal, icon = EchoIcons.Check,
                modifier = Modifier.padding(EchoSpacing.sectionPadding),
            )
        }
    }
}

@Composable
private fun Label(text: String) = Text(
    text.uppercase(),
    style = MaterialTheme.typography.labelMedium,
    color = MaterialTheme.colorScheme.onSurfaceVariant,
    modifier = Modifier.padding(start = EchoSpacing.xxxl, top = EchoSpacing.m),
)
