import { NextRequest, NextResponse } from 'next/server'
import { isAdmin } from '@/lib/auth'
import { getAdminClient, STORAGE_BUCKET } from '@/lib/supabase'
import { extractIconFromApk } from '@/lib/extract-icon'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/upload/complete
 *
 * Setelah browser upload APK langsung ke Supabase via signed URL,
 * panggil endpoint ini untuk extract icon.
 */
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
    const { path: storagePath, publicUrl, originalName, size, contentType } = body as {
      path?: string
      publicUrl?: string
      originalName?: string
      size?: number
      contentType?: string
    }

    if (!storagePath || !originalName) {
      return NextResponse.json(
        { success: false, error: 'path dan originalName wajib diisi' },
        { status: 400 }
      )
    }

    function formatSize(bytes: number): string {
      if (bytes < 1024) return `${bytes} B`
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
      if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
    }

    const result: any = {
      path: publicUrl || storagePath,
      originalName,
      size: size || 0,
      sizeFormatted: formatSize(size || 0),
    }

    // Auto-extract icon untuk APK menggunakan Node.js (Vercel-compatible)
    if (originalName.toLowerCase().endsWith('.apk') && publicUrl) {
      try {
        const apkRes = await fetch(publicUrl)
        if (!apkRes.ok) {
          throw new Error(`Gagal download APK: HTTP ${apkRes.status}`)
        }
        const apkBuffer = Buffer.from(await apkRes.arrayBuffer())

        const iconBuffer = await extractIconFromApk(apkBuffer)

        if (iconBuffer && iconBuffer.length > 1000) {
          const iconBaseName = originalName.replace(/\.apk$/i, '')
          const iconFileName = `${iconBaseName}-icon.png`
          const iconKey = `icons/${iconFileName}`

          const client = getAdminClient()
          const { error: iconErr } = await client.storage
            .from(STORAGE_BUCKET)
            .upload(iconKey, iconBuffer, { contentType: 'image/png', upsert: true })

          if (!iconErr) {
            const { data: pub } = client.storage.from(STORAGE_BUCKET).getPublicUrl(iconKey)
            result.iconExtracted = true
            result.iconUrl = pub.publicUrl
          }
        }
      } catch (err) {
        console.error('[upload/complete] Icon extraction error:', err)
      }
    }

    return NextResponse.json({ success: true, data: result })
  } catch (error: any) {
    console.error('[upload/complete] POST error:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Gagal complete upload' },
      { status: 500 }
    )
  }
}
