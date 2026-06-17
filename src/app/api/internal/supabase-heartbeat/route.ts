import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function getErrorText(error: unknown): string {
  if (!error) return ''

  if (error instanceof Error) {
    const cause = getErrorText((error as Error & { cause?: unknown }).cause)
    return `${error.message} ${cause}`.trim()
  }

  if (typeof error === 'object') {
    return Object.values(error as Record<string, unknown>).map(getErrorText).join(' ')
  }

  return String(error)
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  const authorization = request.headers.get('authorization')

  if (cronSecret && authorization !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const supabaseKey = serviceRoleKey || anonKey

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      { ok: false, error: 'Supabase heartbeat is missing environment variables.' },
      { status: 500 }
    )
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })

    const { error, count } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .limit(1)

    if (error) {
      return NextResponse.json(
        { ok: false, error: 'Supabase heartbeat query failed.' },
        { status: 503 }
      )
    }

    return NextResponse.json({
      ok: true,
      checkedAt: new Date().toISOString(),
      profileCount: count ?? 0,
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Supabase heartbeat could not reach the project.',
        details: getErrorText(error),
      },
      { status: 503 }
    )
  }
}
