import { getAdminClient, STORAGE_BUCKET } from '@/lib/supabase'
import { extractApkInfo } from '@/lib/apk'

export type ApkUploadMeta = {
  name: string
  version: string
  versionCode: number
  developer: string
  description: string
  packageName: string
  iconUrl: string
  iconExtracted: boolean
}

function fallbackName(fileName: string): string {
  return (fileName || 'Aplikasi Android')
    .replace(/\.[^/.]+$/, '')
    .replace(/[-_.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100)
}

function buildDescription(
  name: string,
  version: string,
  packageName: string,
  sizeFormatted: string
): string {
  const bits = [`${name} versi ${version}`, 'aplikasi Android untuk TV/STB']
  if (sizeFormatted) bits.push(`ukuran ${sizeFormatted}`)
  if (packageName) bits.push(`package ${packageName}`)
  return bits.join(' • ')
}

/**
 * Ekstrak nama/versi/developer/deskripsi/icon dari APK, lalu simpan icon ke storage.
 * Tidak pernah melempar error: kalau gagal, tetap kembalikan data fallback
 * supaya proses upload APK tidak ikut gagal.
 */
export async function extractAndStoreApk(
  buffer: Buffer,
  fileName: string,
  sizeFormatted: string
): Promise<ApkUploadMeta> {
  const name = fallbackName(fileName)

  try {
    const info = extractApkInfo(buffer, sizeFormatted)
    const finalName = (info.meta.label || name || 'Aplikasi Android').slice(0, 100)
    const version = (info.meta.versionName || '1.0').slice(0, 40)
    const developer = (info.meta.developer || 'Tidak diketahui').slice(0, 80)
    const description = (
      info.meta.description || buildDescription(finalName, version, info.meta.packageName, sizeFormatted)
    ).slice(0, 500)

    let iconUrl = ''
    if (info.icon && info.icon.data.length > 0) {
      try {
        const admin = getAdminClient()
        const path = `icons/${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 10)}-icon.${info.icon.ext}`
        const { error } = await admin.storage.from(STORAGE_BUCKET).upload(path, info.icon.data, {
          contentType: info.icon.mime,
          cacheControl: '31536000',
          upsert: false,
        })
        if (!error) {
          iconUrl = admin.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl
        } else {
          console.error('[apk] gagal upload icon:', error)
        }
      } catch (e) {
        console.error('[apk] error upload icon:', e)
      }
    }

    return {
      name: finalName,
      version,
      versionCode: info.meta.versionCode || 0,
      developer,
      description,
      packageName: info.meta.packageName,
      iconUrl,
      iconExtracted: Boolean(iconUrl),
    }
  } catch (e) {
    console.error('[apk] gagal ekstrak metadata:', e)
    return {
      name: name || 'Aplikasi Android',
      version: '1.0',
      versionCode: 0,
      developer: 'Tidak diketahui',
      description: buildDescription(name || 'Aplikasi Android', '1.0', '', sizeFormatted),
      packageName: '',
      iconUrl: '',
      iconExtracted: false,
    }
  }
}
