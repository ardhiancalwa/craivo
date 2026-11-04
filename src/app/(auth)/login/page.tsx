'use client'

import * as React from 'react'
import { Suspense } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { Lock, User, Eye, EyeOff, AlertCircle, ArrowRight, CheckCircle2, ShieldCheck } from 'lucide-react'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectParam = searchParams.get('redirect')

  const [username, setUsername] = React.useState('')
  const [pinOrPassword, setPinOrPassword] = React.useState('')
  const [showPassword, setShowPassword] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const [successRole, setSuccessRole] = React.useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !pinOrPassword.trim()) {
      setErrorMessage('Mohon isi Username dan PIN/Password.')
      return
    }

    setIsLoading(true)
    setErrorMessage(null)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: username.trim(),
          pinOrPassword: pinOrPassword.trim(),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setErrorMessage(data.message || 'Username atau PIN/Password tidak sesuai.')
        setIsLoading(false)
        return
      }

      const role = data.user?.role as string | undefined
      setSuccessRole(role || 'STAFF')

      // Resolve redirect destination
      let destination = '/staff/admin'
      if (redirectParam && redirectParam.startsWith('/') && !redirectParam.startsWith('//')) {
        destination = redirectParam
      } else if (role === 'CASHIER') {
        destination = '/staff/pos'
      } else if (role === 'BARISTA') {
        destination = '/staff/kds'
      } else if (role === 'ADMIN') {
        destination = '/staff/admin'
      }

      setTimeout(() => {
        router.push(destination)
        router.refresh()
      }, 400)
    } catch {
      setErrorMessage('Terjadi kendala jaringan saat menghubungi server autentikasi.')
      setIsLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-[#FBF9F5] selection:bg-sand-300 selection:text-charcoal-950 font-sans">
      <div className="w-full max-w-md bg-white p-7 sm:p-9 rounded-3xl border border-sand-200/90 shadow-[0_20px_50px_rgba(0,0,0,0.06)] space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center p-2 rounded-2xl bg-[#FAF8F5] border border-sand-200 shadow-2xs mb-1">
            <Image
              src="/logo/only-logo.jpeg"
              alt="Cravio Logo"
              width={40}
              height={40}
              className="h-10 w-10 rounded-xl object-contain"
              priority
            />
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-charcoal-950">
            Login Portal Staf
          </h1>
          <p className="text-xs text-stone-500 font-normal">
            Akses operasional resmi Admin, Kasir POS, dan Dapur KDS Cravio
          </p>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div
            role="alert"
            className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs leading-relaxed"
          >
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
            <div>{errorMessage}</div>
          </div>
        )}

        {/* Success Alert */}
        {successRole && (
          <div className="flex items-center gap-2 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>Autentikasi berhasil! Mengalihkan ke portal {successRole}...</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="staff-username"
              className="block text-xs font-semibold text-charcoal-950"
            >
              Username
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                <User className="h-4 w-4" />
              </span>
              <input
                id="staff-username"
                type="text"
                name="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin / kasir / barista"
                required
                disabled={isLoading || Boolean(successRole)}
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-sand-200/90 bg-sand-50/40 text-sm text-charcoal-950 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-terracotta-500 focus:bg-white transition-all disabled:opacity-60"
                autoComplete="username"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="staff-pin-password"
                className="block text-xs font-semibold text-charcoal-950"
              >
                PIN atau Password
              </label>
              <span className="text-[11px] font-mono text-stone-400">
                PIN 4 digit / Password Admin
              </span>
            </div>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                <Lock className="h-4 w-4" />
              </span>
              <input
                id="staff-pin-password"
                type={showPassword ? 'text' : 'password'}
                name="pinOrPassword"
                value={pinOrPassword}
                onChange={(e) => setPinOrPassword(e.target.value)}
                placeholder="Masukkan PIN atau password"
                required
                disabled={isLoading || Boolean(successRole)}
                className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-sand-200/90 bg-sand-50/40 text-sm text-charcoal-950 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-terracotta-500 focus:bg-white transition-all disabled:opacity-60"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-stone-400 hover:text-charcoal-950 cursor-pointer"
                aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || Boolean(successRole)}
            className="touch-target w-full py-3 px-4 rounded-full bg-charcoal-950 hover:bg-charcoal-800 active:scale-98 text-white font-semibold text-xs tracking-wide transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed mt-2"
          >
            {isLoading ? (
              <>
                <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                <span>Memverifikasi Sesi...</span>
              </>
            ) : (
              <>
                <span>Masuk Portal Staf</span>
                <ArrowRight className="h-3.5 w-3.5 text-stone-300" />
              </>
            )}
          </button>
        </form>

        {/* Security Micro-footer */}
        <div className="pt-2 border-t border-sand-200/60 flex items-center justify-between text-xs text-stone-500 font-mono">
          <span className="flex items-center gap-1 text-[11px]">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            JWT HttpOnly Guarded
          </span>
          <Link
            href="/"
            className="text-[11px] text-terracotta-600 hover:text-terracotta-700 hover:underline transition-colors font-sans font-medium"
          >
            ← Beranda B2B
          </Link>
        </div>
      </div>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center p-6 bg-[#FBF9F5]">
          <div className="w-full max-w-md bg-white p-8 rounded-3xl border border-sand-200 shadow-sm text-center font-mono text-xs text-stone-500">
            Memuat portal login...
          </div>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  )
}
