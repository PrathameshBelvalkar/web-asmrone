package app.echo.android

import kotlinx.coroutines.delay
import app.echo.android.feature.onboarding.SplashScreen
import androidx.compose.ui.Modifier
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.Box
import androidx.compose.animation.fadeOut
import androidx.compose.animation.core.tween
import androidx.compose.animation.EnterTransition
import androidx.compose.animation.AnimatedVisibility
import android.provider.Settings
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

        // On a cold start after onboarding, the animated O.1 mark plays over Home for a moment, then fades out. Not on
        // a recreation (rotation, coming back), and not when the system's animations are off.
        val animationsOn = Settings.Global.getFloat(contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) > 0f
        val coldStart = savedInstanceState == null

        setContent {
            val theme by container.settings.theme.collectAsStateWithLifecycle(initialValue = null)
            val currentTheme = theme ?: return@setContent
            val startRoute = start ?: return@setContent
            var intro by rememberSaveable { mutableStateOf(coldStart && animationsOn && startRoute != Route.Splash) }
            if (intro) {
                LaunchedEffect(Unit) {
                    delay(INTRO_MS)
                    intro = false
                }
            }
            AppTheme(currentTheme) {
                Box(Modifier.fillMaxSize()) {
                    EchoAppScaffold(shell, startRoute)
                    AnimatedVisibility(intro, enter = EnterTransition.None, exit = fadeOut(tween(INTRO_FADE_MS))) {
                        SplashScreen()
                    }
                }
            }
        }
    }
}

/** How long the animated mark plays over Home on a cold start, and its fade out. */
private const val INTRO_MS = 1_100L
private const val INTRO_FADE_MS = 300
