package app.echo.data.prefs

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.preferencesDataStore

/** The two DataStores, one file each, created once per process. */
private val Context.settingsStore: DataStore<Preferences> by preferencesDataStore(name = "settings")
private val Context.profileStore: DataStore<Preferences> by preferencesDataStore(name = "profile")

object EchoDataStores {
    fun settings(context: Context): DataStore<Preferences> = context.applicationContext.settingsStore
    fun profile(context: Context): DataStore<Preferences> = context.applicationContext.profileStore
}
