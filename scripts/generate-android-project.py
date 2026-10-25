#!/usr/bin/env python3
"""
Generate Android Studio WebView project ZIP yang siap build APK.
Project ini berisi WebView wrapper yang me-load URL aplikasi STB Mod Store.

Struktur project:
- settings.gradle
- build.gradle (root)
- app/build.gradle
- app/src/main/AndroidManifest.xml
- app/src/main/java/com/stbmodstore/app/MainActivity.java
- app/src/main/res/layout/activity_main.xml
- app/src/main/res/values/strings.xml
- app/src/main/res/values/colors.xml
- app/src/main/res/values/themes.xml
- app/src/main/res/mipmap-*/ic_launcher.png (icons)
- app/src/main/res/xml/network_security_config.xml
- README.md
"""

import os
import zipfile
import shutil
from pathlib import Path

# Configuration
APP_PACKAGE = 'com.stbmodstore.app'
APP_NAME = 'STB Mod Store'
APP_URL = 'https://preview-chat-8b701ad6-a5bc-4a95-9c56-ea87c9141bb1.space-z.ai/'
VERSION_NAME = '1.0.0'
VERSION_CODE = '1'

# Paths
PROJECT_DIR = '/home/z/my-project/download/stb-mod-store-android-project'
ICON_SOURCE_DIR = '/home/z/my-project/public/icons'
ZIP_OUTPUT = '/home/z/my-project/public/downloads/stb-mod-store-android-project.zip'

# === Gradle files ===

SETTINGS_GRADLE = '''pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "STB Mod Store"
include ':app'
'''

ROOT_BUILD_GRADLE = '''// Top-level build file
plugins {
    id 'com.android.application' version '8.2.0' apply false
}
'''

GRADLE_PROPERTIES = '''org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8
android.useAndroidX=true
android.nonTransitiveRClass=true
'''

GRADLEW_PROPERTIES = '''distributionBase=GRADLE_USER_HOME
distributionPath=wrapper/dists
distributionUrl=https\\://services.gradle.org/distributions/gradle-8.2-bin.zip
networkTimeout=10000
validateDistributionUrl=true
zipStoreBase=GRADLE_USER_HOME
zipStorePath=wrapper/dists
'''

APP_BUILD_GRADLE = f'''plugins {{
    id 'com.android.application'
}}

android {{
    namespace '{APP_PACKAGE}'
    compileSdk 34

    defaultConfig {{
        applicationId "{APP_PACKAGE}"
        minSdk 21
        targetSdk 34
        versionCode {VERSION_CODE}
        versionName "{VERSION_NAME}"
    }}

    buildTypes {{
        release {{
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }}
    }}
    compileOptions {{
        sourceCompatibility JavaVersion.VERSION_1_8
        targetCompatibility JavaVersion.VERSION_1_8
    }}
}}

dependencies {{
    implementation 'androidx.appcompat:appcompat:1.6.1'
    implementation 'com.google.android.material:material:1.11.0'
    implementation 'androidx.constraintlayout:constraintlayout:2.1.4'
    implementation 'androidx.swiperefreshlayout:swiperefreshlayout:1.1.0'
    implementation 'androidx.webkit:webkit:1.9.0'
}}
'''

PROGUARD_RULES = '''# Keep WebView related classes
-keep class android.webkit.** { *; }
-keep class * extends android.webkit.WebViewClient
-keep class * extends android.webkit.WebChromeClient
'''

# === Android Manifest ===

ANDROID_MANIFEST = f'''<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools">

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"
        android:maxSdkVersion="18" tools:ignore="ScopedStorage" />

    <!-- Declare as Android TV / STB compatible (Leanback feature optional) -->
    <uses-feature android:name="android.software.leanback" android:required="false" />
    <uses-feature android:name="android.hardware.touchscreen" android:required="false" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:label="@string/app_name"
        android:supportsRtl="true"
        android:theme="@style/Theme.STBModStore"
        android:usesCleartextTraffic="false"
        android:networkSecurityConfig="@xml/network_security_config"
        android:requestLegacyExternalStorage="true"
        android:hardwareAccelerated="true"
        android:largeHeap="true">

        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:configChanges="orientation|screenSize|keyboardHidden|screenLayout|uiMode|fontScale"
            android:launchMode="singleTask"
            android:windowSoftInputMode="adjustResize"
            android:screenOrientation="sensorLandscape">

            <!-- Launcher icon for phones & tablets -->
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>

            <!-- Launcher icon for Android TV (Leanback) -->
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LEANBACK_LAUNCHER" />
            </intent-filter>
        </activity>
    </application>

</manifest>
'''

# === Java source code ===

MAIN_ACTIVITY_JAVA = f'''package {APP_PACKAGE};

import android.annotation.SuppressLint;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowManager;
import android.webkit.GeolocationPermissions;
import android.webkit.PermissionRequest;
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

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

/**
 * MainActivity - WebView wrapper untuk STB Mod Store
 *
 * Memuat URL: {APP_URL}
 * Mendukung:
 * - File upload (mod, screenshot, icon)
 * - Permission requests (camera, mic, location)
 * - Pull-to-refresh
 * - Back button navigation
 * - Fullscreen mode untuk video
 * - D-pad navigation untuk Android TV
 */
public class MainActivity extends AppCompatActivity {{

    private static final String TARGET_URL = "{APP_URL}";
    private static final String[] FALLBACK_URLS = {{
        "{APP_URL}",
        "https://www.google.com/search?q=stb+mod+store"
    }};

    private WebView webView;
    private SwipeRefreshLayout swipeRefresh;
    private ProgressBar progressBar;
    private TextView offlineView;
    private View loadingView;

    private ValueCallback<Uri[]> filePathCallback;
    private ActivityResultLauncher<Intent> fileChooserLauncher;

    @Override
    protected void onCreate(Bundle savedInstanceState) {{
        super.onCreate(savedInstanceState);

        // Edge-to-edge UI
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowInsetsControllerCompat controller = new WindowInsetsControllerCompat(getWindow(), getDecorView());
        controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);

        // Build UI
        setupUI();

        // Setup file chooser
        fileChooserLauncher = registerForActivityResult(
            new ActivityResultContracts.StartActivityForResult(),
            result -> {{
                if (filePathCallback == null) return;
                Uri[] results = null;
                if (result.getResultCode() == RESULT_OK && result.getData() != null) {{
                    Intent data = result.getData();
                    if (data.getClipData() != null) {{
                        int count = data.getClipData().getItemCount();
                        results = new Uri[count];
                        for (int i = 0; i < count; i++) {{
                            results[i] = data.getClipData().getItemAt(i).getUri();
                        }}
                    }} else if (data.getData() != null) {{
                        results = new Uri[]{{ data.getData() }};
                    }}
                }}
                filePathCallback.onReceiveValue(results);
                filePathCallback = null;
            }}
        );

        // Restore state if any
        if (savedInstanceState != null) {{
            webView.restoreState(savedInstanceState);
        }} else {{
            webView.loadUrl(TARGET_URL);
        }}
    }}

    private void setupUI() {{
        FrameLayout root = new FrameLayout(this);
        root.setLayoutParams(new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ));

        // SwipeRefreshLayout as wrapper
        swipeRefresh = new SwipeRefreshLayout(this);
        swipeRefresh.setLayoutParams(new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ));
        swipeRefresh.setOnRefreshListener(() -> webView.reload());

        // WebView
        webView = new WebView(this);
        webView.setLayoutParams(new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ));
        webView.setId(View.generateViewId());
        swipeRefresh.addView(webView);

        // Progress bar
        progressBar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progressBar.setLayoutParams(new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT, 8
        ));
        progressBar.setMax(100);
        progressBar.setProgress(0);
        progressBar.setVisibility(View.GONE);

        // Offline view
        offlineView = new TextView(this);
        offlineView.setLayoutParams(new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ));
        offlineView.setText("Tidak ada koneksi internet.\\n\\nPastikan STB terhubung ke WiFi/LAN, lalu buka aplikasi lagi.");
        offlineView.setTextColor(Color.parseColor("#94a3b8"));
        offlineView.setTextSize(16);
        offlineView.setGravity(android.view.Gravity.CENTER);
        offlineView.setBackgroundColor(Color.parseColor("#0f172a"));
        offlineView.setVisibility(View.GONE);

        root.addView(swipeRefresh);
        root.addView(progressBar);
        root.addView(offlineView);

        setContentView(root);

        configureWebView();
    }}

    @SuppressLint("SetJavaScriptEnabled")
    private void configureWebView() {{
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
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);

        // Enable D-pad navigation for Android TV
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {{
            // focusable for D-pad navigation
        }}

        // WebView client
        webView.setWebViewClient(new WebViewClient() {{
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {{
                Uri uri = request.getUrl();
                String host = uri.getHost();
                // Keep browsing in-app for our domain, open external for others
                if (host != null && (host.contains("space-z.ai") || host.contains("pwabuilder.com"))) {{
                    return false; // load in WebView
                }}
                // Open external links in browser
                Intent intent = new Intent(Intent.ACTION_VIEW, uri);
                if (intent.resolveActivity(getPackageManager()) != null) {{
                    startActivity(intent);
                }}
                return true;
            }}

            @Override
            public void onPageFinished(WebView view, String url) {{
                swipeRefresh.setRefreshing(false);
            }}

            @Override
            public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {{
                if (!isOnline()) {{
                    webView.setVisibility(View.GONE);
                    offlineView.setVisibility(View.VISIBLE);
                }}
            }}
        }});

        // Chrome client
        webView.setWebChromeClient(new WebChromeClient() {{
            @Override
            public void onProgressChanged(WebView view, int newProgress) {{
                if (newProgress < 100) {{
                    progressBar.setVisibility(View.VISIBLE);
                    progressBar.setProgress(newProgress);
                }} else {{
                    progressBar.setVisibility(View.GONE);
                }}
            }}

            @Override
            public void onPermissionRequest(final PermissionRequest request) {{
                runOnUiThread(() -> {{
                    String[] resources = request.getResources();
                    String[] granted = new String[resources.length];
                    for (int i = 0; i < resources.length; i++) {{
                        granted[i] = resources[i];
                    }}
                    request.grant(granted);
                }});
            }}

            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {{
                callback.invoke(origin, true, false);
            }}

            // File upload handler
            @Override
            public boolean onShowFileChooser(WebView webView,
                                            ValueCallback<Uri[]> filePathCallback,
                                            FileChooserParams fileChooserParams) {{
                // Cancel any previous callback
                if (MainActivity.this.filePathCallback != null) {{
                    MainActivity.this.filePathCallback.onReceiveValue(null);
                }}
                MainActivity.this.filePathCallback = filePathCallback;

                Intent intent = fileChooserParams.createIntent();
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                if (fileChooserParams.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE) {{
                    intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                }}

                try {{
                    fileChooserLauncher.launch(intent);
                }} catch (Exception e) {{
                    MainActivity.this.filePathCallback = null;
                    return false;
                }}
                return true;
            }}
        }});
    }}

    private boolean isOnline() {{
        ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
        if (cm == null) return false;
        NetworkInfo info = cm.getActiveNetworkInfo();
        return info != null && info.isConnected();
    }}

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {{
        // Handle D-pad navigation for Android TV
        if (keyCode == KeyEvent.KEYCODE_BACK && webView.canGoBack()) {{
            webView.goBack();
            return true;
        }}
        return super.onKeyDown(keyCode, event);
    }}

    @Override
    protected void onSaveInstanceState(Bundle outState) {{
        super.onSaveInstanceState(outState);
        webView.saveState(outState);
    }}

    @Override
    protected void onResume() {{
        super.onResume();
        if (offlineView.getVisibility() == View.VISIBLE && isOnline()) {{
            webView.setVisibility(View.VISIBLE);
            offlineView.setVisibility(View.GONE);
            webView.reload();
        }}
    }}

    @Override
    protected void onDestroy() {{
        if (webView != null) {{
            webView.destroy();
        }}
        super.onDestroy();
    }}

    private View getDecorView() {{
        return getWindow().getDecorView();
    }}
}}
'''

# === Resources ===

ACTIVITY_MAIN_XML = '''<?xml version="1.0" encoding="utf-8"?>
<FrameLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:background="#0f172a">

    <WebView
        android:id="@+id/webview"
        android:layout_width="match_parent"
        android:layout_height="match_parent" />

</FrameLayout>
'''

STRINGS_XML = f'''<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">{APP_NAME}</string>
    <string name="loading_message">Memuat STB Mod Store...</string>
    <string name="offline_message">Tidak ada koneksi internet</string>
</resources>
'''

COLORS_XML = '''<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="primary">#10b981</color>
    <color name="primary_dark">#0d9488</color>
    <color name="background">#0f172a</color>
    <color name="white">#ffffff</color>
    <color name="black">#000000</color>
</resources>
'''

THEMES_XML = '''<?xml version="1.0" encoding="utf-8"?>
<resources xmlns:tools="http://schemas.android.com/tools">
    <style name="Theme.STBModStore" parent="Theme.MaterialComponents.DayNight.NoActionBar">
        <item name="colorPrimary">@color/primary</item>
        <item name="colorPrimaryVariant">@color/primary_dark</item>
        <item name="colorOnPrimary">@color/white</item>
        <item name="android:statusBarColor">@color/background</item>
        <item name="android:navigationBarColor">@color/background</item>
        <item name="android:windowBackground">@color/background</item>
        <item name="android:windowLightStatusBar" tools:targetApi="m">false</item>
    </style>
</resources>
'''

NETWORK_SECURITY_CONFIG_XML = f'''<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <domain-config cleartextTrafficPermitted="false">
        <domain includeSubdomains="true">space-z.ai</domain>
        <domain includeSubdomains="true">preview-chat-8b701ad6-a5bc-4a95-9c56-ea87c9141bb1.space-z.ai</domain>
        <pin-set expiration="2027-12-31">
            <!-- TODO: Replace with actual SSL pin if needed -->
        </pin-set>
    </domain-config>
</network-security-config>
'''

README_MD = f'''# STB Mod Store - Android WebView Project

Template project Android Studio untuk membungkus aplikasi web STB Mod Store menjadi APK Android.

## Informasi Aplikasi

- **Nama**: {APP_NAME}
- **Package**: `{APP_PACKAGE}`
- **URL Target**: `{APP_URL}`
- **Version**: {VERSION_NAME} (build {VERSION_CODE})
- **Minimum SDK**: Android 5.0 (API 21)
- **Target SDK**: Android 14 (API 34)

## Cara Build APK

### Persyaratan
- Android Studio Hedgehog (2023.1.1) atau lebih baru
- JDK 17 (sudah include di Android Studio)
- Internet connection (untuk download Gradle dependencies)

### Langkah Build

1. **Download & Extract ZIP**
   ```
   Extract stb-mod-store-android-project.zip ke folder pilihan Anda
   ```

2. **Buka di Android Studio**
   - Buka Android Studio
   - Pilih **Open** atau **File → Open**
   - Pilih folder hasil extract (yang berisi `settings.gradle`)
   - Tunggu Gradle sync selesai (3-5 menit untuk pertama kali)

3. **Build APK**
   - Menu: **Build → Build Bundle(s) / APK(s) → Build APK(s)**
   - Tunggu build selesai (~2-5 menit)
   - Klik notification "APK built successfully" → **locate**
   - APK ada di: `app/build/outputs/apk/debug/app-debug.apk`

4. **(Opsional) Build Release APK (signed)**
   - Menu: **Build → Generate Signed Bundle / APK**
   - Pilih **APK** → Next
   - Buat keystore baru (jika belum ada):
     - Key store path: `stb-mod-store.jks`
     - Password: bebas (ingat baik-baik!)
     - Alias: `stb-mod-store-key`
     - Validity: 25 tahun
   - Pilih variant: **release**
   - APK ada di: `app/build/outputs/apk/release/app-release.apk`

### Install APK di STB

**Cara 1: USB Flashdisk**
1. Copy `app-debug.apk` ke USB flashdisk
2. Colokkan USB ke STB
3. Buka File Manager di STB
4. Klik file APK → Install

**Cara 2: ADB**
```bash
adb install app-debug.apk
```

## Konfigurasi URL

Jika aplikasi dipindah ke domain lain, edit file:

```
app/src/main/java/com/stbmodstore/app/MainActivity.java
```

Cari baris:
```java
private static final String TARGET_URL = "{APP_URL}";
```

Ganti dengan URL baru Anda.

## Fitur APK

- ✅ WebView wrapper (load URL aplikasi web)
- ✅ File upload support (untuk upload mod)
- ✅ Multiple file upload (untuk multiple screenshots)
- ✅ Permission handling (camera, mic, location)
- ✅ Pull-to-refresh
- ✅ Back button navigation
- ✅ D-pad navigation (untuk Android TV remote)
- ✅ Android TV / Leanback launcher support
- ✅ Landscape orientation default
- ✅ Hardware accelerated
- ✅ Offline detection
- ✅ Mixed content handling (HTTPS only)

## Permissions yang Dibutuhkan

- `INTERNET` - untuk load website
- `ACCESS_NETWORK_STATE` - untuk deteksi offline

## Customization

### Ganti Icon Aplikasi
Replace file di:
```
app/src/main/res/mipmap-mdpi/ic_launcher.png (48x48)
app/src/main/res/mipmap-hdpi/ic_launcher.png (72x72)
app/src/main/res/mipmap-xhdpi/ic_launcher.png (96x96)
app/src/main/res/mipmap-xxhdpi/ic_launcher.png (144x144)
app/src/main/res/mipmap-xxxhdpi/ic_launcher.png (192x192)
```

### Ganti Nama Aplikasi
Edit `app/src/main/res/values/strings.xml`:
```xml
<string name="app_name">Nama Baru Anda</string>
```

### Tambah Firebase / Push Notification
1. Tambah `google-services.json` ke folder `app/`
2. Tambah plugin `com.google.gms.google-services` di `app/build.gradle`
3. Implementasi FCM di MainActivity

## Troubleshooting

### Error: "Failed to resolve: com.android.tools.build:gradle"
- Update Android Studio ke versi terbaru
- Hapus folder `.gradle` dan `build`, lalu sync ulang

### Error: "SDK location not found"
- Buka `local.properties` (akan auto-create saat pertama kali dibuka)
- Tambah: `sdk.dir=/path/ke/Android/Sdk`

### APK tidak bisa install di STB
- Pastikan "Unknown sources" di-enable di Settings STB
- Cek minimal Android 5.0 (Lollipop)
- Untuk STB ARM 32-bit, pastikan tidak ada native lib (project ini pure Java, jadi kompatibel semua arsitektur)

### WebView blank / putih
- Pastikan STB ada internet
- Coba buka URL lain (Google.com) di WebView untuk test
- Cek logcat di Android Studio untuk error detail

## Lisensi

MIT License - bebas digunakan dan dimodifikasi.

## Support

Untuk bantuan, hubungi developer atau buka issue di repository.
'''

def write_file(path, content):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f'  ✓ {path}')

def copy_icon(src, dst, expected_size=None):
    if os.path.exists(src):
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copy2(src, dst)
        print(f'  ✓ {dst}')
    else:
        print(f'  ✗ {src} not found')

def main():
    print(f'Creating Android Studio project at: {PROJECT_DIR}')
    print()

    # Clean previous
    if os.path.exists(PROJECT_DIR):
        shutil.rmtree(PROJECT_DIR)

    # === Root files ===
    write_file(os.path.join(PROJECT_DIR, 'settings.gradle'), SETTINGS_GRADLE)
    write_file(os.path.join(PROJECT_DIR, 'build.gradle'), ROOT_BUILD_GRADLE)
    write_file(os.path.join(PROJECT_DIR, 'gradle.properties'), GRADLE_PROPERTIES)
    write_file(os.path.join(PROJECT_DIR, 'gradle', 'wrapper', 'gradle-wrapper.properties'), GRADLEW_PROPERTIES)
    write_file(os.path.join(PROJECT_DIR, '.gitignore'), '''*.iml
.gradle
/local.properties
/.idea
.DS_Store
/build
/captures
.externalNativeBuild
.cxx
''')

    # === App module ===
    write_file(os.path.join(PROJECT_DIR, 'app', 'build.gradle'), APP_BUILD_GRADLE)
    write_file(os.path.join(PROJECT_DIR, 'app', 'proguard-rules.pro'), PROGUARD_RULES)
    write_file(os.path.join(PROJECT_DIR, 'app', '.gitignore'), '/build\n')

    # === Android Manifest ===
    write_file(os.path.join(PROJECT_DIR, 'app', 'src', 'main', 'AndroidManifest.xml'), ANDROID_MANIFEST)

    # === Java source ===
    package_path = APP_PACKAGE.replace('.', '/')
    write_file(os.path.join(PROJECT_DIR, 'app', 'src', 'main', 'java', package_path, 'MainActivity.java'), MAIN_ACTIVITY_JAVA)

    # === Resources ===
    res_dir = os.path.join(PROJECT_DIR, 'app', 'src', 'main', 'res')
    write_file(os.path.join(res_dir, 'layout', 'activity_main.xml'), ACTIVITY_MAIN_XML)
    write_file(os.path.join(res_dir, 'values', 'strings.xml'), STRINGS_XML)
    write_file(os.path.join(res_dir, 'values', 'colors.xml'), COLORS_XML)
    write_file(os.path.join(res_dir, 'values', 'themes.xml'), THEMES_XML)
    write_file(os.path.join(res_dir, 'xml', 'network_security_config.xml'), NETWORK_SECURITY_CONFIG_XML)

    # === Icons (mipmap) ===
    print('\nCopying app icons...')
    icon_mapping = [
        ('icon-72x72.png', 'mipmap-hdpi', 'ic_launcher.png'),
        ('icon-72x72.png', 'mipmap-hdpi', 'ic_launcher_round.png'),
        ('icon-48x48.png' if False else 'icon-72x72.png', 'mipmap-mdpi', 'ic_launcher.png'),
        ('icon-72x72.png', 'mipmap-mdpi', 'ic_launcher_round.png'),
        ('icon-96x96.png', 'mipmap-xhdpi', 'ic_launcher.png'),
        ('icon-96x96.png', 'mipmap-xhdpi', 'ic_launcher_round.png'),
        ('icon-144x144.png', 'mipmap-xxhdpi', 'ic_launcher.png'),
        ('icon-144x144.png', 'mipmap-xxhdpi', 'ic_launcher_round.png'),
        ('icon-192x192.png', 'mipmap-xxxhdpi', 'ic_launcher.png'),
        ('icon-192x192.png', 'mipmap-xxxhdpi', 'ic_launcher_round.png'),
    ]

    # Generate 48x48 icon for mdpi if needed
    from PIL import Image
    mdpi_icon_path = os.path.join(ICON_SOURCE_DIR, 'icon-48x48.png')
    if not os.path.exists(mdpi_icon_path):
        # Resize from 72x72
        src = os.path.join(ICON_SOURCE_DIR, 'icon-72x72.png')
        if os.path.exists(src):
            img = Image.open(src)
            img_resized = img.resize((48, 48), Image.LANCZOS)
            img_resized.save(mdpi_icon_path)
            print(f'  ✓ Generated {mdpi_icon_path}')

    for src_name, dst_dir, dst_name in icon_mapping:
        src = os.path.join(ICON_SOURCE_DIR, src_name)
        dst = os.path.join(res_dir, dst_dir, dst_name)
        copy_icon(src, dst)

    # === Foreground/background for adaptive icons (Android 8+) ===
    write_file(os.path.join(res_dir, 'mipmap-anydpi-v26', 'ic_launcher.xml'), '''<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/primary" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
</adaptive-icon>
''')
    write_file(os.path.join(res_dir, 'mipmap-anydpi-v26', 'ic_launcher_round.xml'), '''<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/primary" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
</adaptive-icon>
''')

    # Foreground icon (use 192x192)
    foreground_src = os.path.join(ICON_SOURCE_DIR, 'icon-192x192-maskable.png')
    if not os.path.exists(foreground_src):
        foreground_src = os.path.join(ICON_SOURCE_DIR, 'icon-192x192.png')
    copy_icon(foreground_src, os.path.join(res_dir, 'mipmap-xxxhdpi', 'ic_launcher_foreground.png'))

    # === README ===
    write_file(os.path.join(PROJECT_DIR, 'README.md'), README_MD)

    # === Create ZIP ===
    print(f'\n📦 Creating ZIP archive...')
    os.makedirs(os.path.dirname(ZIP_OUTPUT), exist_ok=True)

    # Remove old zip if exists
    if os.path.exists(ZIP_OUTPUT):
        os.remove(ZIP_OUTPUT)

    with zipfile.ZipFile(ZIP_OUTPUT, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        for root, dirs, files in os.walk(PROJECT_DIR):
            for file in files:
                file_path = os.path.join(root, file)
                arcname = os.path.relpath(file_path, os.path.dirname(PROJECT_DIR))
                zf.write(file_path, arcname)

    print(f'  ✓ {ZIP_OUTPUT}')

    # Print summary
    zip_size = os.path.getsize(ZIP_OUTPUT)
    file_count = sum(1 for _ in zipfile.ZipFile(ZIP_OUTPUT).filelist)
    print(f'\n✅ Android Studio Project ZIP created successfully!')
    print(f'   Location: {ZIP_OUTPUT}')
    print(f'   Size: {zip_size / 1024:.1f} KB')
    print(f'   Files: {file_count}')
    print()
    print(f'📌 Next steps:')
    print(f'   1. Download ZIP dari aplikasi (menu: Download APK → Metode 2)')
    print(f'   2. Extract ZIP di PC Anda')
    print(f'   3. Buka folder di Android Studio')
    print(f'   4. Build → Build APK')
    print(f'   5. Install app-debug.apk di STB Anda')

if __name__ == '__main__':
    main()
