# STB Mod Store - Android WebView Project

Template project Android Studio untuk membungkus aplikasi web STB Mod Store menjadi APK Android.

## Informasi Aplikasi

- **Nama**: STB Mod Store
- **Package**: `com.stbmodstore.app`
- **URL Target**: `https://preview-chat-8b701ad6-a5bc-4a95-9c56-ea87c9141bb1.space-z.ai/`
- **Version**: 1.0.0 (build 1)
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
private static final String TARGET_URL = "https://preview-chat-8b701ad6-a5bc-4a95-9c56-ea87c9141bb1.space-z.ai/";
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
