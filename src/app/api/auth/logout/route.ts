import { NextResponse } from 'next/server'

export async function POST() {
  try {
    // In a real app, we'd clear the session/cookie here
    return NextResponse.json({ message: 'Logged out successfully' })
  } catch (error) {
    console.error('[Auth Logout] Error:', error)
    return NextResponse.json({ error: 'Logout failed' }, { status: 500 })
  }
}
