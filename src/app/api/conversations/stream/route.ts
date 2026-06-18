import { subscribeAdmin } from '@/lib/realtime'

// Admin Inbox real-time stream (Server-Sent Events).
// GET /api/conversations/stream
//
// Opened by InboxPage once on mount. Broadcasts new messages and conversation
// updates to all connected staff clients, replacing REST polling. Includes a
// 25s keepalive comment so proxies don't drop the idle connection.
//
// NOTE: like the widget stream, this is in-process state (single-server). For
// multi-instance deploys, swap the adminListeners Set in realtime.ts for
// Redis pub/sub — the public API stays the same.

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: Request) {
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

      // Initial hello so the client knows the stream is live.
      send({ type: 'connected' })

      const unsubscribe = subscribeAdmin((event) => {
        send(event)
      })

      // Keepalive every 25s.
      const keepalive = setInterval(() => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(`: keepalive\n\n`))
        } catch {
          closed = true
        }
      }, 25000)

      // Clean up on disconnect.
      request.signal?.addEventListener('abort', () => {
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
      'X-Accel-Buffering': 'no',
    },
  })
}
