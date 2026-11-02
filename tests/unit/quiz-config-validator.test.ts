import { describe, it, expect } from 'vitest'
import {
  validateQuizConfig,
  QuizConfigValidationError,
  type UpdateQuizConfigPayload,
} from '@/lib/server/quiz-config-service'

describe('Unit: Quiz Config Validator (Anti-Crash & Integrity Guard)', () => {
  const validPayload: UpdateQuizConfigPayload = {
    questions: [
      {
        id: 'q1',
        stepNumber: 1,
        title: 'Langkah 1: Suasana Hati',
        description: 'Bagaimana suasana hatimu saat ini?',
        dimension: 'MOOD',
        isActive: true,
        sortOrder: 0,
        options: [
          {
            id: 'opt1',
            label: 'Butuh Semangat',
            description: 'Butuh dorongan energi',
            sortOrder: 0,
            isActive: true,
            tags: [{ tagId: 'tag-energetic', weight: 8 }],
          },
          {
            id: 'opt2',
            label: 'Santai & Tenang',
            description: 'Ingin relaksasi',
            sortOrder: 1,
            isActive: true,
            tags: [{ tagId: 'tag-comforting', weight: 7 }],
          },
        ],
      },
      {
        id: 'q2',
        stepNumber: 2,
        title: 'Langkah 2: Profil Rasa',
        description: 'Rasa apa yang kamu inginkan?',
        dimension: 'FLAVOR',
        isActive: true,
        sortOrder: 1,
        options: [
          {
            id: 'opt3',
            label: 'Manis Gurih',
            description: 'Karamel dan susu gurih',
            sortOrder: 0,
            isActive: true,
            tags: [{ tagId: 'tag-sweet', weight: 9 }],
          },
          {
            id: 'opt4',
            label: 'Segar Buah',
            description: 'Asam buah segar',
            sortOrder: 1,
            isActive: true,
            tags: [{ tagId: 'tag-fruity', weight: 8 }],
          },
        ],
      },
      {
        id: 'q3',
        stepNumber: 3,
        title: 'Langkah 3: Format Minuman',
        description: 'Suhu dan tekstur yang pas?',
        dimension: 'FORMAT',
        isActive: true,
        sortOrder: 2,
        options: [
          {
            id: 'opt5',
            label: 'Dingin & Segar (Iced)',
            description: 'Penyegar dahaga',
            sortOrder: 0,
            isActive: true,
            tags: [{ tagId: 'tag-iced', weight: 10 }],
          },
          {
            id: 'opt6',
            label: 'Hangat & Nyaman (Hot)',
            description: 'Hangat di tenggorokan',
            sortOrder: 1,
            isActive: true,
            tags: [{ tagId: 'tag-hot', weight: 6 }],
          },
        ],
      },
    ],
  }

  const q1 = validPayload.questions[0]!
  const q2 = validPayload.questions[1]!
  const q3 = validPayload.questions[2]!
  const opt1 = q1.options[0]!
  const opt2 = q1.options[1]!

  it('meloloskan konfigurasi kuis yang memenuhi baseline 3 langkah dan tag valid', () => {
    expect(() => validateQuizConfig(validPayload)).not.toThrow()
  })

  it('menolak konfigurasi jika payload bukan array pertanyaan', () => {
    expect(() => validateQuizConfig({} as unknown as UpdateQuizConfigPayload)).toThrow(
      QuizConfigValidationError
    )
  })

  it('menolak konfigurasi dengan kurang dari 3 langkah pertanyaan aktif', () => {
    const invalidPayload: UpdateQuizConfigPayload = {
      questions: [
        { ...q1, isActive: true },
        { ...q2, isActive: true },
        { ...q3, isActive: false }, // Hanya 2 yang aktif
      ],
    }

    expect(() => validateQuizConfig(invalidPayload)).toThrow(QuizConfigValidationError)
    try {
      validateQuizConfig(invalidPayload)
    } catch (err) {
      const error = err as QuizConfigValidationError
      expect(error.errors.some((e) => e.includes('minimal 3 langkah pertanyaan aktif'))).toBe(true)
    }
  })

  it('menolak pertanyaan aktif yang memiliki kurang dari 2 opsi jawaban aktif', () => {
    const invalidPayload: UpdateQuizConfigPayload = {
      questions: [
        {
          ...q1,
          options: [
            opt1,
            { ...opt2, isActive: false }, // Hanya 1 opsi aktif
          ],
        },
        q2,
        q3,
      ],
    }

    expect(() => validateQuizConfig(invalidPayload)).toThrow(QuizConfigValidationError)
    try {
      validateQuizConfig(invalidPayload)
    } catch (err) {
      const error = err as QuizConfigValidationError
      expect(error.errors.some((e) => e.includes('minimal 2 opsi aktif'))).toBe(true)
    }
  })

  it('menolak opsi yang tidak memiliki pemetaan tag (0 tags)', () => {
    const invalidPayload: UpdateQuizConfigPayload = {
      questions: [
        {
          ...q1,
          options: [
            { ...opt1, tags: [] }, // 0 tags
            opt2,
          ],
        },
        q2,
        q3,
      ],
    }

    expect(() => validateQuizConfig(invalidPayload)).toThrow(QuizConfigValidationError)
    try {
      validateQuizConfig(invalidPayload)
    } catch (err) {
      const error = err as QuizConfigValidationError
      expect(error.errors.some((e) => e.includes('minimal 1 tag'))).toBe(true)
    }
  })

  it('menolak bobot tag di luar rentang 1 s/d 10 (misal 0 atau 15)', () => {
    const invalidPayload: UpdateQuizConfigPayload = {
      questions: [
        {
          ...q1,
          options: [
            {
              ...opt1,
              tags: [{ tagId: 'tag-energetic', weight: 15 }], // Out of bounds
            },
            opt2,
          ],
        },
        q2,
        q3,
      ],
    }

    expect(() => validateQuizConfig(invalidPayload)).toThrow(QuizConfigValidationError)
    try {
      validateQuizConfig(invalidPayload)
    } catch (err) {
      const error = err as QuizConfigValidationError
      expect(error.errors.some((e) => e.includes('antara 1 hingga 10'))).toBe(true)
    }
  })
})
