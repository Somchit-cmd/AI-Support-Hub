import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const channels = await db.channel.findMany({
      include: {
        _count: { select: { conversations: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    const channelsWithCount = channels.map((channel) => ({
      ...channel,
      conversationCount: channel._count.conversations,
      _count: undefined,
    }))

    return NextResponse.json({ channels: channelsWithCount })
  } catch (error) {
    console.error('[Channels GET] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch channels' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { type, name, config, isActive } = body

    if (!type || !name) {
      return NextResponse.json(
        { error: 'type and name are required' },
        { status: 400 }
      )
    }

    const channel = await db.channel.create({
      data: {
        type,
        name,
        config: config ? JSON.stringify(config) : '{}',
        isActive: isActive !== undefined ? isActive : true,
      },
    })

    return NextResponse.json({ channel }, { status: 201 })
  } catch (error) {
    console.error('[Channels POST] Error:', error)
    return NextResponse.json({ error: 'Failed to create channel' }, { status: 500 })
  }
}
