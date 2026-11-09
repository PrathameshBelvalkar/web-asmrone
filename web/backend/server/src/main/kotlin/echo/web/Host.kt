package echo.web

import dev.brahmkshatriya.echo.extension.AsmrOne
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File

/**
 * Hosts the single asmr.one extension instance. Startup order mirrors the Android app
 * (settings, initialize, select, then login user). All extension calls go through [io].
 */
object Host {
    val dataDir: File = File(System.getenv("ECHO_WEB_DATA") ?: File(System.getProperty("user.home"), ".echo-web").path)
    val settings = JsonSettings(File(dataDir, "settings.json"))
    val users = UserStore(File(dataDir, "user.json"))
    val ext = AsmrOne()

    suspend fun init() {
        ext.setSettings(settings)
        ext.onInitialize()
        ext.onExtensionSelected()
        ext.setLoginUser(users.load())
    }

    suspend fun <T> io(block: suspend AsmrOne.() -> T): T = withContext(Dispatchers.IO) { ext.block() }
}
