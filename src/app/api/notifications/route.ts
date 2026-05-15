import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const isRead = searchParams.get('isRead')
    const type = searchParams.get('type')

    const where: Prisma.NotificationWhereInput = {}

    if (userId) {
      where.userId = userId
    }

    if (isRead !== null && isRead !== undefined) {
      where.isRead = isRead === 'true'
    }

    if (type) {
      where.type = type
    }

    const notifications = await db.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    const unreadCount = await db.notification.count({
      where: {
        ...(userId ? { userId } : {}),
        isRead: false,
      },
    })

    return NextResponse.json({ notifications, unreadCount })
  } catch (error) {
    console.error('[Notifications GET] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { userId, type, title, message, link } = body

    if (!userId || !title || !message) {
      return NextResponse.json(
        { error: 'userId, title, and message are required' },
        { status: 400 }
      )
    }

    const notification = await db.notification.create({
      data: {
        userId,
        type: type || 'system',
        title,
        message,
        link: link || null,
      },
    })

    return NextResponse.json({ notification }, { status: 201 })
  } catch (error) {
    console.error('[Notifications POST] Error:', error)
    return NextResponse.json({ error: 'Failed to create notification' }, { status: 500 })
  }
}
