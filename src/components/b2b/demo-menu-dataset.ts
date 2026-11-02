/**
 * Dataset Menu Statis untuk Simulasi Kuis Interaktif Landing Page B2B (REQ-B2B-02 / DEC-001)
 *
 * JAMINAN ISOLASI (Zero Data Leak & Zero Mutation):
 * - Dataset ini murni statis dalam memori (in-memory).
 * - Tidak memanggil database Prisma, model Order, Midtrans, atau kredensial backend.
 * - Digunakan khusus untuk demonstrasi pratinjau preferensi pelanggan pada halaman publik B2B.
 */

export interface DemoTag {
  id: string
  name: string
  dimension: 'MOOD' | 'FLAVOR' | 'FORMAT'
}

export interface DemoMenuItem {
  id: string
  name: string
  description: string
  price: number
  category: 'Kopi' | 'Non-Kopi' | 'Pastry & Kudapan'
  isPopular: boolean
  tags: DemoTag[]
  tagSlugs: string[]
}

export const DEMO_TAGS: Record<string, DemoTag> = {
  // Suasana (Mood)
  santai: { id: 'tag-santai', name: 'Santai', dimension: 'MOOD' },
  fokus: { id: 'tag-fokus', name: 'Fokus', dimension: 'MOOD' },
  segar: { id: 'tag-segar', name: 'Segar', dimension: 'MOOD' },
  // Rasa (Flavor)
  manis: { id: 'tag-manis', name: 'Manis', dimension: 'FLAVOR' },
  pahit_bold: { id: 'tag-pahit-bold', name: 'Pahit & Bold', dimension: 'FLAVOR' },
  creamy: { id: 'tag-creamy', name: 'Creamy Gurih', dimension: 'FLAVOR' },
  asam_segar: { id: 'tag-asam-segar', name: 'Asam Segar', dimension: 'FLAVOR' },
  // Format/Suhu (Format)
  dingin: { id: 'tag-dingin', name: 'Dingin (Es)', dimension: 'FORMAT' },
  panas: { id: 'tag-panas', name: 'Hangat', dimension: 'FORMAT' },
  cemilan: { id: 'tag-cemilan', name: 'Kudapan Pastry', dimension: 'FORMAT' },
}

export const DEMO_MENU_ITEMS: DemoMenuItem[] = [
  {
    id: 'demo-kopi-susu',
    name: 'Kopi Susu Aren',
    description: 'Espresso blend khas berpadu gula aren organik dan susu segar.',
    price: 28000,
    category: 'Kopi',
    isPopular: true,
    tags: [DEMO_TAGS.santai!, DEMO_TAGS.manis!, DEMO_TAGS.creamy!, DEMO_TAGS.dingin!],
    tagSlugs: ['santai', 'manis', 'creamy', 'dingin'],
  },
  {
    id: 'demo-v60',
    name: 'V60 Single Origin Pour Over',
    description: 'Seduhan manual biji arabika pilihan dengan karakter bersih dan hangat.',
    price: 35000,
    category: 'Kopi',
    isPopular: false,
    tags: [DEMO_TAGS.fokus!, DEMO_TAGS.pahit_bold!, DEMO_TAGS.panas!],
    tagSlugs: ['fokus', 'pahit_bold', 'panas'],
  },
  {
    id: 'demo-matcha',
    name: 'Kyoto Matcha Latte',
    description: 'Matcha Uji berpadu susu segar lembut dengan rasa manis seimbang.',
    price: 32000,
    category: 'Non-Kopi',
    isPopular: true,
    tags: [DEMO_TAGS.santai!, DEMO_TAGS.creamy!, DEMO_TAGS.dingin!, DEMO_TAGS.manis!],
    tagSlugs: ['santai', 'creamy', 'dingin', 'manis'],
  },
  {
    id: 'demo-hibiscus',
    name: 'Strawberry Hibiscus Cooler',
    description: 'Seduhan bunga rosella dengan sari stroberi dan es menyegarkan.',
    price: 28000,
    category: 'Non-Kopi',
    isPopular: false,
    tags: [DEMO_TAGS.segar!, DEMO_TAGS.asam_segar!, DEMO_TAGS.dingin!],
    tagSlugs: ['segar', 'asam_segar', 'dingin'],
  },
  {
    id: 'demo-croissant',
    name: 'French Butter Croissant',
    description: 'Pastry berlapis dengan mentega Prancis dan tekstur renyah hangat.',
    price: 26000,
    category: 'Pastry & Kudapan',
    isPopular: true,
    tags: [DEMO_TAGS.santai!, DEMO_TAGS.creamy!, DEMO_TAGS.cemilan!],
    tagSlugs: ['santai', 'creamy', 'cemilan'],
  },
  {
    id: 'demo-cinnamon',
    name: 'Cinnamon Roll Glaze',
    description: 'Roti gulung kayu manis dengan lapisan cream cheese lembut.',
    price: 28000,
    category: 'Pastry & Kudapan',
    isPopular: false,
    tags: [DEMO_TAGS.santai!, DEMO_TAGS.manis!, DEMO_TAGS.cemilan!],
    tagSlugs: ['santai', 'manis', 'cemilan'],
  },
]

export interface DemoQuizStep {
  stepNumber: number
  shortName: 'Suasana' | 'Rasa' | 'Format/Suhu'
  title: string
  subtitle: string
  dimension: 'MOOD' | 'FLAVOR' | 'FORMAT'
  options: Array<{
    id: string
    label: string
    hint: string
    tagSlug: string
  }>
}

export const DEMO_QUIZ_STEPS: DemoQuizStep[] = [
  {
    stepNumber: 1,
    shortName: 'Suasana',
    title: 'Bagaimana suasana kunjungan saat ini?',
    subtitle: 'Langkah 1 dari 3 · Suasana',
    dimension: 'MOOD',
    options: [
      {
        id: 'opt-santai',
        label: 'Santai & Rileks',
        hint: 'Menikmati waktu jeda atau berbincang',
        tagSlug: 'santai',
      },
      {
        id: 'opt-fokus',
        label: 'Fokus Bekerja',
        hint: 'Butuh sajian pendamping konsentrasi',
        tagSlug: 'fokus',
      },
      {
        id: 'opt-segar',
        label: 'Menyegarkan Diri',
        hint: 'Mencari minuman ringan pelepas dahaga',
        tagSlug: 'segar',
      },
    ],
  },
  {
    stepNumber: 2,
    shortName: 'Rasa',
    title: 'Karakter rasa apa yang diinginkan?',
    subtitle: 'Langkah 2 dari 3 · Rasa',
    dimension: 'FLAVOR',
    options: [
      {
        id: 'opt-creamy',
        label: 'Creamy & Gurih',
        hint: 'Tekstur susu lembut atau mentega pastry',
        tagSlug: 'creamy',
      },
      {
        id: 'opt-manis',
        label: 'Manis Lembut',
        hint: 'Gula aren atau manis seimbang',
        tagSlug: 'manis',
      },
      {
        id: 'opt-bold',
        label: 'Pahit & Bold',
        hint: 'Karakter kopi tegas tanpa dominasi gula',
        tagSlug: 'pahit_bold',
      },
      {
        id: 'opt-asam',
        label: 'Asam Segar',
        hint: 'Profil buah dan bunga yang ringan',
        tagSlug: 'asam_segar',
      },
    ],
  },
  {
    stepNumber: 3,
    shortName: 'Format/Suhu',
    title: 'Format atau suhu sajian yang dipilih?',
    subtitle: 'Langkah 3 dari 3 · Format/Suhu',
    dimension: 'FORMAT',
    options: [
      {
        id: 'opt-dingin',
        label: 'Dingin dengan Es',
        hint: 'Minuman es segar',
        tagSlug: 'dingin',
      },
      {
        id: 'opt-panas',
        label: ' Sajian Hangat',
        hint: 'Diseduh hangat',
        tagSlug: 'panas',
      },
      {
        id: 'opt-cemilan',
        label: 'Kudapan / Pastry',
        hint: 'Pendamping kopi dari etalase bake',
        tagSlug: 'cemilan',
      },
    ],
  },
]

export interface DemoRecommendationResult {
  hero: DemoMenuItem
  alternatives: DemoMenuItem[]
  matchedTags: string[]
  matchScore: number
}

/**
 * Algoritma Rekomendasi Deterministik Murni (In-Memory)
 * Bobot kanonis Cravio: Rasa (3 pt) > Format/Suhu (2 pt) > Suasana (1 pt) + Best Seller (+1 pt)
 */
export function calculateDemoRecommendation(
  moodSlug?: string,
  flavorSlug?: string,
  formatSlug?: string
): DemoRecommendationResult {
  const scored = DEMO_MENU_ITEMS.map((item) => {
    let score = 0
    const matched: string[] = []

    if (flavorSlug && item.tagSlugs.includes(flavorSlug)) {
      score += 3
      matched.push(flavorSlug)
    }
    if (formatSlug && item.tagSlugs.includes(formatSlug)) {
      score += 2
      matched.push(formatSlug)
    }
    if (moodSlug && item.tagSlugs.includes(moodSlug)) {
      score += 1
      matched.push(moodSlug)
    }
    if (item.isPopular) {
      score += 1
    }

    return { item, score, matched }
  })

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    if (b.matched.length !== a.matched.length) return b.matched.length - a.matched.length
    if (a.item.isPopular !== b.item.isPopular) return a.item.isPopular ? -1 : 1
    return a.item.name.localeCompare(b.item.name)
  })

  const heroEntry = scored[0] || { item: DEMO_MENU_ITEMS[0]!, score: 1, matched: [] }
  const alternatives = scored.slice(1, 3).map((s) => s.item)

  return {
    hero: heroEntry.item,
    alternatives,
    matchedTags: heroEntry.matched,
    matchScore: heroEntry.score,
  }
}
