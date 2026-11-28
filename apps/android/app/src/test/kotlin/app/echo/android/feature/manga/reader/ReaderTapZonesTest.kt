package app.echo.android.feature.manga.reader

import app.echo.data.model.TapZones
import app.echo.designsystem.component.echo.TapZoneKind.MENU
import app.echo.designsystem.component.echo.TapZoneKind.NEXT
import app.echo.designsystem.component.echo.TapZoneKind.PREVIOUS
import org.junit.Assert.assertEquals
import org.junit.Test

class ReaderTapZonesTest {
    private fun grid(zones: TapZones, mirror: Boolean = false) = tapZoneGrid(zones, mirror)

    @Test fun defaultIsLeftBackRightForward() = assertEquals(
        listOf(PREVIOUS, MENU, NEXT, PREVIOUS, MENU, NEXT, PREVIOUS, MENU, NEXT),
        grid(TapZones.DEFAULT),
    )

    @Test fun rightToLeftMirrorsTheZones() = assertEquals(
        listOf(NEXT, MENU, PREVIOUS, NEXT, MENU, PREVIOUS, NEXT, MENU, PREVIOUS),
        grid(TapZones.DEFAULT, mirror = true),
    )

    @Test fun lShaped() = assertEquals(
        listOf(PREVIOUS, PREVIOUS, PREVIOUS, PREVIOUS, MENU, NEXT, NEXT, NEXT, NEXT),
        grid(TapZones.L_SHAPED),
    )

    @Test fun kindle() = assertEquals(
        listOf(MENU, MENU, MENU, PREVIOUS, NEXT, NEXT, PREVIOUS, NEXT, NEXT),
        grid(TapZones.KINDLE),
    )

    @Test fun edge() = assertEquals(
        listOf(NEXT, MENU, NEXT, NEXT, MENU, NEXT, NEXT, PREVIOUS, NEXT),
        grid(TapZones.EDGE),
    )

    @Test fun offOnlyShowsTheMenus() = assertEquals(List(9) { MENU }, grid(TapZones.OFF))

    @Test fun edgesOfTheScreenBelongToTheOuterThirds() {
        assertEquals(PREVIOUS, tapZoneAt(TapZones.DEFAULT, 0f, 0.5f, mirror = false))
        assertEquals(NEXT, tapZoneAt(TapZones.DEFAULT, 1f, 0.5f, mirror = false))
        assertEquals(MENU,tapZoneAt(TapZones.DEFAULT, 0.5f, 0.5f, mirror = false))
    }
}
