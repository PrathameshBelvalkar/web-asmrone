package app.echo.designsystem.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

/*
 * Figma DS · Typography (21:29305), read from the specimen text layers: Roboto (the system default, no custom
 * font), size / line height / tracking / weight exactly as below. The Compose defaults differ slightly
 * (displayLarge −0.2, titleMedium 0.2 tracking) and their emphasized styles keep the baseline weight, so every
 * style is written out.
 *
 * Emphasized = same size, Bold (Figma "Emphasized · Title Large" is Roboto Bold). Use for selected list items,
 * the current lyric line, primary buttons, the Extended FAB, new or unread items and the full player title.
 *
 * Japanese text uses the system's Noto Sans JP fallback, one step smaller than the line above it.
 */

private fun style(size: Int, line: Int, tracking: Double, weight: FontWeight) = TextStyle(
    fontFamily = FontFamily.Default,
    fontWeight = weight,
    fontSize = size.sp,
    lineHeight = line.sp,
    letterSpacing = tracking.sp,
)

private val Regular = FontWeight.Normal
private val Medium = FontWeight.Medium
private val Emphasized = FontWeight.Bold

private val displayLarge = style(57, 64, -0.25, Regular)
private val displayMedium = style(45, 52, 0.0, Regular)
private val displaySmall = style(36, 44, 0.0, Regular)
private val headlineLarge = style(32, 40, 0.0, Regular)
private val headlineMedium = style(28, 36, 0.0, Regular)
private val headlineSmall = style(24, 32, 0.0, Regular)
private val titleLarge = style(22, 28, 0.0, Regular)
private val titleMedium = style(16, 24, 0.15, Medium)
private val titleSmall = style(14, 20, 0.1, Medium)
private val bodyLarge = style(16, 24, 0.5, Regular)
private val bodyMedium = style(14, 20, 0.25, Regular)
private val bodySmall = style(12, 16, 0.4, Regular)
private val labelLarge = style(14, 20, 0.1, Medium)
private val labelMedium = style(12, 16, 0.5, Medium)
private val labelSmall = style(11, 16, 0.5, Medium)

private fun TextStyle.emphasized() = copy(fontWeight = Emphasized)

val EchoTypography: Typography = Typography(
    displayLarge = displayLarge,
    displayMedium = displayMedium,
    displaySmall = displaySmall,
    headlineLarge = headlineLarge,
    headlineMedium = headlineMedium,
    headlineSmall = headlineSmall,
    titleLarge = titleLarge,
    titleMedium = titleMedium,
    titleSmall = titleSmall,
    bodyLarge = bodyLarge,
    bodyMedium = bodyMedium,
    bodySmall = bodySmall,
    labelLarge = labelLarge,
    labelMedium = labelMedium,
    labelSmall = labelSmall,
    displayLargeEmphasized = displayLarge.emphasized(),
    displayMediumEmphasized = displayMedium.emphasized(),
    displaySmallEmphasized = displaySmall.emphasized(),
    headlineLargeEmphasized = headlineLarge.emphasized(),
    headlineMediumEmphasized = headlineMedium.emphasized(),
    headlineSmallEmphasized = headlineSmall.emphasized(),
    titleLargeEmphasized = titleLarge.emphasized(),
    titleMediumEmphasized = titleMedium.emphasized(),
    titleSmallEmphasized = titleSmall.emphasized(),
    bodyLargeEmphasized = bodyLarge.emphasized(),
    bodyMediumEmphasized = bodyMedium.emphasized(),
    bodySmallEmphasized = bodySmall.emphasized(),
    labelLargeEmphasized = labelLarge.emphasized(),
    labelMediumEmphasized = labelMedium.emphasized(),
    labelSmallEmphasized = labelSmall.emphasized(),
)
