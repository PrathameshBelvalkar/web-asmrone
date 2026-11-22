package app.echo.designsystem.tokens

import androidx.compose.ui.unit.dp

/**
 * Figma DS · Spacing (21:28756). Everything sits on a 4 dp grid. Use these, never raw dp, in screen code.
 * Scale steps first, then the named uses from the Figma table.
 */
object EchoSpacing {
    val none = 0.dp
    val xxs = 2.dp
    val xs = 4.dp
    val s = 8.dp
    val m = 12.dp
    val l = 16.dp
    val xl = 20.dp
    val xxl = 24.dp
    val xxxl = 32.dp

    /** Segmented list items, connected buttons. */
    val segmentedGap = xxs
    /** Icon ↔ label in nav items. */
    val iconLabelGap = xs
    /** Chips, button groups, a stack of text lines. */
    val chipGap = s
    /** Cover rows; list item icon ↔ text. */
    val coverRowGap = m
    /** Compact screen side margin; list item and card padding. */
    val screenMargin = l
    /** Large card padding, bottom sheet side padding. */
    val sheetPadding = xl
    /** Section and dialog padding. */
    val sectionPadding = xxl
    /** Gap between shelves on big screens. */
    val shelfGapLarge = xxxl
    /** The mini player sits this far above the navigation bar. */
    val miniPlayerAboveNavBar = s
}
