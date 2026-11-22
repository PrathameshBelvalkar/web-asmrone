package app.echo.designsystem.component.m3e

import androidx.annotation.DrawableRes
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material3.AssistChip
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.InputChip
import androidx.compose.material3.SuggestionChip
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import app.echo.designsystem.icon.EchoIcons
import app.echo.designsystem.preview.EchoPreviews
import app.echo.designsystem.preview.EchoThemesPreview
import app.echo.designsystem.tokens.EchoSizes
import app.echo.designsystem.tokens.EchoSpacing

/** Figma "Chips (Filter / Assist / Input / Suggestion)". */
enum class ChipStyle { Filter, Assist, Input, Suggestion }

/** One chip of a [ChipRow]. */
data class ChipSpec(val label: String, @DrawableRes val icon: Int? = null)

/**
 * A horizontally scrolling row of chips with the screen margins, 8 dp apart (Figma "M3E · Chips", 29 screens).
 * Filter chips show a check when selected; [selected] holds the selected indexes (single- or multi-select is the
 * caller's choice).
 */
@Composable
fun ChipRow(
    chips: List<ChipSpec>,
    onClick: (Int) -> Unit,
    modifier: Modifier = Modifier,
    style: ChipStyle = ChipStyle.Filter,
    selected: Set<Int> = emptySet(),
) {
    LazyRow(
        modifier = modifier,
        contentPadding = PaddingValues(horizontal = EchoSpacing.screenMargin),
        horizontalArrangement = Arrangement.spacedBy(EchoSpacing.chipGap),
    ) {
        itemsIndexed(chips) { index, chip ->
            val icon: (@Composable () -> Unit)? = chip.icon?.let {
                { Icon(painterResource(it), contentDescription = null, modifier = Modifier.size(EchoSizes.iconSmall)) }
            }
            val label: @Composable () -> Unit = { Text(chip.label) }
            val isSelected = index in selected
            when (style) {
                ChipStyle.Filter -> FilterChip(
                    selected = isSelected,
                    onClick = { onClick(index) },
                    label = label,
                    leadingIcon = if (isSelected) {
                        { Icon(painterResource(EchoIcons.Check), null, Modifier.size(EchoSizes.iconSmall)) }
                    } else {
                        icon
                    },
                )
                ChipStyle.Assist -> AssistChip(onClick = { onClick(index) }, label = label, leadingIcon = icon)
                ChipStyle.Input -> InputChip(
                    selected = isSelected,
                    onClick = { onClick(index) },
                    label = label,
                    leadingIcon = icon,
                    trailingIcon = { Icon(painterResource(EchoIcons.Close), null, Modifier.size(EchoSizes.iconSmall)) },
                )
                ChipStyle.Suggestion -> SuggestionChip(onClick = { onClick(index) }, label = label, icon = icon)
            }
        }
    }
}

@EchoPreviews
@Composable
private fun ChipRowPreview() = EchoThemesPreview {
    ChipRow(
        listOf(
            ChipSpec("All"), ChipSpec("Listening", EchoIcons.MusicNote), ChipSpec("Reading", EchoIcons.Book),
            ChipSpec("Watching", EchoIcons.Movie),
        ),
        onClick = {},
        selected = setOf(0),
    )
    ChipRow(listOf(ChipSpec("Binaural", EchoIcons.Tune), ChipSpec("Rain", EchoIcons.Tune)), onClick = {}, style = ChipStyle.Assist)
    ChipRow(listOf(ChipSpec("Aoi Mizuno"), ChipSpec("Hana Seto")), onClick = {}, style = ChipStyle.Input)
}
