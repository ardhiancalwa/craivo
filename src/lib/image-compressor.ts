/**
 * Utilitas kompresi citra berbasis canvas di sisi peramban (client-side).
 * Menghilangkan batasan kaku 2 MB dengan mengompresi foto beresolusi tinggi
 * dari kamera ponsel (3-8 MB) menjadi format WebP/JPEG ringan (~60-150 KB)
 * dengan resolusi proporsional maksimal 1200x1200 px tanpa kehilangan ketajaman visual.
 */

export interface CompressionOptions {
  maxWidth?: number
  maxHeight?: number
  quality?: number
  mimeType?: 'image/webp' | 'image/jpeg'
}

export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<File> {
  const {
    maxWidth = 1200,
    maxHeight = 1200,
    quality = 0.82,
    mimeType = 'image/webp',
  } = options

  // Jika file bukan gambar, kembalikan langsung
  if (!file.type.startsWith('image/')) {
    return file
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Gagal membaca berkas foto.'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Format citra tidak dapat diurai.'))
      img.onload = () => {
        let width = img.naturalWidth || img.width
        let height = img.naturalHeight || img.height

        // Hitung skala proporsional
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height)
          width = Math.round(width * ratio)
          height = Math.round(height * ratio)
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(file)
          return
        }

        // Gambar ke canvas dengan interpolasi berkualitas tinggi
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(img, 0, 0, width, height)

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file)
              return
            }

            // Ganti ekstensi file menjadi .webp atau .jpg sesuai mimeType
            const ext = mimeType === 'image/webp' ? 'webp' : 'jpg'
            const baseName = file.name.replace(/\.[^/.]+$/, '')
            const compressedFile = new File([blob], `${baseName}.${ext}`, {
              type: mimeType,
              lastModified: Date.now(),
            })

            resolve(compressedFile)
          },
          mimeType,
          quality
        )
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}

