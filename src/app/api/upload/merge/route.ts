import { NextRequest, NextResponse } from 'next/server'
import { readdir, readFile, writeFile, mkdir, rm, stat } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { isAdmin } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CHUNKS_DIR = path.join(process.cwd(), 'public', 'uploads', '_chunks')
const MODS_DIR = path.join(process.cwd(), 'public', 'uploads', 'mods')

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
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

function ensureUniqueName(dir: string, baseName: string, ext: string): string {
  let name = `${slugify(baseName)}${ext}`
  let counter = 1
  while (existsSync(path.join(dir, name))) {
    name = `${slugify(baseName)}_${counter}${ext}`
    counter++
  }
  return name
}

async function extractApkIcon(apkPath: string, apkFileName: string): Promise<string | null> {
  try {
    const { execFile } = await import('child_process')
    const { promisify } = await import('util')
    const execFileAsync = promisify(execFile)

    const scriptPath = path.join(process.cwd(), 'scripts', 'extract_single_icon.py')
    if (!existsSync(scriptPath)) return null

    const iconBaseName = apkFileName.replace(/\.apk$/i, '')
    const iconsDir = path.join(process.cwd(), 'public', 'uploads', 'icons')
    const iconFileName = `${iconBaseName}-icon.png`
    const iconOutputPath = path.join(iconsDir, iconFileName)

    await execFileAsync('python3', [scriptPath, apkPath, iconOutputPath], {
      timeout: 30000,
      maxBuffer: 1024 * 1024 * 50,
    })

    if (!existsSync(iconOutputPath)) return null
    const stats = await stat(iconOutputPath)
    if (stats.size < 1000) return null
    return `/uploads/icons/${iconFileName}`
  } catch (err) {
    console.error('[upload/merge] Icon extraction failed:', err)
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

    const body = await req.json()
    const { uploadId, fileName, totalChunks } = body as {
      uploadId?: string
      fileName?: string
      totalChunks?: number
    }

    if (!uploadId || !fileName) {
      return NextResponse.json(
        { success: false, error: 'uploadId dan fileName wajib diisi' },
        { status: 400 }
      )
    }

    const sessionDir = path.join(CHUNKS_DIR, uploadId)
    if (!existsSync(sessionDir)) {
      return NextResponse.json(
        { success: false, error: 'Upload session tidak ditemukan' },
        { status: 404 }
      )
    }

    const chunkFiles = (await readdir(sessionDir)).filter(n => n.startsWith('chunk_')).sort()
    if (chunkFiles.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Tidak ada chunk ditemukan' },
        { status: 400 }
      )
    }

    if (totalChunks && chunkFiles.length !== totalChunks) {
      return NextResponse.json(
        { success: false, error: `Jumlah chunk tidak match (${chunkFiles.length}/${totalChunks})` },
        { status: 400 }
      )
    }

    await mkdir(MODS_DIR, { recursive: true })

    const ext = path.extname(fileName).toLowerCase() || '.apk'
    const baseName = path.basename(fileName, ext)
    const finalName = ensureUniqueName(MODS_DIR, baseName, ext)
    const finalPath = path.join(MODS_DIR, finalName)

    // Merge chunks
    let totalSize = 0
    for (const chunkFile of chunkFiles) {
      const chunkBuffer = await readFile(path.join(sessionDir, chunkFile))
      await writeFile(finalPath, chunkBuffer, { flag: 'a' })
      totalSize += chunkBuffer.length
    }

    // Clean up chunks
    try {
      await rm(sessionDir, { recursive: true, force: true })
    } catch {
      // ignore
    }

    const result: any = {
      path: `/uploads/mods/${finalName}`,
      originalName: fileName,
      size: totalSize,
      sizeFormatted: formatSize(totalSize),
      useChunked: true,
    }

    // Auto-extract icon if APK
    if (fileName.toLowerCase().endsWith('.apk')) {
      const iconUrl = await extractApkIcon(finalPath, finalName)
      if (iconUrl) {
        result.iconExtracted = true
        result.iconUrl = iconUrl
      }
    }

    return NextResponse.json({ success: true, data: result })
  } catch (error: any) {
    console.error('[upload/merge] POST error:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Gagal merge chunks' },
      { status: 500 }
    )
  }
}
