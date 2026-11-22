package app.echo.android

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import app.echo.designsystem.theme.EchoTheme
import app.echo.core.Section
import app.echo.core.SourceId

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        val container = (application as EchoApp).container
        setContent {
            EchoTheme {
                PlaceholderScreen(container.sources)
            }
        }
    }
}

/** M0 placeholder. M1 replaces it with the Home · Search · Library scaffold. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun PlaceholderScreen(sources: List<SourceId>) {
    Scaffold(
        modifier = Modifier.fillMaxSize(),
        topBar = { TopAppBar(title = { Text("Echo") }) },
    ) { padding ->
        Column(
            modifier = Modifier.padding(padding).padding(vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Section.entries.forEach { section ->
                Text(
                    text = section.name,
                    style = MaterialTheme.typography.titleSmall,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                )
                sources.filter { it.section == section }.forEach { source ->
                    ListItem(headlineContent = { Text(source.id) })
                }
            }
        }
    }
}

@Preview(showBackground = true)
@Composable
private fun PlaceholderScreenPreview() {
    EchoTheme(dynamicColor = false) { PlaceholderScreen(SourceId.entries) }
}
