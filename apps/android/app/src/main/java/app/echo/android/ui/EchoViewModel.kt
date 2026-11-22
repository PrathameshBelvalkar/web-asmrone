package app.echo.android.ui

import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import app.echo.android.AppContainer
import app.echo.android.EchoApp

/** A screen's ViewModel, built from the [AppContainer] (hand-made DI, design.md §5.4). */
@Composable
inline fun <reified VM : ViewModel> echoViewModel(key: String? = null, crossinline create: (AppContainer) -> VM): VM {
    val container = (LocalContext.current.applicationContext as EchoApp).container
    return viewModel(key = key, factory = viewModelFactory { initializer { create(container) } })
}
