import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const LOGIN_TIMEOUT_MS = 15000

function timeoutAfter(ms: number) {
  return new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('AUTH_TIMEOUT')), ms)
  })
}

function getSafeErrorMessage(error: unknown) {
  if (error instanceof Error && error.message === 'AUTH_TIMEOUT') {
    return 'The sign-in service is taking too long to respond. Please check your connection and try again.'
  }

  if (isDnsAuthError(error)) {
    return 'KodiFlow cannot reach the configured sign-in service. Please contact support.'
  }

  if (isNetworkAuthError(error)) {
    return 'We could not reach the sign-in service. Please check your connection and try again.'
  }

  return 'Unable to sign in right now. Please try again.'
}

function getErrorText(error: unknown): string {
  if (!error) return ''

  if (error instanceof Error) {
    const cause = 'cause' in error ? getErrorText(error.cause) : ''
    return `${error.message} ${cause}`
  }

  if (typeof error === 'object') {
    const values = Object.values(error as Record<string, unknown>)
    return values.map(getErrorText).join(' ')
  }

  return String(error)
}

function isDnsAuthError(error: unknown) {
  return /enotfound|getaddrinfo|nxdomain|non-existent domain/i.test(getErrorText(error))
}

function isNetworkAuthError(error: unknown) {
  return /fetch|network|request|timeout|econn|dns|getaddrinfo|enotfound/i.test(getErrorText(error))
}

async function wait(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
      return NextResponse.json({ error: 'Please enter your email and password.' }, { status: 400 })
    }

    const supabase = await createClient()
    const credentials = {
      email: email.trim(),
      password,
    }

    const signIn = supabase.auth.signInWithPassword(credentials)

    const { error } = await Promise.race([signIn, timeoutAfter(LOGIN_TIMEOUT_MS)])

    if (error) {
      if (isNetworkAuthError(error)) {
        await wait(750)
        const retry = await Promise.race([
          supabase.auth.signInWithPassword(credentials),
          timeoutAfter(LOGIN_TIMEOUT_MS),
        ])

        if (!retry.error) {
          return NextResponse.json({ ok: true })
        }
      }

      return NextResponse.json(
        {
          error: isDnsAuthError(error)
            ? 'KodiFlow cannot reach the configured sign-in service. Please contact support.'
            : isNetworkAuthError(error)
              ? 'We could not reach the sign-in service. Please check your connection and try again.'
            : error.message,
        },
        { status: 401 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: getSafeErrorMessage(error) }, { status: 503 })
  }
}
