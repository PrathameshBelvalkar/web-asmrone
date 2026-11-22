package app.echo.designsystem.theme

import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Shapes
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.unit.dp

/**
 * Figma DS · Shape (21:28667): the 10-step M3 Expressive corner scale.
 * Read from `MaterialTheme.shapes`; [EchoShapes] adds `none` and `full`.
 */
val EchoMaterialShapes: Shapes = Shapes(
    extraSmall = RoundedCornerShape(4.dp), // text field top corners, segmented list inner corners
    small = RoundedCornerShape(8.dp), // chips, small thumbnails, menu items
    medium = RoundedCornerShape(12.dp), // square icon buttons at rest, connected group inner corners
    large = RoundedCornerShape(16.dp), // cover art in grids and shelves, FAB, pressed square buttons
    largeIncreased = RoundedCornerShape(20.dp), // segmented list outer corners
    extraLarge = RoundedCornerShape(28.dp), // cards, mini player, floating toolbar, search bar, sheets, dialogs
    extraLargeIncreased = RoundedCornerShape(32.dp), // hero carousel items, full player cover
    extraExtraLarge = RoundedCornerShape(48.dp), // end-of-gallery cover, onboarding art
)

object EchoShapes {
    val None = RectangleShape
    /** Buttons, icon buttons, selected chips, nav active indicator, badges. */
    val Full = CircleShape
}
