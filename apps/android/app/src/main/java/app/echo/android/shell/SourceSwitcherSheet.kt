package app.echo.android.shell

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import app.echo.android.R
import app.echo.data.model.Section
import app.echo.data.model.Source
import app.echo.designsystem.component.m3e.BadgeStyle
import app.echo.designsystem.component.m3e.ButtonStyle
import app.echo.designsystem.component.m3e.CoverBadge
import app.echo.designsystem.component.m3e.EchoButton
import app.echo.designsystem.component.m3e.EchoSheet
import app.echo.designsystem.component.m3e.SegmentedList
import app.echo.designsystem.component.m3e.SegmentedListItem
import app.echo.designsystem.icon.EchoIcons
import app.echo.designsystem.theme.EchoShapes
import app.echo.designsystem.tokens.EchoSizes
import app.echo.designsystem.tokens.EchoSpacing

/** The section's icon, used in the source switcher pill and this sheet. */
fun Section.icon(): Int = when (this) {
    Section.ASMR -> EchoIcons.MusicNote
    Section.MANGA -> EchoIcons.Book
    Section.JAV -> EchoIcons.Movie
    Section.HENTAI -> EchoIcons.PlayArrow
}

@Composable
private fun Section.label(): String = stringResource(
    when (this) {
        Section.ASMR -> R.string.section_asmr
        Section.MANGA -> R.string.section_manga
        Section.JAV -> R.string.section_jav
        Section.HENTAI -> R.string.section_hentai
    },
)

/**
 * 0.1 Source switcher (Figma "M3E · Bottom sheet (Modal)" over Home): sources grouped by section, single-select
 * segmented lists, BETA on JAV. Only sources the profile allows are listed (adult rule).
 */
@Composable
fun SourceSwitcherSheet(
    sources: List<Source>,
    selected: Source,
    onSelect: (Source) -> Unit,
    onSettings: () -> Unit,
    onDismiss: () -> Unit,
) {
    EchoSheet(
        onDismiss = onDismiss,
        title = stringResource(R.string.source_switcher_title),
        subtitle = stringResource(R.string.source_switcher_subtitle),
        modifier = Modifier.testTag("overlay:0.1"),
    ) {
        sources.groupBy { it.section }.forEach { (section, list) ->
            Row(
                Modifier.padding(start = EchoSpacing.xxxl, top = EchoSpacing.s, bottom = EchoSpacing.xs),
                horizontalArrangement = Arrangement.spacedBy(EchoSpacing.s - EchoSpacing.xxs),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(section.label(), style = MaterialTheme.typography.labelMediumEmphasized, color = MaterialTheme.colorScheme.onSurfaceVariant)
                if (list.any { it.beta }) CoverBadge(stringResource(R.string.badge_beta), style = BadgeStyle.Accent)
            }
            SegmentedList {
                list.forEach { source ->
                    val isSelected = source == selected
                    item {
                        SegmentedListItem(
                            headline = source.name,
                            supporting = source.description,
                            selected = isSelected,
                            onClick = { onSelect(source) },
                            modifier = Modifier.testTag("source:${source.id}"),
                            leading = {
                                Box(
                                    Modifier.size(EchoSizes.Button.s).clip(EchoShapes.Full).background(
                                        if (isSelected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceContainerHighest,
                                    ),
                                    contentAlignment = Alignment.Center,
                                ) {
                                    Icon(
                                        painterResource(section.icon()), null, Modifier.size(EchoSizes.iconSmall),
                                        tint = if (isSelected) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurfaceVariant,
                                    )
                                }
                            },
                            trailing = if (isSelected) {
                                { Icon(painterResource(EchoIcons.Check), null) }
                            } else {
                                null
                            },
                        )
                    }
                }
            }
        }
        EchoButton(
            stringResource(R.string.source_switcher_settings), onSettings, style = ButtonStyle.Text, icon = EchoIcons.Settings,
            modifier = Modifier.padding(horizontal = EchoSpacing.l, vertical = EchoSpacing.l),
        )
    }
}
