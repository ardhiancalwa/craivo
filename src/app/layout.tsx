import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Cravio — Your craving, Perfectly Matched | SELA Artisanal Coffee & Bake',
  description: 'Smart QR Menu, Rekomendasi Selera Deterministik, dan Operasional Kafe Terintegrasi.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#1B1C1A',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="id">
      <body className="min-h-screen font-sans bg-surface text-on-surface antialiased selection:bg-primary/20">
        {children}
      </body>
    </html>
  )
}
