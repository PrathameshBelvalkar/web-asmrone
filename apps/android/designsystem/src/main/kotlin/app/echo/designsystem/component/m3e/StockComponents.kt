package app.echo.designsystem.component.m3e

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.material3.Checkbox
import androidx.compose.material3.ContainedLoadingIndicator
import androidx.compose.material3.ExperimentalMaterial3ExpressiveApi
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.MediumExtendedFloatingActionButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Snackbar
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.Role
import app.echo.designsystem.icon.EchoIcons
import app.echo.designsystem.preview.EchoPreviews
import app.echo.designsystem.preview.EchoThemesPreview
import app.echo.designsystem.tokens.EchoSpacing

/** One choice of a [RadioOptionList]. */
data class RadioOption(val title: String, val subtitle: String? = null)

/**
 * A radio button group (Figma "M3E · Radio button group", S.3 Music source dialog): title + optional subtitle per
 * row, the whole row selects.
 */
@Composable
fun RadioOptionList(options: List<RadioOption>, selected: Int, onSelect: (Int) -> Unit, modifier: Modifier = Modifier) {
    Column(modifier.selectableGroup()) {
        options.forEachIndexed { index, option ->
            Row(
                Modifier
                    .fillMaxWidth()
                    .selectable(selected = index == selected, onClick = { onSelect(index) }, role = Role.RadioButton)
                    .padding(vertical = EchoSpacing.s),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                RadioButton(selected = index == selected, onClick = null)
                Spacer(Modifier.width(EchoSpacing.l))
                Column {
                    Text(option.title, style = MaterialTheme.typography.titleMedium)
                    if (option.subtitle != null) {
                        Text(option.subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
        }
    }
}

/**
 * The stock M3 components Echo uses without a wrapper (design.md §8.2 rows marked "—"), shown in the Echo theme so
 * a theme change that breaks them shows up in the screenshot test: Extended FAB, contained loading indicator,
 * linear progress, snackbar, outlined text field, checkbox, radio group.
 */
@OptIn(ExperimentalMaterial3ExpressiveApi::class)
@EchoPreviews
@Composable
private fun StockComponentsPreview() = EchoThemesPreview {
    Column(Modifier.padding(horizontal = EchoSpacing.screenMargin), verticalArrangement = Arrangement.spacedBy(EchoSpacing.m)) {
        Row(horizontalArrangement = Arrangement.spacedBy(EchoSpacing.l), verticalAlignment = Alignment.CenterVertically) {
            MediumExtendedFloatingActionButton(
                onClick = {},
                icon = { Icon(painterResource(EchoIcons.Add), null) },
                text = { Text("Add tracks") },
            )
            ContainedLoadingIndicator()
            Checkbox(checked = true, onCheckedChange = {})
            Checkbox(checked = false, onCheckedChange = {})
        }
        LinearProgressIndicator(progress = { 0.6f }, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(value = "Pat", onValueChange = {}, label = { Text("Your name") }, modifier = Modifier.fillMaxWidth())
        RadioOptionList(
            listOf(RadioOption("asmr.one", "Works, tracks, subtitles"), RadioOption("Japanese ASMR", "Browse and play")),
            selected = 0, onSelect = {},
        )
        Snackbar(action = { TextButton(onClick = {}) { Text("Show") } }) { Text("3 new titles") }
    }
}
