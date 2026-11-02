import 'server-only'
import prisma from './db'
import { publishEvent } from './realtime-bus'
import type { StaffUser, TagDimension } from '@prisma/client'

export interface AdminQuizOptionTagInput {
  tagId: string
  weight: number
}

export interface AdminQuizOptionInput {
  id?: string
  label: string
  description: string
  icon?: string | null
  sortOrder: number
  isActive: boolean
  tags: AdminQuizOptionTagInput[]
}

export interface AdminQuizQuestionInput {
  id: string
  stepNumber: number
  title: string
  description: string
  dimension: TagDimension
  isActive: boolean
  sortOrder: number
  options: AdminQuizOptionInput[]
}

export interface UpdateQuizConfigPayload {
  questions: AdminQuizQuestionInput[]
}

export interface AdminQuizOptionDTO {
  id: string
  label: string
  description: string
  icon: string | null
  sortOrder: number
  isActive: boolean
  tags: Array<{
    id: string
    tagId: string
    tagName: string
    tagSlug: string
    weight: number
  }>
}

export interface AdminQuizQuestionDTO {
  id: string
  stepNumber: number
  title: string
  description: string
  dimension: TagDimension
  isActive: boolean
  sortOrder: number
  options: AdminQuizOptionDTO[]
}

export interface AdminQuizConfigResponse {
  quizVersion: number
  questions: AdminQuizQuestionDTO[]
  availableTags: Array<{
    id: string
    name: string
    slug: string
    dimension: TagDimension
  }>
}

export class QuizConfigValidationError extends Error {
  errors: string[]

  constructor(errors: string[]) {
    super(`Konfigurasi kuis tidak valid: ${errors.join('; ')}`)
    this.name = 'QuizConfigValidationError'
    this.errors = errors
  }
}

/**
 * Validasi ketat konfigurasi kuis untuk mencegah kondisi crash atau recommendation breakdown.
 */
export function validateQuizConfig(payload: UpdateQuizConfigPayload): void {
  const errors: string[] = []

  if (!payload.questions || !Array.isArray(payload.questions)) {
    throw new QuizConfigValidationError(['Daftar pertanyaan kuis wajib berupa array.'])
  }

  const activeQuestions = payload.questions.filter((q) => q.isActive)

  // Baseline SELA: Wajib memiliki minimal 3 langkah aktif (MOOD, FLAVOR, FORMAT)
  if (activeQuestions.length < 3) {
    errors.push(
      `Kuis harus memiliki minimal 3 langkah pertanyaan aktif (saat ini aktif: ${activeQuestions.length}).`
    )
  }

  const stepNumbers = new Set<number>()

  for (const q of payload.questions) {
    if (!q.title || q.title.trim().length < 3) {
      errors.push(`Pertanyaan langkah ${q.stepNumber}: Judul pertanyaan minimal 3 karakter.`)
    }

    if (q.isActive) {
      if (stepNumbers.has(q.stepNumber)) {
        errors.push(`Nomor langkah kuis ${q.stepNumber} terduplikasi pada pertanyaan aktif.`)
      }
      stepNumbers.add(q.stepNumber)

      const activeOptions = q.options ? q.options.filter((o) => o.isActive) : []

      if (activeOptions.length < 2) {
        errors.push(
          `Pertanyaan langkah ${q.stepNumber} ("${q.title}") harus memiliki minimal 2 opsi aktif agar dapat dipilih pelanggan.`
        )
      }

      for (const opt of activeOptions) {
        if (!opt.label || opt.label.trim().length === 0) {
          errors.push(`Pertanyaan langkah ${q.stepNumber}: Terdapat opsi tanpa label teks.`)
        }

        if (!opt.tags || opt.tags.length === 0) {
          errors.push(
            `Pertanyaan langkah ${q.stepNumber}, opsi "${opt.label}": Wajib memetakan minimal 1 tag preferensi agar kuis dapat memberikan skor rekomendasi.`
          )
        } else {
          for (const t of opt.tags) {
            if (!Number.isInteger(t.weight) || t.weight < 1 || t.weight > 10) {
              errors.push(
                `Pertanyaan langkah ${q.stepNumber}, opsi "${opt.label}": Bobot tag harus bilangan bulat antara 1 hingga 10.`
              )
            }
          }
        }
      }
    }
  }

  if (errors.length > 0) {
    throw new QuizConfigValidationError(errors)
  }
}

/**
 * Mengambil konfigurasi lengkap kuis admin beserta daftar master tag.
 */
export async function getAdminQuizConfig(): Promise<AdminQuizConfigResponse> {
  const [cravioConfig, questions, tags] = await Promise.all([
    prisma.cravioConfig.findUnique({ where: { id: 'cravio-main-config' } }),
    prisma.quizQuestion.findMany({
      orderBy: { stepNumber: 'asc' },
      include: {
        options: {
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
    prisma.tag.findMany({
      orderBy: [{ dimension: 'asc' }, { name: 'asc' }],
    }),
  ])

  const quizVersion = cravioConfig?.quizVersion ?? 1

  const questionsDto: AdminQuizQuestionDTO[] = questions.map((q) => ({
    id: q.id,
    stepNumber: q.stepNumber,
    title: q.title,
    description: q.description,
    dimension: q.dimension,
    isActive: q.isActive,
    sortOrder: q.sortOrder,
    options: q.options.map((opt) => ({
      id: opt.id,
      label: opt.label,
      description: opt.description,
      icon: opt.icon,
      sortOrder: opt.sortOrder,
      isActive: opt.isActive,
      tags: opt.optionTags.map((ot) => ({
        id: ot.id,
        tagId: ot.tagId,
        tagName: ot.tag.name,
        tagSlug: ot.tag.slug,
        weight: ot.weight,
      })),
    })),
  }))

  return {
    quizVersion,
    questions: questionsDto,
    availableTags: tags.map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      dimension: t.dimension,
    })),
  }
}

/**
 * Menyimpan pembaruan konfigurasi kuis secara atomik, menaikkan quizVersion,
 * dan mencatat audit log.
 */
export async function updateAdminQuizConfig(
  payload: UpdateQuizConfigPayload,
  actor: StaffUser,
  ipAddress?: string | null
): Promise<{ success: boolean; newQuizVersion: number }> {
  // 1. Validasi konfigurasi
  validateQuizConfig(payload)

  // 2. Transaksi Prisma Atomik
  const newVersion = await prisma.$transaction(async (tx) => {
    // A. Update pertanyaan dan opsi
    for (const qInput of payload.questions) {
      await tx.quizQuestion.update({
        where: { id: qInput.id },
        data: {
          title: qInput.title.trim(),
          description: qInput.description.trim(),
          isActive: qInput.isActive,
          sortOrder: qInput.sortOrder,
        },
      })

      // Proses opsi
      for (const optInput of qInput.options) {
        let optionId = optInput.id

        if (optionId && !optionId.startsWith('temp-')) {
          // Update opsi yang ada
          await tx.quizOption.update({
            where: { id: optionId },
            data: {
              label: optInput.label.trim(),
              description: optInput.description.trim(),
              icon: optInput.icon?.trim() || null,
              sortOrder: optInput.sortOrder,
              isActive: optInput.isActive,
            },
          })
        } else {
          // Buat opsi baru
          const newOpt = await tx.quizOption.create({
            data: {
              questionId: qInput.id,
              label: optInput.label.trim(),
              description: optInput.description.trim(),
              icon: optInput.icon?.trim() || null,
              sortOrder: optInput.sortOrder,
              isActive: optInput.isActive,
            },
          })
          optionId = newOpt.id
        }

        // Sinkronisasi tag mapping: hapus relasi lama pada opsi ini, lalu masukkan yang baru
        await tx.quizOptionTag.deleteMany({
          where: { optionId },
        })

        if (optInput.tags && optInput.tags.length > 0) {
          await tx.quizOptionTag.createMany({
            data: optInput.tags.map((t) => ({
              optionId,
              tagId: t.tagId,
              weight: t.weight,
            })),
          })
        }
      }
    }

    // B. Naikkan versi kuis di CravioConfig
    const updatedConfig = await tx.cravioConfig.update({
      where: { id: 'cravio-main-config' },
      data: {
        quizVersion: {
          increment: 1,
        },
      },
    })

    // C. Catat Audit Log
    await tx.auditLog.create({
      data: {
        staffUserId: actor.id,
        action: 'QUIZ_CONFIG_UPDATED',
        details: JSON.stringify({
          actor: actor.username,
          role: actor.role,
          newQuizVersion: updatedConfig.quizVersion,
          questionCount: payload.questions.length,
          activeQuestionCount: payload.questions.filter((q) => q.isActive).length,
        }),
        ipAddress: ipAddress || '127.0.0.1',
      },
    })

    return updatedConfig.quizVersion
  })

  // 3. Publikasikan event realtime
  await publishEvent({
    channel: 'CATALOG',
    aggregateType: 'QUIZ',
    aggregateId: 'quiz-config',
    eventType: 'QUIZ_CONFIG_UPDATED',
    payload: {
      newQuizVersion: newVersion,
    },
  })

  return {
    success: true,
    newQuizVersion: newVersion,
  }
}

