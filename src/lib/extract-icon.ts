/**
 * Pure Node.js APK icon extractor (Vercel-compatible, no Python needed)
 *
 * Strategy:
 * 1. mipmap-* dengan launcher-icon filename (ic_launcher, ic_app_icon, etc.)
 * 2. drawable root dengan launcher-icon filename
 * 3. assets/ folder dengan launcher-icon filename (untuk APK non-standard)
 * 4. LARGEST SQUARE image dengan content (48x48 to 1024x1024)
 * 5. Fallback: largest image dengan content (any shape)
 */
import AdmZip from 'adm-zip'
import sharp from 'sharp'

const ICON_NAME_PATTERNS = [
  'ic_launcher',
  'ic_app_icon',
  'app_icon',
  'ic_launcher_foreground',
  'ic_launcher_round',
  'ic_disney_launcher',
  'ic_appicon',
  'launcher_icon',
  'appicon',
  'logo',
  'icon',
]

const EXCLUDE_PATTERNS = [
  'exo_', 'common_google', 'ic_mr_', 'notify_', 'notification_',
  'abc_', 'design_', 'material_', 'googleg_', 'firebase_', 'crash_',
  'screenshot', 'splash', '_bg.9', 'error_message_icon', 'placeholder',
  'banner', 'header', 'background', 'shadow', 'btn_', 'switch_', 'text_',
]

const ICON_OUTPUT_SIZE = 192

function isImage(name: string): boolean {
  return /\.(png|jpe?g|webp)$/i.test(name)
}

function isNinePatch(name: string): boolean {
  return name.endsWith('.9.png')
}

function isExcluded(name: string): boolean {
  const lower = name.toLowerCase()
  return EXCLUDE_PATTERNS.some(p => lower.includes(p))
}

function isSquare(w: number, h: number, tol = 0.05): boolean {
  if (!w || !h) return false
  const ratio = w / h
  return (1 - tol) <= ratio && ratio <= (1 + tol)
}

async function getImageInfo(buffer: Buffer) {
  try {
    const metadata = await sharp(buffer).metadata()
    const w = metadata.width || 0
    const h = metadata.height || 0
    let hasContent = true
    if (metadata.hasAlpha) {
      try {
        const stats = await sharp(buffer).stats()
        const alphaStats = stats.channels[3]
        if (alphaStats && alphaStats.max === 0) {
          hasContent = false
        }
      } catch {
        // Stats failed, assume has content
      }
    }
    return { w, h, hasContent, fileSize: buffer.length }
  } catch {
    return null
  }
}

async function pickBestIcon(zip: AdmZip, images: string[]): Promise<string | null> {
  if (!images.length) return null

  // 1) mipmap-* dengan launcher filename
  for (const density of ['mipmap-xxxhdpi', 'mipmap-xxhdpi', 'mipmap-xhdpi', 'mipmap-hdpi', 'mipmap-mdpi', 'mipmap']) {
    for (const pattern of ICON_NAME_PATTERNS) {
      const candidates = images.filter(n =>
        n.includes(`res/${density}/`) &&
        n.toLowerCase().includes(pattern) &&
        !isExcluded(n) &&
        !isNinePatch(n)
      )
      if (candidates.length > 0) {
        const valid = candidates.filter(n => zip.getEntry(n) && zip.getEntry(n)!.header.size > 0)
        if (valid.length > 0) {
          return valid.sort((a, b) => zip.getEntry(b)!.header.size - zip.getEntry(a)!.header.size)[0]
        }
      }
    }
  }

  // 2) any mipmap with launcher filename
  for (const pattern of ICON_NAME_PATTERNS) {
    const candidates = images.filter(n =>
      n.includes('mipmap') &&
      n.toLowerCase().includes(pattern) &&
      !isExcluded(n) &&
      !isNinePatch(n)
    )
    if (candidates.length > 0) {
      const valid = candidates.filter(n => zip.getEntry(n)!.header.size > 0)
      if (valid.length > 0) {
        return valid.sort((a, b) => zip.getEntry(b)!.header.size - zip.getEntry(a)!.header.size)[0]
      }
    }
  }

  // 3) drawable root with launcher filename
  for (const pattern of ICON_NAME_PATTERNS) {
    const candidates = images.filter(n =>
      n.startsWith('res/drawable/') &&
      n.toLowerCase().includes(pattern) &&
      !isExcluded(n) &&
      !isNinePatch(n)
    )
    if (candidates.length > 0) {
      const valid = candidates.filter(n => zip.getEntry(n)!.header.size > 0)
      if (valid.length > 0) {
        return valid.sort((a, b) => zip.getEntry(b)!.header.size - zip.getEntry(a)!.header.size)[0]
      }
    }
  }

  // 4) assets/ folder with launcher filename
  for (const pattern of ICON_NAME_PATTERNS) {
    const candidates = images.filter(n =>
      n.startsWith('assets/') &&
      n.toLowerCase().includes(pattern) &&
      !isExcluded(n) &&
      !isNinePatch(n)
    )
    if (candidates.length > 0) {
      const valid = candidates.filter(n => zip.getEntry(n)!.header.size > 0)
      if (valid.length > 0) {
        return valid.sort((a, b) => zip.getEntry(b)!.header.size - zip.getEntry(a)!.header.size)[0]
      }
    }
  }

  // 5) LARGEST SQUARE image with content
  const squareCandidates: { name: string; w: number; h: number; fileSize: number }[] = []
  for (const n of images) {
    if (!n.startsWith('res/') && !n.startsWith('assets/')) continue
    if (isExcluded(n) || isNinePatch(n)) continue
    const entry = zip.getEntry(n)
    if (!entry) continue
    const buffer = entry.getData()
    const info = await getImageInfo(buffer)
    if (!info || !info.hasContent) continue
    if (info.w < 48 || info.h < 48 || info.w > 1024 || info.h > 1024) continue
    if (!isSquare(info.w, info.h)) continue
    squareCandidates.push({ name: n, ...info })
  }
  if (squareCandidates.length > 0) {
    squareCandidates.sort((a, b) => b.fileSize - a.fileSize)
    return squareCandidates[0].name
  }

  // 6) Fallback: largest image with content
  const allWithContent: { name: string; w: number; h: number; fileSize: number; score: number }[] = []
  for (const n of images) {
    if (!n.startsWith('res/') && !n.startsWith('assets/')) continue
    if (isExcluded(n) || isNinePatch(n)) continue
    const entry = zip.getEntry(n)
    if (!entry) continue
    const buffer = entry.getData()
    const info = await getImageInfo(buffer)
    if (info && info.hasContent && info.fileSize > 1000) {
      const ratio = Math.min(info.w, info.h) / Math.max(info.w, info.h)
      const score = info.fileSize * ratio
      allWithContent.push({ name: n, ...info, score })
    }
  }
  if (allWithContent.length > 0) {
    allWithContent.sort((a, b) => b.score - a.score)
    return allWithContent[0].name
  }
  return null
}

/**
 * Extract icon dari APK buffer, return PNG buffer 192x192
 */
export async function extractIconFromApk(apkBuffer: Buffer): Promise<Buffer | null> {
  try {
    const zip = new AdmZip(apkBuffer)
    const entries = zip.getEntries()
    const images = entries
      .map(e => e.entryName)
      .filter(name => isImage(name) && !isNinePatch(name))

    if (!images.length) return null

    const best = await pickBestIcon(zip, images)
    if (!best) return null

    const entry = zip.getEntry(best)
    if (!entry) return null
    const imageBuffer = entry.getData()

    const outputBuffer = await sharp(imageBuffer)
      .resize(ICON_OUTPUT_SIZE, ICON_OUTPUT_SIZE, {
        fit: 'cover',
        position: 'center',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer()

    return outputBuffer
  } catch (err) {
    console.error('[extract-icon] Error:', err)
    return null
  }
}
