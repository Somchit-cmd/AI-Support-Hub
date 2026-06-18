import { NextResponse } from 'next/server'
import { testAIWithRAG } from '@/lib/ai'

// AI Playground endpoint.
// POST /api/ai/test
// Body: { message: string }
//
// Runs the configured AI provider against the test message WITH RAG context
// from the knowledge base, and returns the response, the knowledge context
// that was injected, token usage, and response time. Used by the "Test AI"
// playground in Settings → AI.
//
// Unlike /api/ai/test-provider (a simple connection probe), this exercises the
// full generation + RAG pipeline so admins can preview how the AI will
// actually answer using their configured knowledge base.

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const { message } = body

    if (!message || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json(
        { error: 'A test message is required' },
        { status: 400 }
      )
    }

    const result = await testAIWithRAG(message.trim())

    return NextResponse.json({
      response: result.response,
      knowledgeContext: result.knowledgeContext,
      model: result.model,
      tokens: result.tokens,
      responseTime: result.responseTime,
      provider: result.provider,
    })
  } catch (error) {
    console.error('[AI Test] Error:', error)
    const msg = error instanceof Error ? error.message : 'AI test failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
