import { NextResponse } from 'next/server'
import { requireStaffRole, AuthError } from '@/lib/server/auth-guard'
import { verifyCsrfOrigin } from '@/lib/server/csrf'
import {
  getAdminQuizConfig,
  updateAdminQuizConfig,
  QuizConfigValidationError,
} from '@/lib/server/quiz-config-service'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const QuizOptionTagInputSchema = z.object({
  tagId: z.string().min(1),
  weight: z.number().int().min(1).max(10),
})

const QuizOptionInputSchema = z.object({
  id: z.string().optional(),
  label: z.string().trim().min(1, 'Label opsi tidak boleh kosong'),
  description: z.string().trim().default(''),
  icon: z.string().trim().optional().nullable(),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
  tags: z.array(QuizOptionTagInputSchema).default([]),
})

const QuizQuestionInputSchema = z.object({
  id: z.string().min(1),
  stepNumber: z.number().int().positive(),
  title: z.string().trim().min(3, 'Judul pertanyaan minimal 3 karakter'),
  description: z.string().trim().default(''),
  dimension: z.enum(['MOOD', 'FLAVOR', 'FORMAT']),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  options: z.array(QuizOptionInputSchema).default([]),
})

const UpdateQuizConfigSchema = z.object({
  questions: z.array(QuizQuestionInputSchema).min(1, 'Daftar pertanyaan tidak boleh kosong'),
})

export async function GET(request: Request) {
  try {
    await requireStaffRole(['ADMIN'], request)
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.code, message: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: 'UNAUTHORIZED', message: 'Akses ditolak.' }, { status: 401 })
  }

  try {
    const config = await getAdminQuizConfig()
    return NextResponse.json({ success: true, data: config })
  } catch (err) {
    console.error('Failed to get quiz config:', err)
    return NextResponse.json(
      { error: 'INTERNAL_SERVER_ERROR', message: 'Gagal memuat konfigurasi kuis.' },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  if (!verifyCsrfOrigin(request)) {
    return NextResponse.json(
      { error: 'CSRF_REJECTED', message: 'Permintaan ditolak: Origin tidak sah.' },
      { status: 403 }
    )
  }

  let staff
  try {
    staff = await requireStaffRole(['ADMIN'], request)
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.code, message: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: 'UNAUTHORIZED', message: 'Akses ditolak.' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'BAD_REQUEST', message: 'Payload JSON tidak valid.' },
      { status: 400 }
    )
  }

  const parsed = UpdateQuizConfigSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  try {
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1'
    const result = await updateAdminQuizConfig(parsed.data, staff, ipAddress)
    return NextResponse.json({ success: true, data: result })
  } catch (err) {
    if (err instanceof QuizConfigValidationError) {
      return NextResponse.json(
        { error: 'INVALID_QUIZ_CONFIG', message: err.message, details: err.errors },
        { status: 400 }
      )
    }
    console.error('Failed to update quiz config:', err)
    return NextResponse.json(
      { error: 'INTERNAL_SERVER_ERROR', message: 'Gagal memperbarui konfigurasi kuis.' },
      { status: 500 }
    )
  }
}

