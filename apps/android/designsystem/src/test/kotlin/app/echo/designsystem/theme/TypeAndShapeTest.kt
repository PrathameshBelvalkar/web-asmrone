package app.echo.designsystem.theme

import androidx.compose.foundation.shape.CornerBasedShape
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.sp
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** The Compose defaults must stay equal to Figma DS · Typography (21:29305) and DS · Shape (21:28667). */
class TypeAndShapeTest {

    @Test
    fun `type scale matches Figma`() {
        val t = EchoTypography
        // size / line height / tracking, in sp
        val figma = mapOf(
            "displayLarge" to Triple(t.displayLarge, 57 to 64, -0.25),
            "displayMedium" to Triple(t.displayMedium, 45 to 52, 0.0),
            "displaySmall" to Triple(t.displaySmall, 36 to 44, 0.0),
            "headlineLarge" to Triple(t.headlineLarge, 32 to 40, 0.0),
            "headlineMedium" to Triple(t.headlineMedium, 28 to 36, 0.0),
            "headlineSmall" to Triple(t.headlineSmall, 24 to 32, 0.0),
            "titleLarge" to Triple(t.titleLarge, 22 to 28, 0.0),
            "titleMedium" to Triple(t.titleMedium, 16 to 24, 0.15),
            "titleSmall" to Triple(t.titleSmall, 14 to 20, 0.1),
            "bodyLarge" to Triple(t.bodyLarge, 16 to 24, 0.5),
            "bodyMedium" to Triple(t.bodyMedium, 14 to 20, 0.25),
            "bodySmall" to Triple(t.bodySmall, 12 to 16, 0.4),
            "labelLarge" to Triple(t.labelLarge, 14 to 20, 0.1),
            "labelMedium" to Triple(t.labelMedium, 12 to 16, 0.5),
            "labelSmall" to Triple(t.labelSmall, 11 to 16, 0.5),
        )
        figma.forEach { (name, spec) -> assertStyle(name, spec.first, spec.second.first, spec.second.second, spec.third) }
    }

    @Test
    fun `emphasized styles have the same size and a heavier weight`() {
        val t = EchoTypography
        listOf(
            "titleLarge" to (t.titleLarge to t.titleLargeEmphasized),
            "titleMedium" to (t.titleMedium to t.titleMediumEmphasized),
            "headlineSmall" to (t.headlineSmall to t.headlineSmallEmphasized),
            "bodyLarge" to (t.bodyLarge to t.bodyLargeEmphasized),
            "labelLarge" to (t.labelLarge to t.labelLargeEmphasized),
        ).forEach { (name, pair) ->
            val (base, emph) = pair
            assertEquals("$name size", base.fontSize, emph.fontSize)
            assertTrue("$name weight", emph.fontWeight!!.weight > base.fontWeight!!.weight)
        }
    }

    @Test
    fun `shape scale matches Figma`() {
        val s = EchoMaterialShapes
        mapOf(
            "extraSmall" to (s.extraSmall to 4f),
            "small" to (s.small to 8f),
            "medium" to (s.medium to 12f),
            "large" to (s.large to 16f),
            "largeIncreased" to (s.largeIncreased to 20f),
            "extraLarge" to (s.extraLarge to 28f),
            "extraLargeIncreased" to (s.extraLargeIncreased to 32f),
            "extraExtraLarge" to (s.extraExtraLarge to 48f),
        ).forEach { (name, pair) -> assertEquals(name, pair.second, pair.first.radiusDp(), 0.001f) }
    }

    private fun assertStyle(name: String, style: TextStyle, size: Int, line: Int, tracking: Double) {
        assertEquals("$name size", size.sp, style.fontSize)
        assertEquals("$name line height", line.sp, style.lineHeight)
        assertEquals("$name tracking", tracking.toFloat(), style.letterSpacing.value, 0.001f)
    }

    private fun CornerBasedShape.radiusDp(): Float = topStart.toPx(Size(1000f, 1000f), Density(1f))
}
