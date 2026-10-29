package com.stbmodstore.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.database.Cursor;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.view.View;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.core.content.FileProvider;

import java.io.File;

/**
 * MainActivity - Lightweight WebView wrapper for AGUNG88 APP STORE
 *
 * Menggunakan Activity (bukan AppCompatActivity) supaya APK lebih ringan (~2-3 MB).
 * Tidak pakai Material Components, SwipeRefreshLayout, atau lib lain yang berat.
 */
public class MainActivity extends Activity {

    private static final String TARGET_URL = "https://agung88-store.vercel.app";
    private static final String FILE_PROVIDER_AUTHORITY = "com.stbmodstore.app.fileprovider";
    private static final String DOWNLOAD_SUBDIR = "STB Mod Store";
    private static final int FILE_CHOOSER_REQUEST = 1001;

    private WebView webView;
    private ProgressBar progressBar;
    private TextView offlineView;
    private LinearLayout downloadProgressContainer;
    private ProgressBar downloadProgressBar;
    private TextView downloadProgressText;
    private TextView downloadProgressPercent;

    private ValueCallback<Uri[]> filePathCallback;
    private long currentDownloadId = -1;
    private Handler downloadProgressHandler;
    private Runnable downloadProgressRunnable;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Fullscreen, hide status & nav bars (TV mode)
        getWindow().setFlags(
            WindowManager.LayoutParams.FLAG_FULLSCREEN,
            WindowManager.LayoutParams.FLAG_FULLSCREEN
        );
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_FULLSCREEN
            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
        );

        setupUI();

        // Register receiver for download complete
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(onDownloadComplete, new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE), Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(onDownloadComplete, new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE));
        }

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState);
        } else {
            // Clear ALL WebView data aggressively on fresh start
            webView.clearCache(true);
            webView.clearHistory();
            webView.clearFormData();
            try {
                deleteDatabase("webview.db");
                deleteDatabase("webviewCache.db");
            } catch (Exception e) {}
            try {
                File cacheDir = getCacheDir();
                if (cacheDir.exists()) deleteDir(cacheDir);
                File appCacheDir = getExternalCacheDir();
                if (appCacheDir != null && appCacheDir.exists()) deleteDir(appCacheDir);
            } catch (Exception e) {}
            // Load URL with cache-bust parameter
            String urlWithCacheBust = TARGET_URL + "?t=" + System.currentTimeMillis();
            webView.loadUrl(urlWithCacheBust);
        }
    }

    private boolean deleteDir(File dir) {
        if (dir.isDirectory()) {
            String[] children = dir.list();
            if (children != null) {
                for (String child : children) {
                    if (!deleteDir(new File(dir, child))) return false;
                }
            }
        }
        return dir.delete();
    }

    private void setupUI() {
        FrameLayout root = new FrameLayout(this);
        root.setLayoutParams(new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ));

        webView = new WebView(this);
        webView.setLayoutParams(new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ));
        webView.setId(View.generateViewId());
        root.addView(webView);

        // Top progress bar (slim, 6dp)
        progressBar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        FrameLayout.LayoutParams pbParams = new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT, 6
        );
        progressBar.setLayoutParams(pbParams);
        progressBar.setMax(100);
        progressBar.setProgress(0);
        progressBar.setProgressTintList(android.content.res.ColorStateList.valueOf(Color.parseColor("#10b981")));
        progressBar.setVisibility(View.GONE);
        root.addView(progressBar);

        // Download progress container (bottom)
        downloadProgressContainer = new LinearLayout(this);
        downloadProgressContainer.setOrientation(LinearLayout.VERTICAL);
        FrameLayout.LayoutParams dpcParams = new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.WRAP_CONTENT
        );
        dpcParams.gravity = android.view.Gravity.BOTTOM;
        downloadProgressContainer.setLayoutParams(dpcParams);
        downloadProgressContainer.setPadding(16, 12, 16, 12);
        downloadProgressContainer.setBackgroundColor(Color.parseColor("#F0FDFA"));
        downloadProgressContainer.setElevation(8);

        downloadProgressText = new TextView(this);
        downloadProgressText.setText("Mengunduh APK...");
        downloadProgressText.setTextColor(Color.parseColor("#065F46"));
        downloadProgressText.setTextSize(12);
        downloadProgressText.setTypeface(downloadProgressText.getTypeface(), android.graphics.Typeface.BOLD);
        LinearLayout.LayoutParams textParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        );
        textParams.bottomMargin = 4;
        downloadProgressText.setLayoutParams(textParams);
        downloadProgressContainer.addView(downloadProgressText);

        downloadProgressBar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        LinearLayout.LayoutParams dpbParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, 12
        );
        downloadProgressBar.setLayoutParams(dpbParams);
        downloadProgressBar.setMax(100);
        downloadProgressBar.setProgress(0);
        downloadProgressBar.setProgressTintList(android.content.res.ColorStateList.valueOf(Color.parseColor("#10B981")));
        downloadProgressContainer.addView(downloadProgressBar);

        downloadProgressPercent = new TextView(this);
        downloadProgressPercent.setText("0% • 0 MB / 0 MB");
        downloadProgressPercent.setTextColor(Color.parseColor("#065F46"));
        downloadProgressPercent.setTextSize(10);
        LinearLayout.LayoutParams percentParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        );
        percentParams.topMargin = 2;
        downloadProgressPercent.setLayoutParams(percentParams);
        downloadProgressContainer.addView(downloadProgressPercent);

        downloadProgressContainer.setVisibility(View.GONE);
        root.addView(downloadProgressContainer);

        // Offline view
        offlineView = new TextView(this);
        FrameLayout.LayoutParams offParams = new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        );
        offlineView.setLayoutParams(offParams);
        offlineView.setText("Tidak ada koneksi internet.\n\nPastikan STB terhubung ke WiFi/LAN, lalu buka aplikasi lagi.");
        offlineView.setTextColor(Color.parseColor("#94a3b8"));
        offlineView.setTextSize(16);
        offlineView.setGravity(android.view.Gravity.CENTER);
        offlineView.setBackgroundColor(Color.parseColor("#0f172a"));
        offlineView.setVisibility(View.GONE);
        root.addView(offlineView);

        setContentView(root);

        configureWebView();
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void configureWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
        settings.setDefaultTextEncodingName("UTF-8");

        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String host = uri.getHost();
                if (host != null && host.contains("vercel.app")) {
                    return false;
                }
                Intent intent = new Intent(Intent.ACTION_VIEW, uri);
                if (intent.resolveActivity(getPackageManager()) != null) {
                    startActivity(intent);
                }
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                CookieManager.getInstance().flush();
                view.evaluateJavascript(
                    "try {" +
                    "  if ('serviceWorker' in navigator) {" +
                    "    navigator.serviceWorker.getRegistrations().then(function(regs) {" +
                    "      regs.forEach(function(r) { r.unregister(); });" +
                    "    });" +
                    "  }" +
                    "  if ('caches' in window) {" +
                    "    caches.keys().then(function(keys) {" +
                    "      keys.forEach(function(k) { caches.delete(k); });" +
                    "    });" +
                    "  }" +
                    "} catch(e) {}",
                    null
                );
                if (url.contains("?v=") && url.contains("vercel.app")) {
                    view.loadUrl(TARGET_URL);
                }
            }

            @Override
            public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
                if (!isOnline()) {
                    webView.setVisibility(View.GONE);
                    offlineView.setVisibility(View.VISIBLE);
                }
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                if (newProgress < 100) {
                    progressBar.setVisibility(View.VISIBLE);
                    progressBar.setProgress(newProgress);
                } else {
                    progressBar.setVisibility(View.GONE);
                }
            }

            @Override
            public boolean onShowFileChooser(WebView webView,
                                            ValueCallback<Uri[]> filePathCallback,
                                            FileChooserParams fileChooserParams) {
                if (MainActivity.this.filePathCallback != null) {
                    MainActivity.this.filePathCallback.onReceiveValue(null);
                }
                MainActivity.this.filePathCallback = filePathCallback;

                Intent intent = fileChooserParams.createIntent();
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                if (fileChooserParams.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE) {
                    intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                }

                try {
                    startActivityForResult(intent, FILE_CHOOSER_REQUEST);
                } catch (Exception e) {
                    MainActivity.this.filePathCallback = null;
                    return false;
                }
                return true;
            }
        });

        // === DOWNLOAD LISTENER - Handle APK download ===
        webView.setDownloadListener(new DownloadListener() {
            @Override
            public void onDownloadStart(String url, String userAgent, String contentDisposition, String mimetype, long contentLength) {
                startDownloadWithManager(url, userAgent, contentDisposition, mimetype, contentLength);
            }
        });
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == FILE_CHOOSER_REQUEST) {
            if (filePathCallback == null) return;
            Uri[] results = null;
            if (resultCode == RESULT_OK && data != null) {
                if (data.getClipData() != null) {
                    int count = data.getClipData().getItemCount();
                    results = new Uri[count];
                    for (int i = 0; i < count; i++) {
                        results[i] = data.getClipData().getItemAt(i).getUri();
                    }
                } else if (data.getData() != null) {
                    results = new Uri[]{ data.getData() };
                }
            }
            filePathCallback.onReceiveValue(results);
            filePathCallback = null;
        }
    }

    @SuppressLint("Range")
    private void startDownloadWithManager(String url, String userAgent, String contentDisposition, String mimetype, long contentLength) {
        try {
            DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
            request.setMimeType(mimetype != null ? mimetype : "application/octet-stream");
            request.setTitle("AGUNG88 - Download APK");
            request.setDescription("Sedang mengunduh APK...");
            request.setAllowedNetworkTypes(DownloadManager.Request.NETWORK_WIFI | DownloadManager.Request.NETWORK_MOBILE);
            request.setAllowedOverRoaming(true);
            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE);

            String cookies = CookieManager.getInstance().getCookie(url);
            if (cookies != null) request.addRequestHeader("Cookie", cookies);
            if (userAgent != null) request.addRequestHeader("User-Agent", userAgent);

            String fileName = URLUtil.guessFileName(url, contentDisposition, mimetype);
            if (!fileName.toLowerCase().endsWith(".apk") && !fileName.toLowerCase().endsWith(".zip") && !fileName.toLowerCase().endsWith(".rar")) {
                fileName += ".apk";
            }

            File destDir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
            if (destDir == null) destDir = getFilesDir();
            File subDir = new File(destDir, DOWNLOAD_SUBDIR);
            if (!subDir.exists()) subDir.mkdirs();

            request.setDestinationInExternalFilesDir(this, Environment.DIRECTORY_DOWNLOADS, DOWNLOAD_SUBDIR + "/" + fileName);

            DownloadManager dm = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
            currentDownloadId = dm.enqueue(request);

            downloadProgressText.setText("Mengunduh: " + fileName);
            downloadProgressContainer.setVisibility(View.VISIBLE);
            trackDownloadProgress(currentDownloadId, contentLength);
        } catch (Exception e) {
            Toast.makeText(this, "Gagal mulai download: " + e.getMessage(), Toast.LENGTH_LONG).show();
        }
    }

    private void trackDownloadProgress(long downloadId, long totalBytes) {
        if (downloadProgressHandler == null) downloadProgressHandler = new Handler();
        if (downloadProgressRunnable != null) downloadProgressHandler.removeCallbacks(downloadProgressRunnable);

        final DownloadManager dm = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
        downloadProgressRunnable = new Runnable() {
            @Override
            public void run() {
                DownloadManager.Query query = new DownloadManager.Query();
                query.setFilterById(downloadId);
                try (Cursor cursor = dm.query(query)) {
                    if (cursor != null && cursor.moveToFirst()) {
                        int status = cursor.getInt(cursor.getColumnIndex(DownloadManager.COLUMN_STATUS));
                        if (status == DownloadManager.STATUS_RUNNING) {
                            int downloaded = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR));
                            int total = totalBytes > 0 ? (int) totalBytes : cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES));
                            if (total > 0) {
                                int progress = (int) ((downloaded * 100L) / total);
                                downloadProgressBar.setProgress(progress);
                                downloadProgressPercent.setText(String.format("%d%% • %.2f MB / %.2f MB", progress, downloaded / 1048576.0, total / 1048576.0));
                            }
                            downloadProgressHandler.postDelayed(this, 500);
                        }
                    }
                }
            }
        };
        downloadProgressHandler.post(downloadProgressRunnable);
    }

    private final BroadcastReceiver onDownloadComplete = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            long id = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1);
            if (id == currentDownloadId) {
                downloadProgressContainer.setVisibility(View.GONE);
                installDownloadedApk(id);
            }
        }
    };

    @SuppressLint("Range")
    private void installDownloadedApk(long downloadId) {
        try {
            DownloadManager dm = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
            DownloadManager.Query query = new DownloadManager.Query().setFilterById(downloadId);
            try (Cursor cursor = dm.query(query)) {
                if (cursor != null && cursor.moveToFirst()) {
                    String localUri = cursor.getString(cursor.getColumnIndex(DownloadManager.COLUMN_LOCAL_URI));
                    if (localUri != null) {
                        File file = new File(Uri.parse(localUri).getPath());
                        if (file.exists()) {
                            Uri apkUri = FileProvider.getUriForFile(this, FILE_PROVIDER_AUTHORITY, file);
                            Intent installIntent = new Intent(Intent.ACTION_VIEW);
                            installIntent.setDataAndType(apkUri, "application/vnd.android.package-archive");
                            installIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                            installIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                            startActivity(installIntent);
                        }
                    }
                }
            }
        } catch (Exception e) {
            Toast.makeText(this, "Gagal install APK: " + e.getMessage(), Toast.LENGTH_LONG).show();
        }
    }

    private boolean isOnline() {
        try {
            android.net.ConnectivityManager cm = (android.net.ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
            android.net.NetworkInfo netInfo = cm != null ? cm.getActiveNetworkInfo() : null;
            return netInfo != null && netInfo.isConnectedOrConnecting();
        } catch (Exception e) {
            return true;
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        webView.saveState(outState);
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        try {
            if (onDownloadComplete != null) unregisterReceiver(onDownloadComplete);
        } catch (Exception e) {}
        if (downloadProgressHandler != null && downloadProgressRunnable != null) {
            downloadProgressHandler.removeCallbacks(downloadProgressRunnable);
        }
        if (webView != null) {
            try {
                ((FrameLayout) webView.getParent()).removeView(webView);
                webView.destroy();
            } catch (Exception e) {}
        }
        super.onDestroy();
    }
}
