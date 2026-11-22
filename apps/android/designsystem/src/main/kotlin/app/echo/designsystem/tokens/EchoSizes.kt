package app.echo.designsystem.tokens

import androidx.compose.ui.unit.dp

/** Figma DS · Components (21:28847) and the phone layout in DS · Spacing. */
object EchoSizes {
    /** Buttons, icon buttons, toggle, split buttons and button groups share these five heights. */
    object Button {
        val xs = 32.dp // inline actions
        val s = 40.dp // default: lists, toolbars
        val m = 56.dp // media page Play / Shuffle
        val l = 96.dp // full player play/pause
        val xl = 136.dp // hero moments
    }

    val minTouchTarget = 48.dp

    val chipHeight = 32.dp
    val textFieldHeight = 56.dp
    val searchBarHeight = 56.dp

    val listItemOneLine = 56.dp
    val listItemTwoLine = 72.dp
    val listItemThreeLine = 88.dp

    val navigationBarHeight = 64.dp
    val navIndicatorWidth = 56.dp
    val navIndicatorHeight = 32.dp

    val fab = 56.dp

    val icon = 24.dp
    /** Icons inside chips and S buttons. */
    val iconSmall = 20.dp

    val avatarAppBar = 40.dp
    val avatarArtist = 96.dp
    /** Echo profile avatar: 36 dp image + 2 dp ring, in a 48 dp touch target. */
    val profileAvatar = 36.dp
    val profileAvatarRing = 2.dp

    val sliderHandle = 44.dp
    val sliderTrackXs = 16.dp

    val sheetDragHandleWidth = 32.dp
    val sheetDragHandleHeight = 4.dp
    const val SCRIM_ALPHA = 0.32f

    val appBarSmall = 64.dp
    val appBarMediumFlexible = 112.dp
    val appBarLargeFlexible = 152.dp
}
