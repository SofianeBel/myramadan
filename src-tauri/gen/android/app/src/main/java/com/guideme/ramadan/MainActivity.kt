package com.guideme.ramadan

import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsControllerCompat

class MainActivity : TauriActivity() {

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
      val webView = findWebView(window.decorView)
      webView?.addJavascriptInterface(StatusBarBridge(this), "AndroidStatusBar")
    }
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
