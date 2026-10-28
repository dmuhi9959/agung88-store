import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { isAdmin } from '@/lib/auth'

// Maximum single-file size: 500 MB
const MAX_FILE_SIZE = 500 * 1024 * 1024

// Threshold for switching to chunked upload
const CHUNK_THRESHOLD = 25 * 1024 * 1024

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface UploadResult {
  path: string
  originalName: string
  size: number
  sizeFormatted: string
  iconExtracted?: boolean
  iconUrl?: string
  useChunked?: boolean
}

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^\w\-.]+/g, '')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function ensureUniqueName(dir: string, baseName: string, ext: string): string {
  let name = `${slugify(baseName)}${ext}`
  let counter = 1
  while (existsSync(path.join(dir, name))) {
    name = `${slugify(baseName)}_${counter}${ext}`
    counter++
  }
  return name
}

/**
 * Extract the APK launcher icon by spawning the Python extractor script.
 * Returns the public URL of the icon (/uploads/icons/...) or null on failure.
 */
async function extractApkIcon(apkPath: string, apkFileName: string): Promise<string | null> {
  try {
    const { execFile } = await import('child_process')
    const { promisify } = await import('util')
    const execFileAsync = promisify(execFile)

    const scriptPath = path.join(process.cwd(), 'scripts', 'extract_single_icon.py')
    if (!existsSync(scriptPath)) {
      console.warn('[upload] Icon extractor script not found:', scriptPath)
      return null
    }

    const iconBaseName = apkFileName.replace(/\.apk$/i, '')
    const iconsDir = path.join(process.cwd(), 'public', 'uploads', 'icons')
    const iconFileName = `${iconBaseName}-icon.png`
    const iconOutputPath = path.join(iconsDir, iconFileName)

    await execFileAsync('python3', [scriptPath, apkPath, iconOutputPath], {
      timeout: 30000,
      maxBuffer: 1024 * 1024 * 50,
    })

    if (!existsSync(iconOutputPath)) return null
    const { stat } = await import('fs/promises')
    const stats = await stat(iconOutputPath)
    if (stats.size < 1000) return null
    return `/uploads/icons/${iconFileName}`
  } catch (err) {
    console.error('[upload] Icon extraction failed:', err)
    return null
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await isAdmin()
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Akses ditolak. Login admin diperlukan.' },
        { status: 403 }
      )
    }

    const formData = await req.formData()
    const file = formData.get('file')
    const type = (formData.get('type') as string) || 'mod'

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: 'File tidak ditemukan dalam request' },
        { status: 400 }
      )
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: `File terlalu besar (maks ${formatSize(MAX_FILE_SIZE)})` },
        { status: 413 }
      )
    }

    // For APK files > 25MB, instruct client to use chunked upload
    if (type === 'mod' && file.size > CHUNK_THRESHOLD) {
      return NextResponse.json({
        success: false,
        error: 'File terlalu besar untuk upload langsung. Gunakan chunked upload.',
        code: 'USE_CHUNKED',
        useChunked: true,
      }, { status: 413 })
    }

    const originalName = file.name
    const buffer = Buffer.from(await file.arrayBuffer())

    let targetDir: string
    let publicPath: string
    let fileName: string

    if (type === 'mod') {
      // Save APK file
      targetDir = path.join(process.cwd(), 'public', 'uploads', 'mods')
      const ext = path.extname(originalName).toLowerCase() || '.apk'
      const baseName = path.basename(originalName, ext)
      fileName = ensureUniqueName(targetDir, baseName, ext)
      publicPath = `/uploads/mods/${fileName}`
    } else if (type === 'icon') {
      targetDir = path.join(process.cwd(), 'public', 'uploads', 'icons')
      const ext = path.extname(originalName).toLowerCase() || '.png'
      const baseName = path.basename(originalName, ext)
      fileName = ensureUniqueName(targetDir, baseName, ext)
      publicPath = `/uploads/icons/${fileName}`
    } else {
      return NextResponse.json(
        { success: false, error: 'Tipe upload tidak valid' },
        { status: 400 }
      )
    }

    await mkdir(targetDir, { recursive: true })
    await writeFile(path.join(targetDir, fileName), buffer)

    const result: UploadResult = {
      path: publicPath,
      originalName,
      size: file.size,
      sizeFormatted: formatSize(file.size),
    }

    // Auto-extract icon for APK uploads
    if (type === 'mod' && originalName.toLowerCase().endsWith('.apk')) {
      const iconUrl = await extractApkIcon(
        path.join(targetDir, fileName),
        fileName
      )
      if (iconUrl) {
        result.iconExtracted = true
        result.iconUrl = iconUrl
      }
    }

    return NextResponse.json({ success: true, data: result })
  } catch (error: any) {
    console.error('[upload] POST error:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Gagal upload file' },
      { status: 500 }
    )
  }
}
