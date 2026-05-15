import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, password, name } = body

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    let user = await db.user.findUnique({ where: { email } })

    if (!user) {
      user = await db.user.create({
        data: {
          email,
          name: name || email.split('@')[0],
          password: password || 'demo-password',
          role: 'agent',
        },
      })
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
    console.error('[Auth Login] Error:', error)
    return NextResponse.json({ error: 'Login failed' }, { status: 500 })
  }
}
