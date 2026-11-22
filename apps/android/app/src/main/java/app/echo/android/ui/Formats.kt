package app.echo.android.ui

import androidx.compose.runtime.Composable
import androidx.compose.ui.res.stringResource
import app.echo.android.R
import app.echo.data.model.ContinueItem
import app.echo.data.model.Track
import java.util.Locale

/** 4:12, 1:02:05. */
fun formatDuration(ms: Long): String {
    val total = (ms / 1000).coerceAtLeast(0)
    val h = total / 3600
    val m = (total % 3600) / 60
    val s = total % 60
    return if (h > 0) String.format(Locale.ROOT, "%d:%02d:%02d", h, m, s) else String.format(Locale.ROOT, "%d:%02d", m, s)
}

/** 2h 14m, 52m (work and playlist totals). */
@Composable
fun formatTotal(ms: Long): String {
    val minutes = ms / 60_000
    return if (minutes >= 60) stringResource(R.string.format_hours_minutes, minutes / 60, minutes % 60)
    else stringResource(R.string.format_minutes, minutes)
}

/** "42 min left", "1h 10m left" (Figma 1.1 Continue listening). */
@Composable
fun formatTimeLeft(item: ContinueItem): String {
    val minutes = ((item.durationMs - item.positionMs) / 60_000).coerceAtLeast(1)
    return if (minutes >= 60) stringResource(R.string.format_left_hours, minutes / 60, minutes % 60)
    else stringResource(R.string.format_left_minutes, minutes)
}

/** "Circle Aoi · 4:12" (Figma track rows). */
fun Track.meta(): String = "$artist · ${formatDuration(durationMs)}"
