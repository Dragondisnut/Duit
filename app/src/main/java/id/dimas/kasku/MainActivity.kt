package id.dimas.kasku

import android.annotation.SuppressLint
import android.content.ContentValues
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.MediaStore
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.webkit.WebViewAssetLoader
import java.io.File

class MainActivity : ComponentActivity() {

    private lateinit var web: WebView
    private var fileCallback: ValueCallback<Array<Uri>>? = null

    private val pickFile = registerForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        fileCallback?.onReceiveValue(if (uri != null) arrayOf(uri) else null)
        fileCallback = null
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // File aplikasi dilayani dari domain lokal virtual (tidak pernah ke internet).
        val loader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        web = WebView(this)
        web.settings.javaScriptEnabled = true
        web.settings.domStorageEnabled = true
        web.settings.allowFileAccess = false
        web.settings.allowContentAccess = true
        web.addJavascriptInterface(Bridge(), "KasKuNative")

        web.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                loader.shouldInterceptRequest(request.url)

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean =
                request.url.host != "appassets.androidplatform.net"
        }
        web.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                view: WebView,
                callback: ValueCallback<Array<Uri>>,
                params: FileChooserParams
            ): Boolean {
                fileCallback?.onReceiveValue(null)
                fileCallback = callback
                pickFile.launch("*/*")
                return true
            }
        }

        setContentView(web)
        if (savedInstanceState == null) {
            web.loadUrl("https://appassets.androidplatform.net/assets/www/index.html")
        } else {
            web.restoreState(savedInstanceState)
        }

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                // Tutup pengaturan / kembali ke dashboard dulu sebelum keluar aplikasi.
                web.evaluateJavascript(
                    "(function(){var d=document.getElementById('settings');" +
                        "if(d&&d.open){d.close();return 'y';}" +
                        "if(!document.getElementById('viewChat').hidden){document.getElementById('tabDash').click();return 'y';}" +
                        "return 'n';})()"
                ) { r -> if (r != "\"y\"") finish() }
            }
        })
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        web.saveState(outState)
    }

    inner class Bridge {
        private val stateFile get() = File(filesDir, "kasku_state.json")

        @JavascriptInterface
        fun saveState(json: String) {
            val tmp = File(filesDir, "kasku_state.tmp")
            tmp.writeText(json)
            tmp.renameTo(stateFile)
        }

        @JavascriptInterface
        fun loadState(): String? = if (stateFile.exists()) stateFile.readText() else null

        @JavascriptInterface
        fun saveBackup(name: String, json: String): String {
            return try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    val values = ContentValues().apply {
                        put(MediaStore.Downloads.DISPLAY_NAME, name)
                        put(MediaStore.Downloads.MIME_TYPE, "application/json")
                        put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/KasKu")
                    }
                    val uri = contentResolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
                        ?: return "Gagal membuat file backup."
                    contentResolver.openOutputStream(uri)?.use { it.write(json.toByteArray()) }
                    "Backup tersimpan: Download/KasKu/$name"
                } else {
                    val dir = File(getExternalFilesDir(null), "backup").apply { mkdirs() }
                    File(dir, name).writeText(json)
                    "Backup tersimpan di folder aplikasi: backup/$name"
                }
            } catch (e: Exception) {
                "Gagal menyimpan backup: ${e.message}"
            }
        }
    }
}
