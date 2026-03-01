package com.guideme.ramadan

import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.activity.OnBackPressedCallback
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsControllerCompat

class MainActivity : TauriActivity() {

  private var webViewRef: WebView? = null

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    // Edge-to-edge without enableEdgeToEdge() — avoids its listener
    // that continuously overrides our status bar icon colors
    WindowCompat.setDecorFitsSystemWindows(window, false)
    window.statusBarColor = android.graphics.Color.TRANSPARENT
    window.navigationBarColor = android.graphics.Color.TRANSPARENT

    // Default: dark app theme → light status bar icons
    setStatusBarAppearance(false)

    // Inject JS bridge AFTER view hierarchy is fully built
    // (Tauri creates the WebView during super.onCreate but adds it async)
    window.decorView.post {
      webViewRef = findWebView(window.decorView)
      webViewRef?.addJavascriptInterface(StatusBarBridge(this), "AndroidStatusBar")
    }

    // Handle Android back button — dispatch custom event to WebView
    onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
      override fun handleOnBackPressed() {
        webViewRef?.evaluateJavascript(
          """
          (function() {
            var e = new CustomEvent('backbutton', { cancelable: true });
            var handled = !document.dispatchEvent(e);
            return handled ? 'handled' : 'default';
          })()
          """.trimIndent()
        ) { result ->
          // If JS didn't handle it (preventDefault), let OS handle (minimize)
          if (result?.contains("default") == true) {
            isEnabled = false
            onBackPressedDispatcher.onBackPressed()
            isEnabled = true
          }
        }
      }
    })
  }

  fun setStatusBarAppearance(lightIcons: Boolean) {
    val controller = WindowInsetsControllerCompat(window, window.decorView)
    // true → dark icons on light background
    // false → light icons on dark background
    controller.isAppearanceLightStatusBars = lightIcons
  }

  /** Recursively find the first WebView in the view hierarchy. */
  private fun findWebView(view: android.view.View): WebView? {
    if (view is WebView) return view
    if (view is android.view.ViewGroup) {
      for (i in 0 until view.childCount) {
        val found = findWebView(view.getChildAt(i))
        if (found != null) return found
      }
    }
    return null
  }
}

/**
 * JS bridge: window.AndroidStatusBar.setTheme("light"|"dark")
 * Updates status bar icon colors to match the in-app theme.
 */
class StatusBarBridge(private val activity: MainActivity) {
  @JavascriptInterface
  fun setTheme(theme: String) {
    activity.runOnUiThread {
      activity.setStatusBarAppearance(theme == "light")
    }
  }
}
