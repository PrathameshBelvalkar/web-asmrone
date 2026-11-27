package app.echo.android.ui

import android.content.Context
import android.content.Intent

/** Opens the system share sheet with [text]. */
fun Context.shareText(text: String) {
    startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text), null))
}
