package app.echo.android

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.echo.android.navigation.Route
import app.echo.android.shell.EchoAppScaffold
import app.echo.android.shell.ShellViewModel
import app.echo.android.theme.AppTheme

class MainActivity : ComponentActivity() {
    @Volatile private var ready = false

    private val shell: ShellViewModel by viewModels {
        object : ViewModelProvider.Factory {
            @Suppress("UNCHECKED_CAST")
            override fun <T : ViewModel> create(modelClass: Class<T>): T = ShellViewModel((application as EchoApp).container) as T
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        val splash = installSplashScreen()
        super.onCreate(savedInstanceState)
        val container = (application as EchoApp).container

        // O.1: the system splash stays until the stored theme and the start screen are known and drawn.
        splash.setKeepOnScreenCondition { !ready }

        setContent {
            val theme by container.settings.theme.collectAsStateWithLifecycle(initialValue = null)
            val start by produceState<Route?>(null) { value = shell.startRoute() }
            val currentTheme = theme ?: return@setContent
            val startRoute = start ?: return@setContent
            SideEffect { ready = true }
            AppTheme(currentTheme) {
                EchoAppScaffold(shell, startRoute)
            }
        }
    }
}
