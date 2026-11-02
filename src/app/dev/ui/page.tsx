import { notFound } from 'next/navigation'
import DevUiClientShowcase from './client-showcase'

export const metadata = {
  title: 'Dev UI Showcase — Cravio Design System',
  description: 'Galeri komponen antarmuka terisolasi untuk verifikasi token, aksesibilitas, dan breakpoint.',
}

export default function DevUiPage() {
  // CRITICAL SECURITY GUARD: Block access completely in production environments
  if (process.env.NODE_ENV === 'production') {
    notFound()
  }

  return <DevUiClientShowcase />
}

