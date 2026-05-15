import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    // For demo, return the first admin user
    let user = await db.user.findFirst({ where: { role: 'admin' } })

    if (!user) {
      // Fallback to first user if no admin exists
      user = await db.user.findFirst()
    }

    if (!user) {
      return NextResponse.json({ error: 'No users found' }, { status: 404 })
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatar: user.avatar,
        status: user.status,
        isActive: user.isActive,
      },
    })
  } catch (error) {
    console.error('[Auth Me] Error:', error)
    return NextResponse.json({ error: 'Failed to get current user' }, { status: 500 })
  }
}
