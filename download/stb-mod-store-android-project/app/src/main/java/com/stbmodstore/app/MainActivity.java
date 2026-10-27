package com.stbmodstore.app;

import android.annotation.SuppressLint;
import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.database.Cursor;
import android.graphics.Color;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.view.KeyEvent;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.GeolocationPermissions;
import android.webkit.PermissionRequest;
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

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.FileProvider;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

import java.io.File;

/**
 * MainActivity - WebView wrapper untuk STB Mod Store
 *
 * Download APK tanpa WRITE_EXTERNAL_STORAGE permission:
 * - File disimpan di app-specific external storage (Android/data/<package>/files/Download/STB Mod Store/)
 * - Tidak butuh permission sama sekali
 * - File di-install via FileProvider (otomatis trigger installer)
 */
public class MainActivity extends AppCompatActivity {

    private static final String TARGET_URL = "https://preview-chat-8b701ad6-a5bc-4a95-9c56-ea87c9141bb1.space-z.ai/";
    private static final String FILE_PROVIDER_AUTHORITY = "com.stbmodstore.app.fileprovider";
    private static final String DOWNLOAD_SUBDIR = "STB Mod Store";

    private WebView webView;
    private SwipeRefreshLayout swipeRefresh;
    private ProgressBar progressBar;
    private TextView offlineView;

    // Download progress UI
    private LinearLayout downloadProgressContainer;
    private ProgressBar downloadProgressBar;
    private TextView downloadProgressText;
    private TextView downloadProgressPercent;

    private ValueCallback<Uri[]> filePathCallback;
    private ActivityResultLauncher<Intent> fileChooserLauncher;
    private long currentDownloadId = -1;
    private Handler downloadProgressHandler;
    private Runnable downloadProgressRunnable;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowInsetsControllerCompat controller = new WindowInsetsControllerCompat(getWindow(), getDecorView());
        controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);

        setupUI();

        fileChooserLauncher = registerForActivityResult(
            new ActivityResultContracts.StartActivityForResult(),
            result -> {
                if (filePathCallback == null) return;
                Uri[] results = null;
                if (result.getResultCode() == RESULT_OK && result.getData() != null) {
                    Intent data = result.getData();
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
        );

        // Register receiver for download complete
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(onDownloadComplete, new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE), Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(onDownloadComplete, new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE));
        }

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState);
        } else {
            // === CLEAR SEMUA CACHE SEBELUM LOAD ===
            // Hapus WebView cache
            webView.clearCache(true);
            webView.clearHistory();
            webView.clearFormData();
            
            // Hapus app data cache
            try {
                deleteDatabase("webview.db");
                deleteDatabase("webviewCache.db");
            } catch (Exception e) {}
            
            // Force clear service worker + localStorage
            webView.evaluateJavascript(
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
                "  localStorage.clear();" +
                "  sessionStorage.clear();" +
                "} catch(e) {}",
                null
            );
            
            // Load URL dengan cache-busting parameter
            webView.loadUrl(TARGET_URL);
        }
    }

    private void setupUI() {
        FrameLayout root = new FrameLayout(this);
        root.setLayoutParams(new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ));

        swipeRefresh = new SwipeRefreshLayout(this);
        swipeRefresh.setLayoutParams(new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ));
        swipeRefresh.setOnRefreshListener(() -> webView.reload());

        webView = new WebView(this);
        webView.setLayoutParams(new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ));
        webView.setId(View.generateViewId());
        swipeRefresh.addView(webView);

        // Progress bar for page loading
        progressBar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        FrameLayout.LayoutParams pbParams = new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT, 8
        );
        progressBar.setLayoutParams(pbParams);
        progressBar.setMax(100);
        progressBar.setProgress(0);
        progressBar.setProgressTintList(android.content.res.ColorStateList.valueOf(Color.parseColor("#10b981")));
        progressBar.setVisibility(View.GONE);

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
            LinearLayout.LayoutParams.MATCH_PARENT,
            12
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

        root.addView(swipeRefresh);
        root.addView(progressBar);
        root.addView(offlineView);
        root.addView(downloadProgressContainer);

        setContentView(root);

        configureWebView();
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void configureWebView() {
        WebSettings settings = webView.getSettings();
        // === SETTINGS WAJIB UNTUK CSS + JS ===
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
        // === FORCE NO CACHE - selalu ambil dari server ===
        settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        // === SETTINGS UNTUK ANDROID 6 (API 23) ===
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN) {
            settings.setAllowFileAccessFromFileURLs(true);
            settings.setAllowUniversalAccessFromFileURLs(true);
        }
        // Set default text encoding
        settings.setDefaultTextEncodingName("UTF-8");

        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String host = uri.getHost();
                if (host != null && (host.contains("space-z.ai") || host.contains("pwabuilder.com"))) {
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
                swipeRefresh.setRefreshing(false);
                CookieManager.getInstance().flush();
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
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(() -> {
                    String[] resources = request.getResources();
                    String[] granted = new String[resources.length];
                    System.arraycopy(resources, 0, granted, 0, resources.length);
                    request.grant(granted);
                });
            }

            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                callback.invoke(origin, true, false);
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
                    fileChooserLauncher.launch(intent);
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

    /**
     * Start download menggunakan Android DownloadManager
     * - File disimpan di app-specific external storage (TIDAK butuh permission)
     * - Lokasi: Android/data/com.stbmodstore.app/files/Download/STB Mod Store/
     * - Auto-install via FileProvider setelah selesai
     */
    @SuppressLint("Range")
    private void startDownloadWithManager(String url, String userAgent, String contentDisposition, String mimetype, long contentLength) {
        try {
            DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
            request.setMimeType(mimetype != null ? mimetype : "application/octet-stream");
            request.setTitle("STB Mod Store - Download APK");
            request.setDescription("Sedang mengunduh APK...");
            request.setAllowedNetworkTypes(DownloadManager.Request.NETWORK_WIFI | DownloadManager.Request.NETWORK_MOBILE);
            request.setAllowedOverRoaming(true);
            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE);

            // Cookies (untuk auth admin)
            String cookies = CookieManager.getInstance().getCookie(url);
            if (cookies != null) {
                request.addRequestHeader("Cookie", cookies);
            }
            if (userAgent != null) {
                request.addRequestHeader("User-Agent", userAgent);
            }

            // Tentukan filename
            String fileName = URLUtil.guessFileName(url, contentDisposition, mimetype);
            if (!fileName.toLowerCase().endsWith(".apk") && !fileName.toLowerCase().endsWith(".zip") && !fileName.toLowerCase().endsWith(".rar")) {
                fileName += ".apk";
            }

            // === SIMPAN DI APP-SPECIFIC STORAGE (TIDAK BUTUH PERMISSION) ===
            // Lokasi: /Android/data/com.stbmodstore.app/files/Download/STB Mod Store/
            File destDir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
            if (destDir == null) {
                destDir = getFilesDir(); // fallback ke internal storage
            }
            File stbDir = new File(destDir, DOWNLOAD_SUBDIR);
            if (!stbDir.exists()) {
                boolean created = stbDir.mkdirs();
                if (!created && !stbDir.exists()) {
                    stbDir = destDir; // fallback ke parent dir
                }
            }
            File destFile = new File(stbDir, fileName);

            // Hapus file lama dengan nama yang sama (kalau ada)
            if (destFile.exists()) {
                destFile.delete();
            }

            // Set destination via URI (file://)
            request.setDestinationUri(Uri.fromFile(destFile));

            // Enqueue download
            DownloadManager dm = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
            currentDownloadId = dm.enqueue(request);

            // Tampilkan progress UI
            long totalBytes = contentLength > 0 ? contentLength : 0;
            showDownloadProgress(fileName, totalBytes);

            Toast.makeText(this, "Memulai download: " + fileName, Toast.LENGTH_SHORT).show();

        } catch (SecurityException e) {
            Toast.makeText(this, "Gagal download (permission denied): " + e.getMessage(), Toast.LENGTH_LONG).show();
            e.printStackTrace();
        } catch (Exception e) {
            Toast.makeText(this, "Gagal memulai download: " + e.getMessage(), Toast.LENGTH_LONG).show();
            e.printStackTrace();
        }
    }

    /**
     * Tampilkan progress bar download di bawah aplikasi
     */
    private void showDownloadProgress(String fileName, long totalBytes) {
        runOnUiThread(() -> {
            downloadProgressText.setText("Mengunduh: " + fileName);
            downloadProgressText.setTextColor(Color.parseColor("#065F46"));
            downloadProgressBar.setProgress(0);
            downloadProgressBar.setIndeterminate(false);
            if (totalBytes > 0) {
                downloadProgressPercent.setText("0% • 0 MB / " + formatBytes(totalBytes));
            } else {
                downloadProgressPercent.setText("0% • Mengunduh...");
            }
            downloadProgressContainer.setVisibility(View.VISIBLE);
        });

        downloadProgressHandler = new Handler(Looper.getMainLooper());
        downloadProgressRunnable = new Runnable() {
            @Override
            public void run() {
                if (currentDownloadId == -1) return;
                DownloadManager.Query query = new DownloadManager.Query();
                query.setFilterById(currentDownloadId);
                DownloadManager dm = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
                Cursor cursor = dm.query(query);
                if (cursor != null && cursor.moveToFirst()) {
                    int status = cursor.getInt(cursor.getColumnIndex(DownloadManager.COLUMN_STATUS));
                    if (status == DownloadManager.STATUS_RUNNING) {
                        int downloaded = cursor.getInt(cursor.getColumnIndex(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR));
                        int total = cursor.getInt(cursor.getColumnIndex(DownloadManager.COLUMN_TOTAL_SIZE_BYTES));
                        if (total > 0) {
                            int percent = (downloaded * 100) / total;
                            downloadProgressBar.setProgress(percent);
                            downloadProgressPercent.setText(
                                percent + "% • " + formatBytes(downloaded) + " / " + formatBytes(total)
                            );
                        } else {
                            downloadProgressBar.setIndeterminate(true);
                            downloadProgressPercent.setText(formatBytes(downloaded) + " diunduh...");
                        }
                    }
                    cursor.close();
                }
                downloadProgressHandler.postDelayed(this, 500);
            }
        };
        downloadProgressHandler.post(downloadProgressRunnable);
    }

    private String formatBytes(long bytes) {
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1024 * 1024) return String.format("%.1f KB", bytes / 1024.0);
        if (bytes < 1024L * 1024 * 1024) return String.format("%.1f MB", bytes / (1024.0 * 1024));
        return String.format("%.2f GB", bytes / (1024.0 * 1024 * 1024));
    }

    /**
     * BroadcastReceiver untuk handle download selesai
     */
    private BroadcastReceiver onDownloadComplete = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            long id = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1);
            if (id != currentDownloadId) return;

            if (downloadProgressHandler != null && downloadProgressRunnable != null) {
                downloadProgressHandler.removeCallbacks(downloadProgressRunnable);
            }

            // Query status download
            DownloadManager.Query query = new DownloadManager.Query();
            query.setFilterById(id);
            DownloadManager dm = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
            Cursor cursor = dm.query(query);

            if (cursor != null && cursor.moveToFirst()) {
                @SuppressLint("Range")
                int status = cursor.getInt(cursor.getColumnIndex(DownloadManager.COLUMN_STATUS));
                @SuppressLint("Range")
                String localUriStr = cursor.getString(cursor.getColumnIndex(DownloadManager.COLUMN_LOCAL_URI));

                if (status == DownloadManager.STATUS_SUCCESSFUL && localUriStr != null) {
                    // Set progress ke 100%
                    downloadProgressBar.setProgress(100);
                    downloadProgressBar.setIndeterminate(false);
                    downloadProgressText.setText("Download selesai ✓");
                    downloadProgressText.setTextColor(Color.parseColor("#059669"));
                    downloadProgressPercent.setText("Lokasi: Android/data/com.stbmodstore.app/files/Download/STB Mod Store/");

                    // === AUTO-INSTALL APK VIA FILEPROVIDER ===
                    try {
                        // Parse local file path dari URI
                        Uri localUri = Uri.parse(localUriStr);
                        File apkFile = new File(localUri.getPath());

                        if (apkFile.exists()) {
                            // Pakai FileProvider untuk install (anti FileUriExposedException di Android 7+)
                            Uri apkContentUri = FileProvider.getUriForFile(
                                context,
                                FILE_PROVIDER_AUTHORITY,
                                apkFile
                            );

                            Intent installIntent = new Intent(Intent.ACTION_VIEW);
                            installIntent.setDataAndType(apkContentUri, "application/vnd.android.package-archive");
                            installIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                            installIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                            installIntent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);

                            context.startActivity(installIntent);
                            Toast.makeText(context, "APK siap diinstall. Klik Install.", Toast.LENGTH_LONG).show();
                        } else {
                            Toast.makeText(context, "File tidak ditemukan: " + apkFile.getAbsolutePath(), Toast.LENGTH_LONG).show();
                        }
                    } catch (Exception e) {
                        // Fallback: kasih tau user lokasi file
                        Toast.makeText(context,
                            "Download selesai. Buka File Manager → Android/data/com.stbmodstore.app/files/Download/STB Mod Store/",
                            Toast.LENGTH_LONG).show();
                        e.printStackTrace();
                    }

                    // Sembunyikan progress setelah 8 detik
                    new Handler(Looper.getMainLooper()).postDelayed(() -> {
                        downloadProgressContainer.setVisibility(View.GONE);
                        downloadProgressText.setTextColor(Color.parseColor("#065F46"));
                    }, 8000);

                } else if (status == DownloadManager.STATUS_FAILED) {
                    @SuppressLint("Range")
                    String reason = cursor.getString(cursor.getColumnIndex(DownloadManager.COLUMN_REASON));
                    downloadProgressText.setText("Download gagal ✗");
                    downloadProgressText.setTextColor(Color.parseColor("#EF4444"));
                    downloadProgressPercent.setText("Alasan: " + (reason != null ? reason : "unknown error"));

                    Toast.makeText(context,
                        "Download gagal. Coba lagi. (Reason: " + reason + ")",
                        Toast.LENGTH_LONG
                    ).show();

                    new Handler(Looper.getMainLooper()).postDelayed(() -> {
                        downloadProgressContainer.setVisibility(View.GONE);
                        downloadProgressText.setTextColor(Color.parseColor("#065F46"));
                    }, 5000);
                }
                cursor.close();
            }
            currentDownloadId = -1;
        }
    };

    private boolean isOnline() {
        ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
        if (cm == null) return false;
        NetworkInfo info = cm.getActiveNetworkInfo();
        return info != null && info.isConnected();
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK && webView.canGoBack()) {
            webView.goBack();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        webView.saveState(outState);
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (offlineView.getVisibility() == View.VISIBLE && isOnline()) {
            webView.setVisibility(View.VISIBLE);
            offlineView.setVisibility(View.GONE);
            webView.reload();
        }
    }

    @Override
    protected void onDestroy() {
        if (downloadProgressHandler != null && downloadProgressRunnable != null) {
            downloadProgressHandler.removeCallbacks(downloadProgressRunnable);
        }
        try {
            unregisterReceiver(onDownloadComplete);
        } catch (Exception e) {
            // ignore if not registered
        }
        if (webView != null) {
            webView.destroy();
        }
        super.onDestroy();
    }

    private View getDecorView() {
        return getWindow().getDecorView();
    }
}
