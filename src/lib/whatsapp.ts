// Admin WhatsApp untuk request kode aktivasi
// Format: 089693388835 → 6289693388835 (internasional)
export const ADMIN_WHATSAPP_NUMBER = '6289693388835'
export const ADMIN_WHATSAPP_DISPLAY = '089693388835'

// Generate WhatsApp link dengan pesan template
export function getWhatsAppLink(customMessage?: string): string {
  const message = customMessage || `Halo Admin AGUNG88 APP STORE,

Saya baru install aplikasi store di STB/HP saya.
Minta kode aktivasi untuk bisa akses daftar APK.

Terima kasih.`
  return `https://wa.me/${ADMIN_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`
}
