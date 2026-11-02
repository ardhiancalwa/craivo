import { redirect } from 'next/navigation'

interface PageProps {
  searchParams: Promise<{ table?: string }>
}

export default async function OrderQuizRedirectPage({ searchParams }: PageProps) {
  const params = await searchParams
  const table = params.table ? `?table=${encodeURIComponent(params.table)}` : ''
  redirect(`/quiz${table}`)
}

