package app.echo.android.feature.manga.reader

import app.echo.data.model.TapZones
import app.echo.designsystem.component.echo.TapZoneKind

/**
 * What a tap at ([x], [y]) does, both as fractions of the reader (0 = left / top, 1 = right / bottom). The layouts
 * are Mihon's: every region sits on a 3 × 3 grid.
 *
 * - Default: left third back, right third forward, the middle shows the menus.
 * - L shaped: the top row and the middle-left cell back; the bottom row and the middle-right cell forward.
 * - Kindle-ish: the top row shows the menus; below it, the left third back and the rest forward.
 * - Edge: both side thirds forward, the bottom of the middle column back.
 * - Off: every tap shows the menus; pages turn by swiping only.
 *
 * [mirror] flips the layout left to right, for right-to-left reading (the left side moves forward there).
 */
internal fun tapZoneAt(zones: TapZones, x: Float, y: Float, mirror: Boolean): TapZoneKind {
    val col = third(if (mirror) 1f - x else x)
    val row = third(y)
    return when (zones) {
        TapZones.OFF -> TapZoneKind.MENU
        TapZones.DEFAULT -> when (col) {
            0 -> TapZoneKind.PREVIOUS
            2 -> TapZoneKind.NEXT
            else -> TapZoneKind.MENU
        }
        TapZones.L_SHAPED -> when {
            row == 0 -> TapZoneKind.PREVIOUS
            row == 2 -> TapZoneKind.NEXT
            col == 0 -> TapZoneKind.PREVIOUS
            col == 2 -> TapZoneKind.NEXT
            else -> TapZoneKind.MENU
        }
        TapZones.KINDLE -> when {
            row == 0 -> TapZoneKind.MENU
            col == 0 -> TapZoneKind.PREVIOUS
            else -> TapZoneKind.NEXT
        }
        TapZones.EDGE -> when {
            col != 1 -> TapZoneKind.NEXT
            row == 2 -> TapZoneKind.PREVIOUS
            else -> TapZoneKind.MENU
        }
    }
}

/** The layout as nine cells, row by row, for the hint overlay. */
internal fun tapZoneGrid(zones: TapZones, mirror: Boolean): List<TapZoneKind> =
    List(9) { i -> tapZoneAt(zones, x = (i % 3 + 0.5f) / 3f, y = (i / 3 + 0.5f) / 3f, mirror = mirror) }

private fun third(f: Float) = when {
    f < 1f / 3f -> 0
    f > 2f / 3f -> 2
    else -> 1
}
