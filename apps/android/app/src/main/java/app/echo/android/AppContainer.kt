package app.echo.android

import android.content.Context
import app.echo.core.SourceId

/**
 * Builds and holds the app's long-lived objects: the shared OkHttpClient, the services, storage and the players.
 * They are added milestone by milestone (M1 onwards). Screens get what they need from here.
 */
class AppContainer(@Suppress("unused") private val context: Context) {
    val sources: List<SourceId> = SourceId.entries
}
