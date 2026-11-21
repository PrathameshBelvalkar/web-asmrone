package app.echo.android

import android.app.Application
import timber.log.Timber

class EchoApp : Application() {
    /** Hand-made DI, like the server's container.ts. */
    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        if (BuildConfig.DEBUG) Timber.plant(Timber.DebugTree())
        container = AppContainer(this)
    }
}
