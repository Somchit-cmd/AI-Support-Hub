import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const channel = searchParams.get('channel')
    const status = searchParams.get('status')
    const search = searchParams.get('search')
    const aiMode = searchParams.get('aiMode')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const where: Prisma.ConversationWhereInput = {}

    if (channel) {
      where.channel = { type: channel }
    }

    if (status) {
      where.status = status
    }

    if (aiMode) {
      where.aiMode = aiMode
    }

    if (search) {
      where.OR = [
        { subject: { contains: search } },
        { lastMessage: { contains: search } },
        { customer: { name: { contains: search } } },
        { customer: { email: { contains: search } } },
      ]
    }

    const [conversations, total] = await Promise.all([
      db.conversation.findMany({
        where,
        include: {
          customer: { include: { tags: true } },
          channel: true,
          assignedTo: { select: { id: true, name: true, email: true, avatar: true, role: true, status: true } },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        orderBy: [
          { isPinned: 'desc' },
          { lastMessageAt: 'desc' },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.conversation.count({ where }),
    ])

    return NextResponse.json({
      conversations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('[Conversations GET] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch conversations' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { customerId, channelId, subject, aiMode, priority, assignedToId } = body

    if (!customerId || !channelId) {
      return NextResponse.json(
        { error: 'customerId and channelId are required' },
        { status: 400 }
      )
    }

    const conversation = await db.conversation.create({
      data: {
        customerId,
        channelId,
        subject: subject || null,
        aiMode: aiMode || 'suggest',
        priority: priority || 'normal',
        assignedToId: assignedToId || null,
      },
      include: {
        customer: { include: { tags: true } },
        channel: true,
        assignedTo: { select: { id: true, name: true, email: true, avatar: true, role: true, status: true } },
      },
    })

    return NextResponse.json({ conversation }, { status: 201 })
  } catch (error) {
    console.error('[Conversations POST] Error:', error)
    return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 })
  }
}
