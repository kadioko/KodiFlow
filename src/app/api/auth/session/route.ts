import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error) {
      return NextResponse.json({ user: null }, { status: 401 })
    }

    return NextResponse.json({ user })
  } catch {
    return NextResponse.json({ user: null }, { status: 503 })
  }
}
