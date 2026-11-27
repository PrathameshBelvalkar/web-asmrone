package app.echo.android.feature.jav.genres

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.AssistChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.tooling.preview.PreviewParameter
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.echo.android.R
import app.echo.android.feature.jav.JavHeader
import app.echo.android.feature.jav.JavTab
import app.echo.android.feature.manga.LoadFallback
import app.echo.android.navigation.Route
import app.echo.android.navigation.ShellActions
import app.echo.android.ui.echoViewModel
import app.echo.data.fake.FakeCatalog
import app.echo.data.model.GenreGroup
import app.echo.data.model.Source
import app.echo.data.repository.JavRepository
import app.echo.data.repository.Load
import app.echo.designsystem.icon.EchoIcons
import app.echo.designsystem.preview.EchoPreviewTheme
import app.echo.designsystem.preview.EchoPreviewThemes
import app.echo.designsystem.preview.EchoScreenPreviews
import app.echo.designsystem.theme.EchoTheme
import app.echo.designsystem.tokens.EchoSpacing
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn

class JavGenresViewModel(jav: JavRepository) : ViewModel() {
    val groups: StateFlow<Load<List<GenreGroup>>> =
        jav.genreGroups().stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), Load.Loading)
}

@Composable
fun JavGenresRoute(shell: ShellActions, source: Source, contentPadding: PaddingValues) {
    val vm = echoViewModel { JavGenresViewModel(it.jav) }
    val groups by vm.groups.collectAsStateWithLifecycle()
    JavGenresScreen(
        groups = groups,
        header = { JavHeader(JavTab.GENRES, shell, source) },
        contentPadding = contentPadding,
        onGenre = { shell.open(Route.MovieList(it)) },
    )
}

/** Figma 3.10 Genres (28:4349): one outlined card per group, its genres as chips → 3.5. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun JavGenresScreen(
    groups: Load<List<GenreGroup>>,
    header: @Composable () -> Unit,
    contentPadding: PaddingValues,
    onGenre: (String) -> Unit,
) {
    Column(Modifier.fillMaxSize().testTag("screen:3.10")) {
        header()
        if (groups !is Load.Content) {
            LoadFallback(groups, onRetry = {})
            return@Column
        }
        LazyColumn(
            Modifier.weight(1f),
            contentPadding = PaddingValues(
                start = EchoSpacing.screenMargin, end = EchoSpacing.screenMargin, top = EchoSpacing.m,
                bottom = contentPadding.calculateBottomPadding() + EchoSpacing.l,
            ),
            verticalArrangement = Arrangement.spacedBy(EchoSpacing.m),
        ) {
            items(groups.value, key = { it.name }) { group ->
                OutlinedCard(Modifier.fillMaxWidth(), shape = MaterialTheme.shapes.extraLarge) {
                    Column(Modifier.padding(horizontal = EchoSpacing.m, vertical = EchoSpacing.m)) {
                        Row(Modifier.fillMaxWidth().padding(horizontal = EchoSpacing.xs), verticalAlignment = Alignment.CenterVertically) {
                            Text(group.name, style = MaterialTheme.typography.titleMediumEmphasized, modifier = Modifier.weight(1f))
                            Text(
                                stringResource(R.string.jav_genre_count, group.genres.size),
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                        FlowRow(horizontalArrangement = Arrangement.spacedBy(EchoSpacing.s)) {
                            group.genres.forEach { genre -> AssistChip(onClick = { onGenre(genre.id) }, label = { Text(genre.name) }) }
                        }
                    }
                }
            }
        }
    }
}

@EchoScreenPreviews
@Composable
private fun JavGenresScreenPreview(@PreviewParameter(EchoPreviewThemes::class) theme: EchoPreviewTheme) = EchoTheme(theme.config) {
    Surface {
        JavGenresScreen(
            groups = Load.Content(FakeCatalog.genreGroups),
            header = { JavHeader(JavTab.GENRES, "javdatabase", EchoIcons.Movie, "P", {}, {}, {}, {}) },
            contentPadding = PaddingValues(), onGenre = {},
        )
    }
}
