import { db } from '@/lib/db'
import { subscribe } from '@/lib/realtime'

// Server-Sent Events stream for the website widget.
// GET /api/widget/stream/[sessionId]
//
// The widget opens an EventSource on this URL after starting a session. New
// agent/AI/automation messages are pushed instantly (no polling). The route
// also sends a keepalive comment every 25s so proxies don't kill the idle
// connection.

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params

  // Validate the session belongs to an active website conversation.
  const conversation = await db.conversation.findUnique({
    where: { id: sessionId },
    include: { channel: { select: { type: true, isActive: true } } },
  })
  if (!conversation || conversation.channel?.type !== 'website') {
    return new Response(JSON.stringify({ error: 'Session not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()
      let closed = false

      const send = (data: unknown) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        } catch {
          closed = true
        }
      }

      // Initial hello so the client knows the stream is alive.
      send({ type: 'connected', conversationId: sessionId })

      // Subscribe to events for this conversation.
      const unsubscribe = subscribe(sessionId, (event) => {
        send(event)
        // If the conversation was closed, end the stream.
        if (event.type === 'session_closed') {
          unsubscribe()
          try { controller.close() } catch {}
          closed = true
        }
      })

      // Keepalive every 25s (HTTP/SSE idle timeout is often 30-60s).
      const keepalive = setInterval(() => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(`: keepalive\n\n`))
        } catch {
          closed = true
        }
      }, 25000)

      // Clean up when the client disconnects.
      _request.signal?.addEventListener('abort', () => {
        closed = true
        clearInterval(keepalive)
        unsubscribe()
        try { controller.close() } catch {}
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // disable nginx buffering
    },
  })
}
