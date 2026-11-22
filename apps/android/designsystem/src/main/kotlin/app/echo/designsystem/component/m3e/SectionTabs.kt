package app.echo.designsystem.component.m3e

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.PrimaryScrollableTabRow
import androidx.compose.material3.Tab
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.echo.designsystem.preview.EchoPreviews
import app.echo.designsystem.preview.EchoThemesPreview
import app.echo.designsystem.preview.PreviewData
import app.echo.designsystem.tokens.EchoSpacing

/** Primary scrollable tabs (Figma "M3E · Tabs (Primary, scrollable)", 20 screens), e.g. For you · Popular · New. */
@Composable
fun SectionTabs(
    tabs: List<String>,
    selected: Int,
    onSelect: (Int) -> Unit,
    modifier: Modifier = Modifier,
) {
    PrimaryScrollableTabRow(
        selectedTabIndex = selected,
        modifier = modifier,
        edgePadding = EchoSpacing.s,
        containerColor = MaterialTheme.colorScheme.surface,
    ) {
        tabs.forEachIndexed { index, title ->
            Tab(
                selected = index == selected,
                onClick = { onSelect(index) },
                text = { Text(title, style = MaterialTheme.typography.labelLarge) },
                unselectedContentColor = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@EchoPreviews
@Composable
private fun SectionTabsPreview() = EchoThemesPreview {
    SectionTabs(PreviewData.tabs, selected = 0, onSelect = {})
}
