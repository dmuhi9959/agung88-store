import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey

let publicClient: SupabaseClient | null = null
let adminClient: SupabaseClient | null = null

export function getPublicClient(): SupabaseClient {
  if (!publicClient) {
    publicClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
    })
  }
  return publicClient
}

export function getAdminClient(): SupabaseClient {
  if (!adminClient) {
    adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return adminClient
}

export const STORAGE_BUCKET = 'agung88-store'

export interface Mod {
  id: string
  name: string
  slug: string
  description: string
  version: string
  developer: string
  category: string
  stb_type: string
  tags: string
  file_size: string
  file_name: string
  file_path: string
  screenshots: string
  changelog: string
  icon_url: string
  downloads: number
  rating: number
  featured: boolean
  published: boolean
  created_at: string
  updated_at: string | null
}

export interface Activation {
  id: string
  code: string
  used: boolean
  used_at: string | null
  device_info: string
  created_at: string
  expires_at: string | null
}

export function modFromDb(row: any): Mod {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description || '',
    version: row.version || '',
    developer: row.developer || '',
    category: row.category || 'app',
    stb_type: row.stb_type || 'android-tv',
    tags: row.tags || '',
    file_size: row.file_size || '',
    file_name: row.file_name || '',
    file_path: row.file_path || '',
    screenshots: row.screenshots || '',
    changelog: row.changelog || '',
    icon_url: row.icon_url || '',
    downloads: row.downloads ?? 0,
    rating: row.rating ?? 5.0,
    featured: row.featured ?? false,
    published: row.published ?? true,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export function modToCamel(mod: Mod) {
  return {
    id: mod.id,
    name: mod.name,
    slug: mod.slug,
    description: mod.description,
    version: mod.version,
    developer: mod.developer,
    category: mod.category,
    stbType: mod.stb_type,
    tags: mod.tags,
    fileSize: mod.file_size,
    fileName: mod.file_name,
    filePath: mod.file_path,
    screenshots: mod.screenshots,
    changelog: mod.changelog,
    iconUrl: mod.icon_url,
    downloads: mod.downloads,
    rating: mod.rating,
    featured: mod.featured,
    published: mod.published,
    createdAt: mod.created_at,
    updatedAt: mod.updated_at,
  }
}
