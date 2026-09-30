'use client'

import Link from 'next/link'
import { FormEvent, useEffect, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [checking, setChecking] = useState(true)
  const [sessionReady, setSessionReady] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    let active = true

    const confirmRecoverySession = async () => {
      const { data, error: sessionError } = await supabase.auth.getSession()
      if (!active) return
      if (sessionError || !data.session) {
        setError('This password reset link is invalid or has expired. Request a new link to continue.')
      } else {
        setSessionReady(true)
      }
      setChecking(false)
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return
      if (event === 'PASSWORD_RECOVERY' && session) {
        setSessionReady(true)
        setError('')
        setChecking(false)
      }
    })

    confirmRecoverySession()
    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!sessionReady || loading) return
    setError('')
    if (password.length < 8) {
      setError('Use at least 8 characters for your new password.')
      return
    }
    if (password !== confirmPassword) {
      setError('The passwords do not match.')
      return
    }

    setLoading(true)
    try {
      const { error: updateError } = await createClient().auth.updateUser({ password })
      if (updateError) setError(updateError.message)
      else setSuccess(true)
    } catch {
      setError('Could not update your password. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return <div className="bg-white px-4 py-8 shadow sm:rounded-lg sm:px-10"><div className="text-center"><h1 className="text-xl font-semibold text-slate-950">Password updated</h1><p className="mt-2 text-sm text-slate-600">Your KodiFlow password has been changed.</p><Link href="/auth/login" className="btn-primary mt-6 w-full">Sign in</Link></div></div>
  }

  return (
    <div className="bg-white px-4 py-8 shadow sm:rounded-lg sm:px-10">
      <form className="space-y-6" onSubmit={handleSubmit}>
        <div>
          <h1 className="text-xl font-semibold text-slate-950">Set a new password</h1>
          <p className="mt-1 text-sm text-slate-600">Choose a new password for your KodiFlow account.</p>
        </div>
        {error && <div role="alert" className="rounded-lg border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">{error}</div>}
        <div className="form-group">
          <label htmlFor="new-password" className="label">New password</label>
          <div className="relative">
            <input id="new-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" className="input pr-12" value={password} onChange={(event) => setPassword(event.target.value)} disabled={checking || loading} minLength={8} required />
            <button type="button" onClick={() => setShowPassword((current) => !current)} className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-700" aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button>
          </div>
        </div>
        <label className="form-group">
          <span className="label">Confirm new password</span>
          <input type={showPassword ? 'text' : 'password'} autoComplete="new-password" className="input" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} disabled={checking || loading} minLength={8} required />
        </label>
        <button type="submit" disabled={checking || loading || !sessionReady} className="btn-primary w-full">{checking ? 'Checking reset link...' : loading ? 'Updating password...' : 'Update password'}</button>
        <div className="text-center"><Link href="/auth/forgot-password" className="text-sm font-medium text-primary-600 hover:text-primary-500">Request a new link</Link></div>
      </form>
    </div>
  )
}
