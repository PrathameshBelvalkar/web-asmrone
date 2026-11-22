package app.echo.designsystem.component.m3e

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.ImeAction
import app.echo.designsystem.R
import app.echo.designsystem.icon.EchoIcons
import app.echo.designsystem.preview.EchoPreviews
import app.echo.designsystem.preview.EchoThemesPreview
import app.echo.designsystem.theme.EchoShapes
import app.echo.designsystem.tokens.EchoSizes
import app.echo.designsystem.tokens.EchoSpacing

/**
 * The focused search field of a search screen (Figma "M3E · Search (Search view, full-screen)", 1.2 / 2.2 / 3.11 /
 * H.6): back arrow, query, clear. 56 dp pill on surfaceContainerHighest with the screen margins.
 * The screen below it shows suggestions or results.
 */
@Composable
fun EchoSearchField(
    query: String,
    onQueryChange: (String) -> Unit,
    onSearch: (String) -> Unit,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
    placeholder: String = stringResource(R.string.echo_search_placeholder),
    focusRequester: FocusRequester = FocusRequester(),
) {
    Surface(
        modifier = modifier.fillMaxWidth().padding(horizontal = EchoSpacing.screenMargin, vertical = EchoSpacing.s)
            .height(EchoSizes.searchBarHeight),
        shape = EchoShapes.Full,
        color = MaterialTheme.colorScheme.surfaceContainerHighest,
    ) {
        Row(
            Modifier.padding(horizontal = EchoSpacing.xs),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            BackButton(onBack)
            QueryText(query, onQueryChange, onSearch, placeholder, MaterialTheme.typography.bodyLarge, Modifier.weight(1f).focusRequester(focusRequester))
            if (query.isNotEmpty()) {
                EchoIconButton(EchoIcons.Close, stringResource(R.string.echo_cd_clear), { onQueryChange("") })
            }
        }
    }
}

/**
 * A small in-page search bar (Figma "M3E · Search (Search bar, small)", 2.3 Tags / 2.11 Artists): 40 dp pill that
 * filters the list on the same screen.
 */
@Composable
fun InlineSearchBar(
    query: String,
    onQueryChange: (String) -> Unit,
    placeholder: String,
    modifier: Modifier = Modifier,
) {
    Surface(
        modifier = modifier.height(EchoSizes.Button.s),
        shape = EchoShapes.Full,
        color = MaterialTheme.colorScheme.surfaceContainerHighest,
    ) {
        Row(
            Modifier.padding(horizontal = EchoSpacing.m),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(EchoSpacing.s),
        ) {
            Icon(
                painterResource(EchoIcons.Search), contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(EchoSizes.iconSmall),
            )
            QueryText(query, onQueryChange, {}, placeholder, MaterialTheme.typography.bodyMedium, Modifier.weight(1f))
        }
    }
}

@Composable
private fun QueryText(
    query: String,
    onQueryChange: (String) -> Unit,
    onSearch: (String) -> Unit,
    placeholder: String,
    style: androidx.compose.ui.text.TextStyle,
    modifier: Modifier,
) {
    Box(modifier, contentAlignment = Alignment.CenterStart) {
        if (query.isEmpty()) {
            Text(placeholder, style = style, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1)
        }
        BasicTextField(
            value = query,
            onValueChange = onQueryChange,
            singleLine = true,
            textStyle = style.copy(color = MaterialTheme.colorScheme.onSurface),
            cursorBrush = SolidColor(MaterialTheme.colorScheme.primary),
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
            keyboardActions = KeyboardActions(onSearch = { onSearch(query) }),
            modifier = Modifier.fillMaxWidth(),
        )
    }
}

@EchoPreviews
@Composable
private fun SearchFieldsPreview() = EchoThemesPreview {
    EchoSearchField("rain", {}, {}, {})
    EchoSearchField("", {}, {}, {})
    InlineSearchBar("", {}, "Search tags", Modifier.padding(horizontal = EchoSpacing.screenMargin))
}
