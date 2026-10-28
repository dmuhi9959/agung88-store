export type Mod = {
  id: string
  name: string
  slug: string
  description: string
  version: string
  developer: string
  category: string
  stbType: string
  tags: string
  fileSize: string
  fileName: string
  filePath: string
  screenshots: string
  changelog: string
  iconUrl: string
  downloads: number
  rating: number
  featured: boolean
  published: boolean
  createdAt: string
  updatedAt: string
}

export type UploadResult = {
  path: string
  originalName: string
  size: number
  sizeFormatted: string
  iconExtracted?: boolean
  iconUrl?: string
  useChunked?: boolean
}

export type CreateModInput = {
  name: string
  description: string
  version: string
  developer: string
  category: string
  stbType: string
  tags?: string
  fileSize?: string
  fileName?: string
  filePath?: string
  screenshots?: string
  changelog?: string
  iconUrl?: string
  featured?: boolean
}
