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
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.view.Gravity;
import android.view.View;
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
 * MainActivity v5.0.0 - UNIVERSAL STB SUPPORT
 *
 * Features:
 * - WebView fullscreen dengan loading screen
 * - DownloadManager untuk handle APK install (bypass browser)
 * - FileProvider untuk auto-install APK tanpa File Manager
 * - Theme.Black.NoTitleBar.Fullscreen (jalan di SEMUA Android)
 * - Screen orientation unspecified (ikut sistem)
 *
 * Compatible dengan:
 * - ZTE B860H v2 (Telkom/IndiHome)
 * - Mayrep STB
 * - Android TV / Android STB
 * - Min Android 5.0 (API 21)
 */
public class MainActivity extends Activity {

    private static final String TARGET_URL = "https://agung88-store.vercel.app";
    private static final String FILE_PROVIDER_AUTHORITY = "com.stbmodstore.app.fileprovider";
    private static final String DOWNLOAD_SUBDIR = "AGUNG88";
    private static final int FILE_CHOOSER_REQUEST = 1001;

    private WebView webView;
    private ProgressBar progressBar;
    private FrameLayout loadingScreen;
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

        // Set background color dulu supaya gak transparan
        getWindow().setBackgroundDrawableResource(android.R.color.background_dark);

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
            // Clear ALL WebView data aggressively
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
            // Load URL dengan cache-bust parameter
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
        root.setBackgroundColor(Color.parseColor("#0a0e1a"));

        // === LOADING SCREEN ===
        loadingScreen = new FrameLayout(this);
        loadingScreen.setLayoutParams(new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ));
        loadingScreen.setBackgroundColor(Color.parseColor("#0a0e1a"));

        LinearLayout loadingContainer = new LinearLayout(this);
        loadingContainer.setOrientation(LinearLayout.VERTICAL);
        loadingContainer.setGravity(Gravity.CENTER);
        FrameLayout.LayoutParams lcParams = new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.WRAP_CONTENT,
            FrameLayout.LayoutParams.WRAP_CONTENT
        );
        lcParams.gravity = Gravity.CENTER;
        loadingContainer.setLayoutParams(lcParams);

        TextView titleView = new TextView(this);
        titleView.setText("AGUNG88");
        titleView.setTextColor(Color.parseColor("#10b981"));
        titleView.setTextSize(36);
        titleView.setTypeface(Typeface.DEFAULT_BOLD);
        titleView.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams titleParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        );
        titleParams.bottomMargin = 8;
        titleView.setLayoutParams(titleParams);
        loadingContainer.addView(titleView);

        TextView subtitleView = new TextView(this);
        subtitleView.setText("APP STORE");
        subtitleView.setTextColor(Color.parseColor("#94a3b8"));
        subtitleView.setTextSize(16);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            subtitleView.setLetterSpacing(0.3f);
        }
        subtitleView.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams subParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        );
        subParams.bottomMargin = 32;
        subtitleView.setLayoutParams(subParams);
        loadingContainer.addView(subtitleView);

        ProgressBar spinner = new ProgressBar(this);
        spinner.setLayoutParams(new LinearLayout.LayoutParams(80, 80));
        spinner.setIndeterminate(true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            spinner.getIndeterminateDrawable().setColorFilter(
                Color.parseColor("#10b981"),
                android.graphics.PorterDuff.Mode.SRC_IN
            );
        }
        loadingContainer.addView(spinner);

        TextView loadingText = new TextView(this);
        loadingText.setText("Memuat aplikasi...");
        loadingText.setTextColor(Color.parseColor("#64748b"));
        loadingText.setTextSize(12);
        loadingText.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams ltParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        );
        ltParams.topMargin = 16;
        loadingText.setLayoutParams(ltParams);
        loadingContainer.addView(loadingText);

        loadingScreen.addView(loadingContainer);
        root.addView(loadingScreen);

        // === WEBVIEW ===
        webView = new WebView(this);
        webView.setLayoutParams(new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ));
        webView.setId(View.generateViewId());
        webView.setBackgroundColor(Color.parseColor("#0a0e1a"));
        webView.setVisibility(View.INVISIBLE);
        root.addView(webView);

        // === TOP PROGRESS BAR ===
        progressBar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        FrameLayout.LayoutParams pbParams = new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT, 6
        );
        progressBar.setLayoutParams(pbParams);
        progressBar.setMax(100);
        progressBar.setProgress(0);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            progressBar.setProgressTintList(android.content.res.ColorStateList.valueOf(Color.parseColor("#10b981")));
        }
        progressBar.setVisibility(View.GONE);
        root.addView(progressBar);

        // === DOWNLOAD PROGRESS (BOTTOM) ===
        downloadProgressContainer = new LinearLayout(this);
        downloadProgressContainer.setOrientation(LinearLayout.VERTICAL);
        FrameLayout.LayoutParams dpcParams = new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.WRAP_CONTENT
        );
        dpcParams.gravity = Gravity.BOTTOM;
        downloadProgressContainer.setLayoutParams(dpcParams);
        downloadProgressContainer.setPadding(16, 12, 16, 12);
        downloadProgressContainer.setBackgroundColor(Color.parseColor("#F0FDFA"));
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            downloadProgressContainer.setElevation(8);
        }

        downloadProgressText = new TextView(this);
        downloadProgressText.setText("Mengunduh APK...");
        downloadProgressText.setTextColor(Color.parseColor("#065F46"));
        downloadProgressText.setTextSize(12);
        downloadProgressText.setTypeface(Typeface.DEFAULT_BOLD);
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
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            downloadProgressBar.setProgressTintList(android.content.res.ColorStateList.valueOf(Color.parseColor("#10B981")));
        }
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

        // === OFFLINE VIEW ===
        offlineView = new TextView(this);
        FrameLayout.LayoutParams offParams = new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        );
        offlineView.setLayoutParams(offParams);
        offlineView.setText("Tidak ada koneksi internet.\n\nPastikan STB terhubung ke WiFi/LAN, lalu buka aplikasi lagi.");
        offlineView.setTextColor(Color.parseColor("#94a3b8"));
        offlineView.setTextSize(16);
        offlineView.setGravity(Gravity.CENTER);
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
                if (host != null && (host.contains("vercel.app") || host.contains("supabase.co") || host.contains("backblazeb2.com"))) {
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
                if (loadingScreen != null) {
                    loadingScreen.setVisibility(View.GONE);
                }
                webView.setVisibility(View.VISIBLE);
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

        // === DOWNLOAD LISTENER - PENTING UNTUK STB ===
        // Handle APK download pakai DownloadManager (bypass browser)
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
            // Visible notification supaya user tau progress
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

            Toast.makeText(this, "Mulai download: " + fileName, Toast.LENGTH_SHORT).show();
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
                            // Auto-install via FileProvider (gak butuh File Manager)
                            Uri apkUri = FileProvider.getUriForFile(this, FILE_PROVIDER_AUTHORITY, file);
                            Intent installIntent = new Intent(Intent.ACTION_VIEW);
                            installIntent.setDataAndType(apkUri, "application/vnd.android.package-archive");
                            installIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                            installIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                            startActivity(installIntent);
                            Toast.makeText(this, "APK siap install. Klik Install.", Toast.LENGTH_LONG).show();
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
