import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { generateAndSaveAIReply, generateSuggestedReplies, getAISettings } from '@/lib/ai'
import { dispatchToChannel } from '@/lib/channels'

// POST /api/conversations/[id]/ai-reply
//
// Two modes:
//   { }                       → AI Reply: generate, SAVE the message, log usage,
//                               and dispatch it to the channel (FB/WA/website).
//   { suggestOnly: true }     → AI Suggest: generate reply OPTIONS ONLY, do NOT
//                               save anything or contact the customer. Returns
//                               { suggestions: string[] } for the agent to pick
//                               from. Sending the chosen text is a separate
//                               agent action via the messages endpoint.

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    let body: { suggestOnly?: boolean } = {}
    try {
      body = await request.json()
    } catch {
      // Empty body is fine for the AI Reply path.
    }

    // ── AI Suggest: no persistence, no dispatch ──────────────────────────
    if (body.suggestOnly) {
      const conversation = await db.conversation.findUnique({
        where: { id },
        include: {
          customer: { select: { name: true } },
          messages: {
            orderBy: { createdAt: 'asc' },
            take: 10,
            select: { senderType: true, content: true },
          },
        },
      })
      if (!conversation) {
        return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
      }
      if (conversation.aiMode === 'human') {
        return NextResponse.json(
          { error: 'AI is disabled for this conversation (human mode)' },
          { status: 400 }
        )
      }

      const history = conversation.messages
        .map((m) => `${m.senderType}: ${m.content}`)
        .join('\n')
      const lastMessages = conversation.messages.slice(-5).map((m) => m.content).join('\n')

      // Guard usage: suggestions don't need RAG context, so skip the heavier
      // pipeline. Returns up to 3 options.
      await getAISettings() // ensures AI is configured; throws if misconfigured
      const suggestions = await generateSuggestedReplies(
        `Customer: ${conversation.customer?.name || 'Customer'}\n${history}`,
        lastMessages,
        3
      )

      return NextResponse.json({ suggestions })
    }

    // ── AI Reply: full pipeline (save + dispatch) ────────────────────────
    const result = await generateAndSaveAIReply(id)

    // Deliver the AI reply to the external channel (Facebook/WhatsApp).
    // Fire-and-forget: a delivery failure must not roll back the AI reply,
    // since it is already saved and visible in the inbox.
    dispatchToChannel(id, result.content).catch((err) => {
      console.error('[AI Reply] Channel dispatch failed:', err)
    })

    return NextResponse.json({
      message: result.message,
      aiLog: {
        id: result.aiLog.id,
        tokens: result.aiLog.tokens,
        model: result.aiLog.model,
        responseTime: result.aiLog.responseTime,
      },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to generate AI reply'

    // Distinguish "disabled" (400) from real failures (500).
    if (msg.includes('human mode')) {
      return NextResponse.json({ error: msg }, { status: 400 })
    }
    if (msg.includes('not found')) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    console.error('[AI Reply] Error:', error)
    return NextResponse.json({ error: 'Failed to generate AI reply' }, { status: 500 })
  }
}
