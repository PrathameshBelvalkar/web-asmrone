package app.echo.android.debug

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.echo.android.EchoApp
import app.echo.android.theme.toThemeConfig
import app.echo.android.theme.with
import kotlinx.coroutines.launch

/**
 * Debug-only entry to [DesignSystemScreen]. Its theme controls read and write the stored settings, so they are the
 * same as the app's. Later also opened by a long-press on the version in S.11.
 */
class DesignSystemActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        val settings = (application as EchoApp).container.settings
        setContent {
            val theme by settings.theme.collectAsStateWithLifecycle(initialValue = null)
            val current = theme ?: return@setContent
            val scope = rememberCoroutineScope()
            DesignSystemScreen(
                config = current.toThemeConfig(),
                onConfig = { config -> scope.launch { settings.updateTheme { with(config) } } },
            )
        }
    }
}
