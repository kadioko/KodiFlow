'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Eye, EyeOff } from 'lucide-react'
import { safeLoginDestination } from '@/utils/navigation'

export default function LoginPage() {
  const [mode, setMode] = useState<'owner' | 'staff'>('owner')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [staffId, setStaffId] = useState('')
  const [pin, setPin] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const controller = new AbortController()
      const timeoutId = window.setTimeout(() => controller.abort(), 20000)

      const response = await fetch(mode === 'staff' ? '/api/auth/staff-login' : '/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(mode === 'staff' ? { staffId, pin } : { email, password }),
        signal: controller.signal,
      })
      window.clearTimeout(timeoutId)

      const result = await response.json().catch(() => null)

      if (!response.ok) {
        setError(result?.error || 'Unable to sign in right now. Please try again.')
        return
      }

      const params = new URLSearchParams(window.location.search)
      const nextPath = params.get('next')
      window.location.assign(mode === 'staff' ? '/electricity' : safeLoginDestination(nextPath, window.location.origin))
    } catch (error) {
      setError(
        error instanceof DOMException && error.name === 'AbortError'
          ? 'The sign-in request took too long. Please check your connection and try again.'
          : 'We could not reach KodiFlow sign-in. Please check your connection and try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
      <div className="mb-6 grid grid-cols-2 rounded-lg border border-slate-200 bg-slate-50 p-1" role="group" aria-label="Sign-in type">
        <button type="button" onClick={() => { setMode('owner'); setError('') }} className={`min-h-11 rounded-md px-3 text-sm font-semibold ${mode === 'owner' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>Owner / manager</button>
        <button type="button" onClick={() => { setMode('staff'); setError('') }} className={`min-h-11 rounded-md px-3 text-sm font-semibold ${mode === 'staff' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>Staff ID</button>
      </div>

      <form className="space-y-6" onSubmit={handleLogin}>
        {error && (
          <div className="bg-danger-50 border border-danger-200 text-danger-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {mode === 'owner' ? <>
        <div>
          <label htmlFor="email" className="label">
            Email address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
          />
        </div>

        <div>
          <label htmlFor="password" className="label">
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input pr-12"
            />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-700"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
        </div>
        </> : <>
          <div>
            <label htmlFor="staff-id" className="label">Staff ID</label>
            <input id="staff-id" name="staff-id" type="text" autoComplete="username" autoCapitalize="characters" required value={staffId} onChange={(event) => setStaffId(event.target.value.toUpperCase())} className="input" />
          </div>
          <div>
            <label htmlFor="staff-pin" className="label">PIN</label>
            <input id="staff-pin" name="staff-pin" type="password" inputMode="numeric" pattern="[0-9]{8,12}" autoComplete="current-password" required value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 12))} className="input" />
            <p className="mt-1 text-xs text-slate-500">Enter the 8–12 digit PIN provided by your manager.</p>
          </div>
        </>}

        {mode === 'owner' && <div className="flex items-center justify-between">
          <div className="flex items-center">
            <input
              id="remember-me"
              name="remember-me"
              type="checkbox"
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            />
            <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900">
              Remember me
            </label>
          </div>

          <div className="text-sm">
            <Link href="/auth/forgot-password" className="font-medium text-primary-600 hover:text-primary-500">
              Forgot your password?
            </Link>
          </div>
        </div>}

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full"
        >
          {loading ? 'Signing in...' : mode === 'staff' ? 'Open electricity workspace' : 'Sign in'}
        </button>
      </form>

      {mode === 'owner' && <div className="mt-6">
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">Don't have an account?</span>
          </div>
        </div>

        <div className="mt-6">
          <Link
            href="/auth/register"
            className="btn-secondary w-full"
          >
            Create new account
          </Link>
        </div>
      </div>}
    </div>
  )
}
