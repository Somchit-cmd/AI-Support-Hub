import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const staff = await db.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        status: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: {
            assignedConversations: true,
            sentMessages: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const staffWithCounts = staff.map((user) => ({
      ...user,
      assignedConversations: user._count.assignedConversations,
      sentMessages: user._count.sentMessages,
      _count: undefined,
    }))

    return NextResponse.json({ staff: staffWithCounts })
  } catch (error) {
    console.error('[Staff GET] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch staff' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, email, password, role, avatar, status, isActive } = body

    if (!name || !email) {
      return NextResponse.json(
        { error: 'name and email are required' },
        { status: 400 }
      )
    }

    // Check if email already exists
    const existing = await db.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: 'Email already exists' }, { status: 400 })
    }

    const user = await db.user.create({
      data: {
        name,
        email,
        password: password || 'demo-password',
        role: role || 'agent',
        avatar: avatar || null,
        status: status || 'offline',
        isActive: isActive !== undefined ? isActive : true,
      },
    })

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
    }, { status: 201 })
  } catch (error) {
    console.error('[Staff POST] Error:', error)
    return NextResponse.json({ error: 'Failed to create staff member' }, { status: 500 })
  }
}
