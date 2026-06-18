import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { dispatchToChannel } from '@/lib/channels'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    const conversation = await db.conversation.findUnique({ where: { id } })
    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    const [messages, total] = await Promise.all([
      db.message.findMany({
        where: { conversationId: id },
        orderBy: { createdAt: 'asc' },
        include: {
          sender: { select: { id: true, name: true, avatar: true } },
        },
        skip: offset,
        take: limit,
      }),
      db.message.count({ where: { conversationId: id } }),
    ])

    return NextResponse.json({
      messages,
      pagination: {
        limit,
        offset,
        total,
        hasMore: offset + limit < total,
      },
    })
  } catch (error) {
    console.error('[Messages GET] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { content, senderType, senderId, contentType, metadata, isInternal } = body

    if (!content) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 })
    }

    const conversation = await db.conversation.findUnique({ where: { id } })
    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    const message = await db.message.create({
      data: {
        conversationId: id,
        content,
        senderType: senderType || 'agent',
        senderId: senderId || null,
        contentType: contentType || 'text',
        metadata: metadata ? JSON.stringify(metadata) : '{}',
        isInternal: isInternal || false,
      },
      include: {
        sender: { select: { id: true, name: true, avatar: true } },
      },
    })

    // Update conversation's lastMessage and lastMessageAt
    await db.conversation.update({
      where: { id },
      data: {
        lastMessage: content,
        lastMessageAt: new Date(),
      },
    })

    // Deliver to the external channel (Facebook/WhatsApp).
    // Only outbound, non-internal messages from agent/ai need delivery.
    // Fire-and-forget so a channel failure doesn't roll back the saved message.
    const shouldDeliver =
      !isInternal && (senderType === 'agent' || senderType === undefined || senderType === 'ai')
    if (shouldDeliver) {
      dispatchToChannel(id, content, { existingMessageId: message.id }).catch((err) => {
        console.error('[Messages POST] Channel dispatch failed:', err)
      })
    }

    return NextResponse.json({ message }, { status: 201 })
  } catch (error) {
    console.error('[Messages POST] Error:', error)
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
  }
}
