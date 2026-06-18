// Real-time event bus for the website widget (Server-Sent Events)
// ------------------------------------------------------------------
// A tiny in-process pub/sub keyed by conversation id. When a message is saved
// for a website conversation (by an agent, AI, or automation), call
// publishWidgetEvent() and any connected widget client receives it instantly
// via the /api/widget/stream/[sessionId] SSE endpoint.
//
// Limitation: this is per-process state, so it works on a single server. For
// multi-instance deploys, swap the Map for Redis pub/sub — the public API
// (subscribe/publish/unsubscribe) stays the same.

type Listener = (event: WidgetEvent) => void

export interface WidgetEvent {
  type: 'message' | 'typing' | 'session_closed'
  conversationId: string
  message?: {
    id: string
    content: string
    senderType: string
    contentType: string
    createdAt: string
  }
  // For typing indicators
  isTyping?: boolean
}

// Admin inbox events are broadcast to ALL connected staff clients (agents see
// new inbound messages across all conversations, not just the one they have
// open). This is the piece that replaces REST polling in InboxPage.
export interface AdminEvent {
  type: 'message' | 'conversation_updated'
  conversationId: string
  // For 'message': the new message payload.
  message?: {
    id: string
    content: string
    senderType: string
    contentType: string
    isInternal: boolean
    createdAt: string
  }
  // For 'conversation_updated': changed conversation fields.
  changes?: Record<string, unknown>
  // Channel/customer context so the inbox list can render without a refetch.
  channelType?: string
  customerName?: string
}

const channels = new Map<string, Set<Listener>>()
const adminListeners = new Set<(event: AdminEvent) => void>()

export function subscribe(conversationId: string, listener: Listener): () => void {
  let set = channels.get(conversationId)
  if (!set) {
    set = new Set()
    channels.set(conversationId, set)
  }
  set.add(listener)

  // Return an unsubscribe function.
  return () => {
    const s = channels.get(conversationId)
    if (!s) return
    s.delete(listener)
    if (s.size === 0) channels.delete(conversationId)
  }
}

export function publishWidgetEvent(conversationId: string, event: WidgetEvent): void {
  const set = channels.get(conversationId)
  if (!set || set.size === 0) return
  for (const listener of set) {
    try {
      listener(event)
    } catch {
      // a dead listener — ignore; GC'd on next keepalive miss
    }
  }
}

/** Convenience: publish a "new message" event for a widget conversation. */
export function notifyWidgetMessage(conversationId: string, message: {
  id: string
  content: string
  senderType: string
  contentType: string
  createdAt: string | Date
}): void {
  publishWidgetEvent(conversationId, {
    type: 'message',
    conversationId,
    message: {
      id: message.id,
      content: message.content,
      senderType: message.senderType,
      contentType: message.contentType,
      createdAt: typeof message.createdAt === 'string' ? message.createdAt : message.createdAt.toISOString(),
    },
  })
}

/** How many widgets are currently listening (for debug/observability). */
export function listenerCount(conversationId: string): number {
  return channels.get(conversationId)?.size || 0
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin inbox events (broadcast to all connected staff clients)
// ─────────────────────────────────────────────────────────────────────────────

/** Subscribe to admin inbox events. Returns an unsubscribe function. */
export function subscribeAdmin(listener: (event: AdminEvent) => void): () => void {
  adminListeners.add(listener)
  return () => {
    adminListeners.delete(listener)
  }
}

/** Broadcast an admin event to all connected staff clients. */
export function publishAdminEvent(event: AdminEvent): void {
  if (adminListeners.size === 0) return
  for (const listener of adminListeners) {
    try {
      listener(event)
    } catch {
      // dead listener — ignore
    }
  }
}

/**
 * Convenience: notify the admin inbox that a new message landed in a
 * conversation. Call this whenever a message is created (by webhook, agent,
 * AI, or automation) so open InboxPages update instantly.
 */
export function notifyAdminMessage(conversationId: string, message: {
  id: string
  content: string
  senderType: string
  contentType: string
  isInternal: boolean
  createdAt: string | Date
}, context?: { channelType?: string; customerName?: string }): void {
  publishAdminEvent({
    type: 'message',
    conversationId,
    message: {
      id: message.id,
      content: message.content,
      senderType: message.senderType,
      contentType: message.contentType,
      isInternal: message.isInternal,
      createdAt: typeof message.createdAt === 'string' ? message.createdAt : message.createdAt.toISOString(),
    },
    channelType: context?.channelType,
    customerName: context?.customerName,
  })
}

/** How many admin clients are currently listening (for debug/observability). */
export function adminListenerCount(): number {
  return adminListeners.size
}
