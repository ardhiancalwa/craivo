import 'server-only'

export const JAKARTA_TIMEZONE = 'Asia/Jakarta'
export const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000 // UTC+7

/**
 * Mengonversi tanggal ISO string atau representasi YYYY-MM-DD ke batas awal
 * dan batas akhir hari dalam zona waktu Asia/Jakarta (WIB) yang tepat terhadap UTC.
 *
 * Contoh:
 * dateStr = "2026-10-29"
 * startUtc = 2026-10-28T17:00:00.000Z (00:00 WIB)
 * endUtc   = 2026-10-29T16:59:59.999Z (23:59:59.999 WIB)
 */
export function getJakartaDayBoundaries(dateStr: string): {
  startUtc: Date
  endUtc: Date
  jakartaDateString: string
} {
  // Parsing YYYY-MM-DD
  const match = dateStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match || !match[1] || !match[2] || !match[3]) {
    throw new Error(`Format tanggal tidak valid: "${dateStr}". Gunakan format YYYY-MM-DD.`)
  }

  const year = parseInt(match[1], 10)
  const month = parseInt(match[2], 10) - 1 // 0-indexed
  const day = parseInt(match[3], 10)

  // Buat stempel waktu UTC dari jam 00:00 WIB (dikurangi 7 jam UTC)
  const startUtcMs = Date.UTC(year, month, day, 0, 0, 0, 0) - JAKARTA_OFFSET_MS
  const endUtcMs = Date.UTC(year, month, day, 23, 59, 59, 999) - JAKARTA_OFFSET_MS

  const cleanJakartaStr = `${match[1]}-${match[2]}-${match[3]}`

  return {
    startUtc: new Date(startUtcMs),
    endUtc: new Date(endUtcMs),
    jakartaDateString: cleanJakartaStr,
  }
}

/**
 * Mengonversi rentang tanggal YYYY-MM-DD (startDate s/d endDate)
 * ke rentang batas UTC yang tepat.
 */
export function getJakartaDateRangeBoundaries(
  startDateStr: string,
  endDateStr: string
): {
  startUtc: Date
  endUtc: Date
  startJakartaString: string
  endJakartaString: string
} {
  const start = getJakartaDayBoundaries(startDateStr)
  const end = getJakartaDayBoundaries(endDateStr)

  if (start.startUtc > end.endUtc) {
    throw new Error('startDate tidak boleh lebih besar dari endDate.')
  }

  return {
    startUtc: start.startUtc,
    endUtc: end.endUtc,
    startJakartaString: start.jakartaDateString,
    endJakartaString: end.jakartaDateString,
  }
}

/**
 * Mendapatkan string tanggal hari ini dalam format YYYY-MM-DD berdasarkan waktu Jakarta.
 */
export function getJakartaTodayString(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: JAKARTA_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return formatter.format(new Date()) // Menghasilkan "YYYY-MM-DD"
}

/**
 * Memformat objek Date ke representasi tanggal dan jam WIB yang ramah dibaca manusia.
 * Contoh: "29 Okt 2026, 14:30 WIB"
 */
export function formatJakartaDateTime(date: Date): string {
  const datePart = new Intl.DateTimeFormat('id-ID', {
    timeZone: JAKARTA_TIMEZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)

  const timePart = new Intl.DateTimeFormat('id-ID', {
    timeZone: JAKARTA_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)

  return `${datePart}, ${timePart.replace('.', ':')} WIB`
}

/**
 * Mengekstrak representasi tanggal YYYY-MM-DD dari sebuah objek Date dalam zona waktu Asia/Jakarta.
 */
export function toJakartaDateString(date: Date): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: JAKARTA_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return formatter.format(date)
}
