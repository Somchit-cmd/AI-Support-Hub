import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { generateAndSaveAIReply } from '@/lib/ai'
import { runRules } from '@/lib/automation'
import { processInboundSentiment } from '@/lib/sentiment'

// ─────────────────────────────────────────────────────────────────────────────
// Public widget endpoints, scoped by sessionId (= conversation id).
//
// GET  /api/widget/messages/[sessionId]?since=<iso>
//      Poll for messages newer than `since`. The widget calls this every few
//      seconds to pick up agent/AI replies.
//
// POST /api/widget/messages/[sessionId]
//      Body: { content: string }
//      Stores a visitor message and, if the conversation is in 'auto' mode,
//      triggers an AI auto-reply.
// ─────────────────────────────────────────────────────────────────────────────

async function loadConversation(sessionId: string) {
  return db.conversation.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      status: true,
      aiMode: true,
      customerId: true,
      channel: { select: { type: true, isActive: true } },
    },
  })
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params
    const { searchParams } = new URL(request.url)
    const since = searchParams.get('since')

    const conversation = await loadConversation(sessionId)
    if (!conversation || conversation.channel?.type !== 'website') {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const messages = await db.message.findMany({
      where: {
        conversationId: sessionId,
        isInternal: false, // never expose staff notes to visitors
        ...(since ? { createdAt: { gt: new Date(since) } } : {}),
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        content: true,
        senderType: true,
        contentType: true,
        createdAt: true,
      },
    })

    // Mark agent/ai messages as "seen" by the visitor (read receipts).
    await db.message
      .updateMany({
        where: {
          conversationId: sessionId,
          senderType: { in: ['agent', 'ai', 'system'] },
          isRead: false,
        },
        data: { isRead: true },
      })
      .catch(() => {})

    return NextResponse.json({
      messages,
      status: conversation.status,
      aiMode: conversation.aiMode,
      serverTime: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[Widget Messages GET] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params
    const body = await request.json().catch(() => ({}))
    const { content } = body

    if (!content || typeof content !== 'string' || !content.trim()) {
      return NextResponse.json({ error: 'Message content is required' }, { status: 400 })
    }

    const conversation = await loadConversation(sessionId)
    if (!conversation || conversation.channel?.type !== 'website') {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }
    if (conversation.status === 'closed') {
      return NextResponse.json({ error: 'This conversation has been closed' }, { status: 410 })
    }

    // Store the visitor's message.
    const message = await db.message.create({
      data: {
        conversationId: sessionId,
        senderType: 'customer',
        content: content.trim(),
        contentType: 'text',
        isRead: false,
        isInternal: false,
        metadata: JSON.stringify({ widget: true }),
      },
    })

    // Update conversation bookkeeping.
    await db.conversation.update({
      where: { id: sessionId },
      data: {
        lastMessage: content.trim().substring(0, 200),
        lastMessageAt: new Date(),
        unreadCount: { increment: 1 },
      },
    })

    // Background enrichment (never blocks the visitor's response).
    if (conversation.customerId) {
      processInboundSentiment(conversation.customerId, content.trim(), 'website').catch(() => {})
      runRules('keyword_match', {
        conversationId: sessionId,
        customerId: conversation.customerId,
        channelType: 'website',
        messageContent: content.trim(),
      }).catch(() => {})
    }

    // Auto-reply with AI if the conversation is in auto mode.
    let aiReply: { id: string; content: string } | null = null
    if (conversation.aiMode === 'auto') {
      try {
        const result = await generateAndSaveAIReply(sessionId)
        aiReply = {
          id: result.message.id,
          content: result.content,
        }
      } catch (err) {
        console.error('[Widget Messages POST] AI auto-reply failed:', err)
      }
    }

    return NextResponse.json({ message, aiReply }, { status: 201 })
  } catch (error) {
    console.error('[Widget Messages POST] Error:', error)
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
  }
}
