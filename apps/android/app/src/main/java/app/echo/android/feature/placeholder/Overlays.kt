package app.echo.android.feature.placeholder

/** An overlay frame from Figma (a sheet, dialog, page or state on top of a routed screen). */
data class OverlaySpec(val code: String, val name: String, val kind: OverlayKind)

enum class OverlayKind { SHEET, DIALOG, PAGE }

/** Overlays reachable from each routed frame's placeholder (design.md §10.3), keyed by the frame code. */
object Overlays {
    val byScreen: Map<String, List<OverlaySpec>> = mapOf(
        "2.6" to listOf(
            OverlaySpec("2.7", "Reader · immersive (menus hidden)", OverlayKind.PAGE),
            OverlaySpec("2.8", "Reader settings", OverlayKind.SHEET),
            OverlaySpec("2.9", "Pages sheet", OverlayKind.SHEET),
        ),
        "3.8" to listOf(OverlaySpec("3.8", "Idols filter sheet", OverlayKind.SHEET)),
        "H.3" to listOf(OverlaySpec("H.4", "Filters sheet", OverlayKind.SHEET)),
        "H.7" to listOf(OverlaySpec("H.8", "Preview viewer", OverlayKind.DIALOG)),
        "1.1" to listOf(OverlaySpec("O.9", "First-run tip", OverlayKind.DIALOG)),
    )
}
