/**
 * Recommendation Engine murni untuk SELA Smart QR Menu (Cravio).
 * 
 * Aturan Non-Negotiable:
 * 1. 100% Deterministik tanpa AI/LLM eksternal (OpenAI, Gemini, dll).
 * 2. Perhitungan berbasis Weighted Tag Matching relasional dari database.
 * 3. 5-Tingkat Tie-Breaker dengan stable key menjamin konsistensi 100% pada pengujian berulang.
 * 4. Item sold-out (isAvailable: false) dan terarsip (isArchived: true) dieksklusikan seketika.
 * 5. Disclaimer alergi resmi tanpa klaim medis.
 */

export type TagDimension = 'MOOD' | 'FLAVOR' | 'FORMAT'

export interface CandidateTag {
  id: string
  slug: string
  name: string
  dimension: TagDimension
}

export interface CandidateModifierOption {
  id: string
  groupId: string
  name: string
  price: number
  isAvailable: boolean
}

export interface CandidateModifierGroup {
  id: string
  name: string
  isRequired: boolean
  minSelect: number
  maxSelect: number
  options: CandidateModifierOption[]
}

export interface CandidateMenuItem {
  id: string
  name: string
  description: string
  price: number // Integer IDR (e.g. 28000)
  image: string | null
  categoryId: string
  categoryName: string
  categorySlug: string
  isAvailable: boolean
  isPopular: boolean
  soldCount: number // strictly settled/paid orders only
  isArchived: boolean
  tags: CandidateTag[]
  modifierGroups?: CandidateModifierGroup[]
}

export interface SelectedOptionWeight {
  optionId: string
  tagId: string
  tagSlug: string
  tagName: string
  dimension: TagDimension
  weight: number // Flavor = 3, Format = 2, Mood = 1
}

export interface RecommendationResultItem {
  menuItem: CandidateMenuItem
  score: number
  matchedTags: CandidateTag[]
  matchReason: string
  dimensionMatchCount: number
}

export interface RecommendationResponse {
  hero: RecommendationResultItem | null
  alternatives: RecommendationResultItem[]
  isFallback: boolean
  fallbackReason?: string
  totalEvaluated: number
  executionDurationMs: number
  disclaimer: string
}

export const ALLERGY_DISCLAIMER =
  'Rekomendasi disajikan berdasarkan preferensi rasa yang Anda pilih. Harap konfirmasikan alergi bahan pangan ke staf kafe kami.'

export const DEFAULT_FALLBACK_REASON =
  'Kombinasi preferensi ini belum memiliki racikan langsung atau stok sedang habis, berikut opsi favorit pelanggan SELA yang paling diminati:'

export const EMPTY_CATALOG_REASON = 'Belum ada menu yang tersedia saat ini.'

/**
 * Menghasilkan kalimat alasan rekomendasi konkret yang disusun dari tag yang cocok.
 * Menghindari teks fiktif / halusinasi.
 */
export function buildMatchReason(matchedTags: CandidateTag[]): string {
  if (matchedTags.length === 0) {
    return 'Pilihan favorit pelanggan kafe SELA yang cocok dinikmati kapan saja.'
  }

  const moodTag = matchedTags.find((t) => t.dimension === 'MOOD')
  const flavorTag = matchedTags.find((t) => t.dimension === 'FLAVOR')
  const formatTag = matchedTags.find((t) => t.dimension === 'FORMAT')

  if (flavorTag && formatTag && moodTag) {
    return `Dipadukan khusus untuk suasana ${moodTag.name} dengan cita rasa ${flavorTag.name} dan sajian ${formatTag.name}.`
  }

  if (flavorTag && formatTag) {
    return `Memadukan kenikmatan rasa ${flavorTag.name} dengan segarnya sajian ${formatTag.name}.`
  }

  if (flavorTag && moodTag) {
    return `Cocok dinikmati saat suasana ${moodTag.name} dengan sentuhan rasa ${flavorTag.name}.`
  }

  if (flavorTag) {
    return `Dipilih karena menghadirkan karakter rasa ${flavorTag.name} yang memikat.`
  }

  if (formatTag && moodTag) {
    return `Pas menemani suasana ${moodTag.name} dengan sajian ${formatTag.name}.`
  }

  if (formatTag) {
    return `Pilihan tepat untuk menikmati sajian ${formatTag.name} favorit Anda.`
  }

  if (moodTag) {
    return `Pilihan pas untuk menemani waktu ${moodTag.name} Anda di kafe SELA.`
  }

  const tagNames = matchedTags.map((t) => t.name).join(', ')
  return `Cocok dengan preferensi Anda: ${tagNames}.`
}

export interface RecommendationEngineParams {
  menuItems: CandidateMenuItem[]
  selectedOptionWeights: SelectedOptionWeight[]
  /** Ambang batas skor minimum untuk kurasi (default: 3 sesuai ADR-0006) */
  minScoreThreshold?: number
  /** Jumlah maksimal alternatif (default: 2) */
  maxAlternatives?: number
}

/**
 * Fungsi kalkulasi rekomendasi murni dan deterministik.
 * Menjamin 100% determinisme: input + data yang sama selalu menghasilkan urutan yang identik.
 */
export function calculateRecommendations({
  menuItems,
  selectedOptionWeights,
  minScoreThreshold = 3,
  maxAlternatives = 2,
}: RecommendationEngineParams): RecommendationResponse {
  const startTime = performance.now()

  // 1. Filter awal: Hanya menu yang aktif dan tersedia (In-Stock Guard)
  const availableCandidates = menuItems.filter(
    (item) => !item.isArchived && item.isAvailable
  )

  const totalEvaluated = availableCandidates.length

  // Edge case: Jika tidak ada menu tersedia di seluruh katalog
  if (totalEvaluated === 0) {
    const duration = performance.now() - startTime
    return {
      hero: null,
      alternatives: [],
      isFallback: true,
      fallbackReason: EMPTY_CATALOG_REASON,
      totalEvaluated: 0,
      executionDurationMs: Number(duration.toFixed(3)),
      disclaimer: ALLERGY_DISCLAIMER,
    }
  }

  // Petakan tag yang dipilih ke dalam Map untuk lookup O(1)
  // tagId -> { weight, dimension, name, slug }
  const selectedTagMap = new Map<string, SelectedOptionWeight>()
  for (const optWeight of selectedOptionWeights) {
    selectedTagMap.set(optWeight.tagId, optWeight)
  }

  // 2. Evaluasi skor untuk setiap kandidat yang tersedia
  const scoredItems: RecommendationResultItem[] = []

  for (const item of availableCandidates) {
    let itemScore = 0
    const matchedTags: CandidateTag[] = []
    const matchedDimensions = new Set<TagDimension>()

    for (const tag of item.tags) {
      const selected = selectedTagMap.get(tag.id)
      if (selected) {
        itemScore += selected.weight
        matchedTags.push(tag)
        matchedDimensions.add(tag.dimension)
      }
    }

    // Bonus Best Seller (+1) sesuai ADR-0006
    if (item.isPopular) {
      itemScore += 1
    }

    scoredItems.push({
      menuItem: item,
      score: itemScore,
      matchedTags,
      matchReason: buildMatchReason(matchedTags),
      dimensionMatchCount: matchedDimensions.size,
    })
  }

  // 3. Terapkan 5-Tingkat Tie-Breaker Deterministik:
  // 1. score DESC
  // 2. dimensionMatchCount DESC
  // 3. isPopular DESC
  // 4. soldCount DESC
  // 5. id ASC (stable final key)
  scoredItems.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score
    }
    if (b.dimensionMatchCount !== a.dimensionMatchCount) {
      return b.dimensionMatchCount - a.dimensionMatchCount
    }
    if (a.menuItem.isPopular !== b.menuItem.isPopular) {
      return a.menuItem.isPopular ? -1 : 1
    }
    if (b.menuItem.soldCount !== a.menuItem.soldCount) {
      return b.menuItem.soldCount - a.menuItem.soldCount
    }
    return a.menuItem.id.localeCompare(b.menuItem.id)
  })

  // 4. Evaluasi hasil terhadap ambang batas (minScoreThreshold)
  // Apakah ada kandidat yang memenuhi syarat skor?
  const qualifiedItems = scoredItems.filter(
    (item) => item.score >= minScoreThreshold && item.matchedTags.length > 0
  )

  let hero: RecommendationResultItem | null = null
  let alternatives: RecommendationResultItem[] = []
  let isFallback = false
  let fallbackReason: string | undefined

  if (qualifiedItems.length > 0) {
    // Kurasi Berhasil
    hero = qualifiedItems[0] ?? null
    alternatives = qualifiedItems.slice(1, 1 + maxAlternatives)
  } else {
    // Fallback Aktif: Ambil menu favorit terpopuler yang tersedia
    isFallback = true
    fallbackReason = DEFAULT_FALLBACK_REASON

    // Urutkan ulang kandidat untuk fallback:
    // 1. isPopular DESC
    // 2. soldCount DESC
    // 3. price ASC
    // 4. id ASC
    const fallbackSorted = [...availableCandidates].sort((a, b) => {
      if (a.isPopular !== b.isPopular) {
        return a.isPopular ? -1 : 1
      }
      if (b.soldCount !== a.soldCount) {
        return b.soldCount - a.soldCount
      }
      if (a.price !== b.price) {
        return a.price - b.price
      }
      return a.id.localeCompare(b.id)
    })

    const fallbackItems: RecommendationResultItem[] = fallbackSorted.map(
      (item) => ({
        menuItem: item,
        score: item.isPopular ? 1 : 0,
        matchedTags: [],
        matchReason: 'Pilihan favorit pelanggan kafe SELA yang cocok dinikmati kapan saja.',
        dimensionMatchCount: 0,
      })
    )

    hero = fallbackItems[0] ?? null
    alternatives = fallbackItems.slice(1, 1 + maxAlternatives)
  }

  const duration = performance.now() - startTime

  return {
    hero,
    alternatives,
    isFallback,
    fallbackReason,
    totalEvaluated,
    executionDurationMs: Number(duration.toFixed(3)),
    disclaimer: ALLERGY_DISCLAIMER,
  }
}
