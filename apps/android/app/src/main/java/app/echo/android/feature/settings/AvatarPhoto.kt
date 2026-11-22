package app.echo.android.feature.settings

import android.content.Intent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalContext
import app.echo.designsystem.component.echo.AvatarChoice

/**
 * Opens the system photo picker for an avatar (O.6, S.12) and hands back the choice. The read permission is kept
 * across restarts where Android allows it, so the photo still shows next launch.
 */
@Composable
internal fun rememberAvatarPhotoPicker(onPicked: (AvatarChoice.Photo) -> Unit): () -> Unit {
    val context = LocalContext.current
    val launcher = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri != null) {
            runCatching {
                context.contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            onPicked(AvatarChoice.Photo(uri.toString()))
        }
    }
    return { launcher.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) }
}
