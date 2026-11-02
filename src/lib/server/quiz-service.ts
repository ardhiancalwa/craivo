import 'server-only'
import { prisma } from './db'
import {
  calculateRecommendations,
  CandidateMenuItem,
  CandidateTag,
  SelectedOptionWeight,
  RecommendationResponse,
  TagDimension,
} from '@/lib/recommendation-engine'

export interface QuizOptionDTO {
  id: string
  label: string
  description: string
  icon: string | null
  sortOrder: number
  tagSlugs: string[]
}

export interface QuizQuestionDTO {
  id: string
  stepNumber: number
  title: string
  description: string
  dimension: TagDimension
  options: QuizOptionDTO[]
}

export interface QuizResponseDTO {
  quizVersion: number
  questions: QuizQuestionDTO[]
}

/**
 * Mengambil daftar pertanyaan dan opsi kuis 3 langkah aktif dari database.
 * Diurutkan berdasarkan nomor langkah (stepNumber) dan sortOrder opsi.
 */
export async function getQuizQuestions(): Promise<QuizResponseDTO> {
  const [cravioConfig, questions] = await Promise.all([
    prisma.cravioConfig.findUnique({ where: { id: 'cravio-main-config' } }),
    prisma.quizQuestion.findMany({
      where: { isActive: true },
      orderBy: { stepNumber: 'asc' },
      include: {
        options: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
          include: {
            optionTags: {
              include: {
                tag: true,
              },
            },
          },
        },
      },
    }),
  ])

  return {
    quizVersion: cravioConfig?.quizVersion ?? 1,
    questions: questions.map((q) => ({
      id: q.id,
      stepNumber: q.stepNumber,
      title: q.title,
      description: q.description,
      dimension: q.dimension as TagDimension,
      options: q.options.map((opt) => ({
        id: opt.id,
        label: opt.label,
        description: opt.description,
        icon: opt.icon,
        sortOrder: opt.sortOrder,
        tagSlugs: opt.optionTags.map((ot) => ot.tag.slug),
      })),
    })),
  }
}

/**
 * Mengambil data rekomendasi menu berdasarkan ID opsi kuis yang dipilih pelanggan.
 * Membaca bobot relasional dari database dan mengeksekusi pure recommendation engine.
 * Menangani transisi konfigurasi secara tangguh (graceful fallback) jika opsi diubah saat kuis berlangsung.
 */
export async function getQuizRecommendations(
  selectedOptionIds: string[],
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  clientQuizVersion?: number
): Promise<RecommendationResponse & { currentQuizVersion: number }> {
  const cravioConfig = await prisma.cravioConfig.findUnique({
    where: { id: 'cravio-main-config' },
  })
  const currentQuizVersion = cravioConfig?.quizVersion ?? 1

  // 1. Ambil pemetaan bobot dari database berdasarkan opsi yang dipilih (hanya opsi yang masih aktif)
  const optionTags = await prisma.quizOptionTag.findMany({
    where: {
      optionId: {
        in: selectedOptionIds || [],
      },
      option: {
        isActive: true,
      },
    },
    include: {
      tag: true,
    },
  })

  const selectedWeights: SelectedOptionWeight[] = optionTags.map((ot) => ({
    optionId: ot.optionId,
    tagId: ot.tagId,
    tagSlug: ot.tag.slug,
    tagName: ot.tag.name,
    dimension: ot.tag.dimension as TagDimension,
    weight: ot.weight,
  }))

  // 2. Ambil seluruh menu item aktif dari database
  // Catatan: isArchived: false dan isAvailable: true
  // soldCount yang diambil adalah nilai pesanan lunas di tabel database
  const dbMenuItems = await prisma.menuItem.findMany({
    where: {
      isArchived: false,
    },
    include: {
      category: true,
      tags: {
        include: {
          tag: true,
        },
      },
      modifierGroups: {
        include: {
          group: {
            include: {
              options: {
                orderBy: { price: 'asc' },
              },
            },
          },
        },
      },
    },
  })

  // 3. Transformasi model database menjadi CandidateMenuItem untuk engine murni
  const candidateItems: CandidateMenuItem[] = dbMenuItems.map((item) => {
    const candidateTags: CandidateTag[] = item.tags.map((it) => ({
      id: it.tag.id,
      slug: it.tag.slug,
      name: it.tag.name,
      dimension: it.tag.dimension as TagDimension,
    }))

    const modifierGroups = item.modifierGroups.map((mg) => ({
      id: mg.group.id,
      name: mg.group.name,
      isRequired: mg.group.isRequired,
      minSelect: mg.group.minSelect,
      maxSelect: mg.group.maxSelect,
      options: mg.group.options.map((opt) => ({
        id: opt.id,
        groupId: opt.groupId,
        name: opt.name,
        price: opt.price,
        isAvailable: opt.isAvailable,
      })),
    }))

    return {
      id: item.id,
      name: item.name,
      description: item.description,
      price: item.price,
      image: item.image,
      categoryId: item.categoryId,
      categoryName: item.category.name,
      categorySlug: item.category.slug,
      isAvailable: item.isAvailable,
      isPopular: item.isPopular,
      soldCount: item.soldCount,
      isArchived: item.isArchived,
      tags: candidateTags,
      modifierGroups,
    }
  })

  // 4. Jalankan pure deterministic recommendation engine
  const result = calculateRecommendations({
    menuItems: candidateItems,
    selectedOptionWeights: selectedWeights,
  })

  return {
    ...result,
    currentQuizVersion,
  }
}

