import { inflateRawSync } from 'zlib'

/**
 * Ekstraktor metadata APK tanpa dependency eksternal.
 * Membaca ZIP central directory, AndroidManifest.xml (binary XML),
 * resources.arsc (untuk resolve label/icon), lalu mengambil file icon.
 *
 * Semua fungsi defensif: kalau APK rusak / format aneh, hasil fallback kosong
 * dan upload tetap jalan.
 */

type ZipEntry = {
  name: string
  method: number
  compressedSize: number
  uncompressedSize: number
  offset: number
}

export type ApkMeta = {
  packageName: string
  versionName: string
  versionCode: number
  label: string
  developer: string
  description: string
  iconPath: string | null
}

export type ApkInfo = {
  meta: ApkMeta
  icon: { data: Buffer; ext: string; mime: string } | null
}

const EOCD_SIG = 0x06054b50
const CD_SIG = 0x02014b50
const LOCAL_SIG = 0x04034b50

export function readZipEntries(buf: Buffer): ZipEntry[] {
  let eocd = -1
  const minPos = Math.max(0, buf.length - 22 - 0xffff)
  for (let i = buf.length - 22; i >= minPos; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error('Bukan file ZIP/APK yang valid')

  const count = buf.readUInt16LE(eocd + 10)
  const cdOffset = buf.readUInt32LE(eocd + 16)
  if (cdOffset >= buf.length) throw new Error('Central directory tidak valid')

  const entries: ZipEntry[] = []
  let p = cdOffset
  for (let i = 0; i < count; i++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== CD_SIG) break
    const method = buf.readUInt16LE(p + 10)
    const compressedSize = buf.readUInt32LE(p + 20)
    const uncompressedSize = buf.readUInt32LE(p + 24)
    const nameLen = buf.readUInt16LE(p + 28)
    const extraLen = buf.readUInt16LE(p + 30)
    const commentLen = buf.readUInt16LE(p + 32)
    const offset = buf.readUInt32LE(p + 42)
    const name = buf.slice(p + 46, p + 46 + nameLen).toString('utf8')
    entries.push({ name, method, compressedSize, uncompressedSize, offset })
    p += 46 + nameLen + extraLen + commentLen
  }
  return entries
}

export function readZipEntry(buf: Buffer, entry: ZipEntry): Buffer | null {
  if (entry.offset + 30 > buf.length) return null
  if (buf.readUInt32LE(entry.offset) !== LOCAL_SIG) return null
  const nameLen = buf.readUInt16LE(entry.offset + 26)
  const extraLen = buf.readUInt16LE(entry.offset + 28)
  const start = entry.offset + 30 + nameLen + extraLen
  const end = start + entry.compressedSize
  if (start > buf.length) return null
  const data = buf.slice(start, Math.min(end, buf.length))
  try {
    if (entry.method === 0) return data
    if (entry.method === 8) return inflateRawSync(data)
  } catch {
    return null
  }
  return null
}

// ---------- Android binary XML (AXML) ----------

type AxmlAttr = {
  name: string
  raw: string | null
  dataType: number
  data: number
  value: string | null
}

type AxmlElement = {
  name: string
  attrs: AxmlAttr[]
}

function readPoolLength(buf: Buffer, p: number): { len: number; next: number } {
  let len = buf[p]
  let next = p + 1
  if (len & 0x80) {
    len = ((len & 0x7f) << 8) | buf[next]
    next += 1
  }
  return { len, next }
}

function parseStringPool(buf: Buffer, start: number): { strings: string[]; end: number } {
  const headerSize = buf.readUInt16LE(start + 2)
  const size = buf.readUInt32LE(start + 4)
  const stringCount = buf.readUInt32LE(start + 8)
  const flags = buf.readUInt32LE(start + 16)
  const stringsStart = buf.readUInt32LE(start + 20)
  const isUtf8 = (flags & 0x100) !== 0
  const base = start + stringsStart
  const strings: string[] = []

  for (let i = 0; i < stringCount; i++) {
    const off = buf.readUInt32LE(start + headerSize + i * 4)
    const p = base + off
    try {
      if (isUtf8) {
        const a = readPoolLength(buf, p)
        const b = readPoolLength(buf, a.next)
        strings.push(buf.slice(b.next, b.next + b.len).toString('utf8'))
      } else {
        let q = p
        let n = buf.readUInt16LE(q)
        q += 2
        if (n & 0x8000) {
          n = ((n & 0x7fff) << 16) | buf.readUInt16LE(q)
          q += 2
        }
        strings.push(buf.slice(q, q + n * 2).toString('utf16le'))
      }
    } catch {
      strings.push('')
    }
  }
  return { strings, end: start + size }
}

export function parseAxml(buf: Buffer): AxmlElement[] {
  if (buf.length < 8 || buf.readUInt16LE(0) !== 0x0003) throw new Error('AXML tidak valid')
  const total = buf.readUInt32LE(4)
  const limit = Math.min(total > 0 ? total : buf.length, buf.length)
  let p = 8
  let strings: string[] = []
  const elements: AxmlElement[] = []

  while (p + 8 <= limit) {
    const type = buf.readUInt16LE(p)
    const headerSize = buf.readUInt16LE(p + 2)
    const size = buf.readUInt32LE(p + 4)
    if (size < 8 || p + size > limit) break

    if (type === 0x0001) {
      strings = parseStringPool(buf, p).strings
    } else if (type === 0x0102) {
      const ext = p + headerSize
      const nameIdx = buf.readUInt32LE(ext + 4)
      const attrStart = buf.readUInt16LE(ext + 8)
      const attrSize = buf.readUInt16LE(ext + 10) || 20
      const attrCount = buf.readUInt16LE(ext + 12)
      const attrs: AxmlAttr[] = []

      for (let i = 0; i < attrCount; i++) {
        const ap = ext + attrStart + i * attrSize
        if (ap + 20 > limit) break
        const nameI = buf.readUInt32LE(ap + 4)
        const rawI = buf.readUInt32LE(ap + 8)
        const dataType = buf.readUInt8(ap + 15)
        const data = buf.readUInt32LE(ap + 16)
        const raw = rawI !== 0xffffffff ? strings[rawI] ?? null : null
        let value: string | null = raw
        if (value === null) {
          if (dataType === 0x03) value = strings[data] ?? null
          else if (dataType === 0x10) value = String(data | 0)
          else if (dataType === 0x11) value = '0x' + (data >>> 0).toString(16)
          else if (dataType === 0x12) value = data !== 0 ? 'true' : 'false'
        }
        attrs.push({ name: strings[nameI] || '', raw, dataType, data, value })
      }
      elements.push({ name: strings[nameIdx] || '', attrs })
    }
    p += size
  }
  return elements
}

// ---------- resources.arsc ----------

export function resolveResourceStrings(arsc: Buffer, resId: number): string[] {
  const wantedPkg = (resId >>> 24) & 0xff
  const wantedType = (resId >>> 16) & 0xff
  const wantedEntry = resId & 0xffff
  const out: string[] = []

  try {
    if (arsc.length < 12 || arsc.readUInt16LE(0) !== 0x0002) return out
    const tableHeaderSize = arsc.readUInt16LE(2)
    const tableSize = Math.min(arsc.readUInt32LE(4) || arsc.length, arsc.length)
    let p = tableHeaderSize
    let globalStrings: string[] = []

    while (p + 8 <= tableSize) {
      const type = arsc.readUInt16LE(p)
      const size = arsc.readUInt32LE(p + 4)
      if (size < 8 || p + size > tableSize) break

      if (type === 0x0001) {
        globalStrings = parseStringPool(arsc, p).strings
      } else if (type === 0x0200) {
        const pkgId = arsc.readUInt32LE(p + 8)
        let q = p + arsc.readUInt16LE(p + 2)
        const pkgEnd = p + size
        while (q + 8 <= pkgEnd) {
          const t2 = arsc.readUInt16LE(q)
          const hs2 = arsc.readUInt16LE(q + 2)
          const sz2 = arsc.readUInt32LE(q + 4)
          if (sz2 < 8) break

          if (t2 === 0x0201 && pkgId === wantedPkg) {
            const typeId = arsc.readUInt8(q + 8)
            const flags = arsc.readUInt8(q + 9)
            const entryCount = arsc.readUInt32LE(q + 12)
            const entriesStart = arsc.readUInt32LE(q + 16)
            const offsetsBase = q + hs2

            if (typeId === wantedType && wantedEntry < entryCount) {
              let entryOffset = -1
              if (flags & 0x01) {
                for (let i = 0; i < entryCount; i++) {
                  const idx = arsc.readUInt16LE(offsetsBase + i * 4)
                  if (idx === wantedEntry) {
                    entryOffset = arsc.readUInt16LE(offsetsBase + i * 4 + 2) * 4
                    break
                  }
                }
              } else if (flags & 0x02) {
                entryOffset = arsc.readUInt16LE(offsetsBase + wantedEntry * 2) * 4
              } else {
                entryOffset = arsc.readUInt32LE(offsetsBase + wantedEntry * 4)
              }

              if (entryOffset >= 0 && entryOffset !== 0xffffffff) {
                const ep = q + entriesStart + entryOffset
                if (ep + 16 <= pkgEnd) {
                  const entryFlags = arsc.readUInt16LE(ep + 2)
                  if (!(entryFlags & 0x0001)) {
                    // ResTable_entry (8 byte) lalu Res_value: size(2) res0(1) dataType(1) data(4)
                    const dt = arsc.readUInt8(ep + 11)
                    const d = arsc.readUInt32LE(ep + 12)
                    if (dt === 0x03 && globalStrings[d] != null) out.push(globalStrings[d])
                  }
                }
              }
            }
          }
          q += sz2
        }
      }
      p += size
    }
  } catch {
    // abaikan
  }
  return out
}

function densityRank(path: string): number {
  if (/xxxhdpi/i.test(path)) return 6
  if (/xxhdpi/i.test(path)) return 5
  if (/xhdpi/i.test(path)) return 4
  if (/hdpi/i.test(path)) return 3
  if (/mdpi/i.test(path)) return 2
  if (/ldpi/i.test(path)) return 1
  return 0
}

function isImagePath(path: string): boolean {
  return /\.(png|webp|jpe?g)$/i.test(path)
}

function pickBestImage(paths: string[]): string | null {
  const images = paths.filter(isImagePath)
  if (images.length === 0) return null
  return images.sort((a, b) => {
    const dr = densityRank(b) - densityRank(a)
    if (dr !== 0) return dr
    const ap = /ic_launcher|icon|logo/i.test(a) ? 1 : 0
    const bp = /ic_launcher|icon|logo/i.test(b) ? 1 : 0
    return bp - ap
  })[0]
}

function findIconFromEntries(entries: ZipEntry[], iconPath: string | null): ZipEntry | null {
  if (iconPath) {
    const direct = entries.find((e) => e.name === iconPath || e.name === iconPath.replace(/^\//, ''))
    if (direct && isImagePath(direct.name)) return direct
  }

  const candidates = entries.filter(
    (e) => /^res\//i.test(e.name) && isImagePath(e.name) && /ic_launcher|icon|logo/i.test(e.name)
  )
  if (candidates.length === 0) return null
  return candidates.sort((a, b) => {
    const dr = densityRank(b.name) - densityRank(a.name)
    if (dr !== 0) return dr
    return b.uncompressedSize - a.uncompressedSize
  })[0]
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function titleCase(value: string): string {
  return value
    .replace(/[_\-.]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function guessDeveloper(packageName: string, elements: AxmlElement[]): string {
  // Cari meta-data yang menyimpan nama developer/publisher.
  for (const el of elements) {
    if (el.name !== 'meta-data') continue
    const nameAttr = el.attrs.find((a) => a.name === 'name')?.value || ''
    if (/developer|author|publisher|company|vendor|studio/i.test(nameAttr)) {
      const val = el.attrs.find((a) => a.name === 'value')?.value
      if (val && val.length > 1 && val.length < 80) return cleanText(val)
    }
  }

  const parts = packageName.split('.').filter(Boolean)
  if (parts.length >= 3) {
    const generic = /^(com|org|net|id|io|co|me|app|android|google|mobile|tv)$/i
    const candidate = parts.find((p, i) => i > 0 && i < parts.length - 1 && !generic.test(p))
    if (candidate) return titleCase(candidate)
  }
  if (parts.length >= 2) return titleCase(parts[parts.length - 1])
  return 'Tidak diketahui'
}

function buildDescription(name: string, version: string, packageName: string, sizeFormatted: string): string {
  const bits = [`${name} versi ${version}`, 'aplikasi Android untuk TV/STB']
  if (sizeFormatted) bits.push(`ukuran ${sizeFormatted}`)
  if (packageName) bits.push(`package ${packageName}`)
  return cleanText(bits.join(' • '))
}

function attrValue(el: AxmlElement | undefined, name: string): string | null {
  if (!el) return null
  return el.attrs.find((a) => a.name === name)?.value ?? null
}

export function extractApkInfo(buf: Buffer, sizeFormatted = ''): ApkInfo {
  const fallback: ApkMeta = {
    packageName: '',
    versionName: '1.0',
    versionCode: 0,
    label: '',
    developer: '',
    description: '',
    iconPath: null,
  }

  let entries: ZipEntry[] = []
  try {
    entries = readZipEntries(buf)
  } catch {
    return { meta: fallback, icon: null }
  }

  const manifestEntry = entries.find((e) => e.name === 'AndroidManifest.xml')
  if (!manifestEntry) return { meta: fallback, icon: null }

  const manifestBuf = readZipEntry(buf, manifestEntry)
  if (!manifestBuf) return { meta: fallback, icon: null }

  let elements: AxmlElement[] = []
  try {
    elements = parseAxml(manifestBuf)
  } catch {
    return { meta: fallback, icon: null }
  }

  const manifest = elements.find((e) => e.name === 'manifest')
  const application = elements.find((e) => e.name === 'application')

  const packageName = cleanText(attrValue(manifest, 'package') || '')
  let versionName = cleanText(attrValue(manifest, 'versionName') || '')
  const versionCodeRaw = attrValue(manifest, 'versionCode')
  const versionCode = versionCodeRaw ? parseInt(versionCodeRaw, 10) || 0 : 0

  let arsc: Buffer | null = null
  const loadArsc = () => {
    if (arsc) return arsc
    const entry = entries.find((e) => e.name === 'resources.arsc')
    if (!entry) return null
    arsc = readZipEntry(buf, entry)
    return arsc
  }

  const resolveAttr = (value: string | null, dataType?: number, data?: number): string | null => {
    if (!value) {
      if (dataType === 0x01 && data !== undefined) {
        const table = loadArsc()
        if (table) {
          const strings = resolveResourceStrings(table, data >>> 0)
          return strings.length ? strings[0] : null
        }
      }
      return null
    }
    // raw string bisa berupa referensi "@0x7f0e0001"
    if (/^@?0x[0-9a-f]{8}$/i.test(value)) {
      const id = parseInt(value.replace(/^@/, ''), 16)
      const table = loadArsc()
      if (table) {
        const strings = resolveResourceStrings(table, id >>> 0)
        if (strings.length) return strings[0]
      }
      return null
    }
    return value
  }

  // label
  const labelAttr = application?.attrs.find((a) => a.name === 'label') || manifest?.attrs.find((a) => a.name === 'label')
  let label = ''
  if (labelAttr) {
    label = cleanText(resolveAttr(labelAttr.value, labelAttr.dataType, labelAttr.data) || '')
  }
  if (!label) label = cleanText(attrValue(application, 'name') || '')

  // icon
  const iconAttr = application?.attrs.find((a) => a.name === 'icon') || manifest?.attrs.find((a) => a.name === 'icon')
  let iconPath: string | null = null
  if (iconAttr) {
    if (iconAttr.dataType === 0x01) {
      const table = loadArsc()
      if (table) {
        iconPath = pickBestImage(resolveResourceStrings(table, iconAttr.data >>> 0))
      }
    } else {
      const val = iconAttr.value
      if (val && /^@?0x[0-9a-f]{8}$/i.test(val)) {
        const table = loadArsc()
        if (table) {
          iconPath = pickBestImage(resolveResourceStrings(table, parseInt(val.replace(/^@/, ''), 16) >>> 0))
        }
      } else if (val && isImagePath(val)) {
        iconPath = val
      }
    }
  }

  if (!versionName) versionName = versionCode ? `1.0.${versionCode}` : '1.0'

  const developer = guessDeveloper(packageName, elements)
  const name = label || 'Aplikasi Android'
  const description = buildDescription(name, versionName, packageName, sizeFormatted)

  const iconEntry = findIconFromEntries(entries, iconPath)
  let icon: ApkInfo['icon'] = null
  if (iconEntry) {
    const data = readZipEntry(buf, iconEntry)
    if (data && data.length > 0) {
      const ext = (iconEntry.name.match(/\.(png|webp|jpe?g)$/i)?.[1] || 'png').toLowerCase()
      const mime =
        ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png'
      icon = { data, ext, mime }
    }
  }

  return {
    meta: {
      packageName,
      versionName,
      versionCode,
      label,
      developer,
      description,
      iconPath: iconEntry?.name || iconPath,
    },
    icon,
  }
}
