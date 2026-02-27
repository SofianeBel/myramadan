package com.guideme.ramadan

import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge
import androidx.core.view.WindowInsetsControllerCompat

class MainActivity : TauriActivity() {

  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)

    // Default: dark theme → light status bar icons
    setStatusBarAppearance(false)

    // Inject JS bridge so the WebView can toggle status bar style
    val webView = findWebView(window.decorView)
    webView?.addJavascriptInterface(StatusBarBridge(this), "AndroidStatusBar")
  }

  fun setStatusBarAppearance(lightIcons: Boolean) {
    val controller = WindowInsetsControllerCompat(window, window.decorView)
    // isAppearanceLightStatusBars = true → dark icons (for light backgrounds)
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
 * JS bridge exposed as window.AndroidStatusBar in the WebView.
 * Call AndroidStatusBar.setTheme("light") or AndroidStatusBar.setTheme("dark")
 * to update status bar icon colors.
 */
class StatusBarBridge(private val activity: MainActivity) {
  @JavascriptInterface
  fun setTheme(theme: String) {
    activity.runOnUiThread {
      // light app theme → dark status bar icons (lightIcons = true)
      // dark app theme  → light status bar icons (lightIcons = false)
      activity.setStatusBarAppearance(theme == "light")
    }
  }
}
