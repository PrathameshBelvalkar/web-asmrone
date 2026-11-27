package app.echo.designsystem.component.m3e

import app.echo.designsystem.component.echo.sharedCover
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.background
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.carousel.CarouselItemScope
import androidx.compose.material3.carousel.HorizontalCenteredHeroCarousel
import androidx.compose.material3.carousel.HorizontalMultiBrowseCarousel
import androidx.compose.material3.carousel.rememberCarouselState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.layout
import kotlin.math.roundToInt
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import app.echo.designsystem.component.echo.ContinueCard
import app.echo.designsystem.component.echo.CoverImage
import app.echo.designsystem.preview.EchoPreviews
import app.echo.designsystem.preview.EchoThemesPreview
import app.echo.designsystem.preview.PreviewData
import app.echo.designsystem.tokens.EchoSpacing

/** Figma "Carousel (Multi-browse)" and "Carousel (Hero)". */
enum class CarouselStyle { MultiBrowse, Hero }

/**
 * M3 carousel with Echo's spacing (Figma "M3E · Carousel (Multi-browse)" 8 screens, "(Hero)" 4). Items are
 * masked to the extraLargeIncreased shape by [HeroCarouselItem] and shrink as they scroll off.
 * For a plain row of cards (Figma "Carousel (Uncontained)") use [CoverRow].
 */
@Composable
fun CoverCarousel(
    count: Int,
    modifier: Modifier = Modifier,
    style: CarouselStyle = CarouselStyle.MultiBrowse,
    height: Dp = HeroItemHeight,
    initialItem: Int = 0,
    itemContent: @Composable CarouselItemScope.(index: Int) -> Unit,
) {
    val state = rememberCarouselState(initialItem) { count }
    val padding = PaddingValues(horizontal = EchoSpacing.screenMargin)
    val sized = modifier.fillMaxWidth().height(height)
    when (style) {
        CarouselStyle.MultiBrowse -> HorizontalMultiBrowseCarousel(
            state = state, preferredItemWidth = HeroItemWidth, modifier = sized,
            itemSpacing = EchoSpacing.s, contentPadding = padding, content = itemContent,
        )
        CarouselStyle.Hero -> HorizontalCenteredHeroCarousel(
            state = state, modifier = sized, itemSpacing = EchoSpacing.s, contentPadding = padding, content = itemContent,
        )
    }
}

/**
 * A horizontally scrolling row of cards with the screen margins, 12 dp apart (Figma "M3E · Carousel
 * (Uncontained)", 20 screens), e.g. "Continue listening". A LazyRow rather than the M3 uncontained carousel,
 * which masks each item and would clip the card text.
 */
@Composable
fun CoverRow(
    count: Int,
    modifier: Modifier = Modifier,
    itemContent: @Composable (index: Int) -> Unit,
) {
    LazyRow(
        modifier = modifier.fillMaxWidth(),
        contentPadding = PaddingValues(horizontal = EchoSpacing.screenMargin),
        horizontalArrangement = Arrangement.spacedBy(EchoSpacing.coverRowGap),
    ) {
        items(count) { index -> itemContent(index) }
    }
}

private val TitleFadeStart = 64.dp
private val TitleFadeLength = 40.dp

/** Figma 1.1: big multi-browse item 236 × 220 dp. */
private val HeroItemWidth = 236.dp
private val HeroItemHeight = 220.dp
/** Figma 1.1 "Continue listening": 140 dp covers. */
val UncontainedItemWidth = 140.dp

/**
 * A multi-browse / hero carousel item: cover masked to extraLargeIncreased, title on a scrim at the bottom.
 * The title fades out as the item shrinks.
 */
@Composable
fun CarouselItemScope.HeroCarouselItem(
    title: String,
    image: Any?,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    /** Shared-element key: the cover moves into the page that opens. */
    sharedKey: String? = null,
) {
    Box(
        modifier
            .then(sharedCover(sharedKey))
            .fillMaxSize()
            .maskClip(MaterialTheme.shapes.extraLargeIncreased),
    ) {
        CoverImage(image, contentDescription = title, onClick = onClick, modifier = Modifier.fillMaxSize(), shape = null)
        if (title.isBlank()) return@Box
        val info = carouselItemDrawInfo
        Box(
            Modifier
                .align(Alignment.BottomStart)
                // The item is laid out at full width and masked: keep the title inside the visible mask.
                .layout { measurable, constraints ->
                    val mask = info.maskRect
                    val width = mask.width.roundToInt().coerceIn(0, constraints.maxWidth)
                    val placeable = measurable.measure(constraints.copy(minWidth = width, maxWidth = width))
                    layout(constraints.maxWidth, placeable.height) { placeable.place(mask.left.roundToInt(), 0) }
                }
                .background(Brush.verticalGradient(listOf(Color.Transparent, MaterialTheme.colorScheme.scrim.copy(alpha = 0.6f))))
                // Fully visible from Figma's medium item (116 dp) up; fades out on the small peeking ones.
                .graphicsLayer { alpha = ((info.size - TitleFadeStart.toPx()) / TitleFadeLength.toPx()).coerceIn(0f, 1f) }
                .padding(EchoSpacing.l),
        ) {
            Text(title, style = MaterialTheme.typography.titleMediumEmphasized, color = Color.White, maxLines = 2)
        }
    }
}

@EchoPreviews
@Composable
private fun CoverCarouselPreview() = EchoThemesPreview {
    CoverCarousel(PreviewData.heroTitles.size) { i ->
        HeroCarouselItem(PreviewData.heroTitles[i], image = null, onClick = {})
    }
    CoverRow(PreviewData.continueItems.size) { i ->
        val (title, meta, progress) = PreviewData.continueItems[i]
        ContinueCard(title, meta, progress, image = null, onClick = {})
    }
}
