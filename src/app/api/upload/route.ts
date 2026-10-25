import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

const ALLOWED_FILE_EXT = ['.zip', '.apk', '.rar', '.7z', '.img', '.bin', '.tar', '.gz']
const ALLOWED_IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg']
const MAX_FILE_SIZE = 500 * 1024 * 1024 // 500 MB
const MAX_IMAGE_SIZE = 10 * 1024 * 1024 // 10 MB

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const type = (formData.get('type') as string) || 'mod'

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'File tidak ditemukan dalam request' },
        { status: 400 }
      )
    }

    const originalName = file.name
    const ext = path.extname(originalName).toLowerCase()

    let targetDir: string
    let maxSize: number
    let allowed: string[]

    if (type === 'mod') {
      targetDir = 'uploads/mods'
      maxSize = MAX_FILE_SIZE
      allowed = ALLOWED_FILE_EXT
    } else if (type === 'screenshot' || type === 'icon') {
      targetDir = 'uploads/screenshots'
      maxSize = MAX_IMAGE_SIZE
      allowed = ALLOWED_IMAGE_EXT
    } else {
      return NextResponse.json(
        { success: false, error: 'Tipe upload tidak valid' },
        { status: 400 }
      )
    }

    if (!allowed.includes(ext)) {
      return NextResponse.json(
        {
          success: false,
          error: `Ekstensi ${ext} tidak diizinkan. Yang diizinkan: ${allowed.join(', ')}`,
        },
        { status: 400 }
      )
    }

    if (file.size > maxSize) {
      return NextResponse.json(
        {
          success: false,
          error: `Ukuran file melebihi batas ${maxSize / 1024 / 1024} MB`,
        },
        { status: 400 }
      )
    }

    // Generate safe unique filename
    const safeBase = originalName
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9-_]/g, '_')
      .slice(0, 60)
    const uniqueName = `${safeBase}_${uuidv4().slice(0, 8)}${ext}`
    const relativePath = `/${targetDir}/${uniqueName}`
    const absolutePath = path.join(process.cwd(), 'public', targetDir, uniqueName)

    // Ensure directory exists
    await mkdir(path.dirname(absolutePath), { recursive: true })

    // Convert File to Buffer and write
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(absolutePath, buffer)

    return NextResponse.json({
      success: true,
      data: {
        path: relativePath,
        originalName,
        size: file.size,
        sizeFormatted: formatBytes(file.size),
      },
    })
  } catch (error) {
    console.error('POST /api/upload error:', error)
    return NextResponse.json(
      { success: false, error: 'Gagal mengunggah file' },
      { status: 500 }
    )
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}
