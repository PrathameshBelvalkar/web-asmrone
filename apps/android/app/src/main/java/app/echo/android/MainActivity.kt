package app.echo.android

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.lifecycleScope
import app.echo.android.navigation.Route
import app.echo.android.shell.EchoAppScaffold
import app.echo.android.shell.ShellViewModel
import app.echo.android.theme.AppTheme
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    private var start by mutableStateOf<Route?>(null)

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

        // O.1: the system splash stays until the stored theme and the start screen are known. They load here, not in
        // a composition, so the splash never waits on a frame it is itself holding back.
        splash.setKeepOnScreenCondition { start == null }
        lifecycleScope.launch {
            container.settings.theme.first()
            start = shell.startRoute()
        }

        setContent {
            val theme by container.settings.theme.collectAsStateWithLifecycle(initialValue = null)
            val currentTheme = theme ?: return@setContent
            val startRoute = start ?: return@setContent
            AppTheme(currentTheme) {
                EchoAppScaffold(shell, startRoute)
            }
        }
    }
}
