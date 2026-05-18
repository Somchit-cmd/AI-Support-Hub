import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const conversation = await db.conversation.findUnique({
      where: { id },
      include: {
        customer: { include: { tags: true } },
        channel: true,
        assignedTo: { select: { id: true, name: true, email: true, avatar: true, role: true, status: true } },
        messages: {
          orderBy: { createdAt: 'asc' },
          include: {
            sender: { select: { id: true, name: true, avatar: true } },
          },
        },
        assignments: {
          include: {
            agent: { select: { id: true, name: true, email: true, avatar: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        aiLogs: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    })

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    return NextResponse.json({ conversation })
  } catch (error) {
    console.error('[Conversation GET] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch conversation' }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { status, aiMode, assignedToId, priority, isPinned, subject, unreadCount } = body

    const existing = await db.conversation.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    if (status !== undefined) {
      updateData.status = status
      if (status === 'closed') {
        updateData.closedAt = new Date()
      }
    }
    if (aiMode !== undefined) updateData.aiMode = aiMode
    if (assignedToId !== undefined) updateData.assignedToId = assignedToId
    if (priority !== undefined) updateData.priority = priority
    if (isPinned !== undefined) updateData.isPinned = isPinned
    if (subject !== undefined) updateData.subject = subject
    if (unreadCount !== undefined) updateData.unreadCount = unreadCount

    const conversation = await db.conversation.update({
      where: { id },
      data: updateData,
      include: {
        customer: { include: { tags: true } },
        channel: true,
        assignedTo: { select: { id: true, name: true, email: true, avatar: true, role: true, status: true } },
      },
    })

    return NextResponse.json({ conversation })
  } catch (error) {
    console.error('[Conversation PATCH] Error:', error)
    return NextResponse.json({ error: 'Failed to update conversation' }, { status: 500 })
  }
}
