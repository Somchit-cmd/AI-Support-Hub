import { NextResponse } from 'next/server'
import { generateAndSaveAIReply } from '@/lib/ai'
import { dispatchToChannel } from '@/lib/channels'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Generate, save, log, and record usage (shared pipeline).
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
