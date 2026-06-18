// Channel dispatch helpers - send outbound messages to Facebook & WhatsApp.
// Used by the messages POST route so agent/AI replies actually reach the customer.
// This module should ONLY be used in backend (API routes).

import { db } from '@/lib/db'
import { notifyWidgetMessage } from '@/lib/realtime'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ChannelType = 'facebook' | 'whatsapp' | 'website'

export interface SendResult {
  success: boolean
  platformMessageId?: string
  error?: string
}

interface FacebookChannelConfig {
  pageId?: string
  pageName?: string
  pageAccessToken?: string
  accessToken?: string
  appId?: string
  appSecret?: string
  verifyToken?: string
  isConnected?: boolean
}

interface WhatsAppChannelConfig {
  phoneNumberId?: string
  whatsappAccessToken?: string
  businessAccountId?: string
  whatsappPhoneNumber?: string
  verifyToken?: string
  isConnected?: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Channel lookup
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Load the active channel config for a conversation's channel.
 * Returns the parsed config (typed by channel type) or null if unavailable.
 */
export async function getChannelConfig(
  conversationId: string
): Promise<{ type: ChannelType; config: Record<string, unknown> } | null> {
  const conversation = await db.conversation.findUnique({
    where: { id: conversationId },
    include: { channel: true },
  })
  if (!conversation?.channel) return null
  if (!conversation.channel.isActive) return null

  let config: Record<string, unknown> = {}
  try {
    config = JSON.parse(conversation.channel.config || '{}')
  } catch {
    config = {}
  }

  return {
    type: conversation.channel.type as ChannelType,
    config,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Facebook Messenger send
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Send a message to a Facebook Messenger user.
 * @param recipientPsid  The recipient's Page-Scoped ID (PSID)
 * @param messageText    The text to send
 */
export async function sendToFacebook(
  recipientPsid: string,
  messageText: string
): Promise<SendResult> {
  const token = await getSetting('facebook_page_access_token')
  if (!token) {
    return { success: false, error: 'Facebook Page Access Token not configured' }
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/me/messages?access_token=${token}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: { id: recipientPsid },
          message: { text: messageText },
        }),
      }
    )

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.error('[Facebook Send] Error:', err)
      return { success: false, error: `Facebook API error: ${err?.error?.message || res.status}` }
    }

    const data = await res.json()
    return { success: true, platformMessageId: data.message_id }
  } catch (err) {
    console.error('[Facebook Send] Exception:', err)
    return { success: false, error: 'Network error sending to Facebook' }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// WhatsApp Cloud API send
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Send a message to a WhatsApp user.
 * @param recipientPhone  E.164 phone number (no +), e.g. "66812345678"
 * @param messageText     The text to send
 */
export async function sendToWhatsApp(
  recipientPhone: string,
  messageText: string
): Promise<SendResult> {
  const channel = await getActiveChannel('whatsapp')
  if (!channel) {
    return { success: false, error: 'No active WhatsApp channel' }
  }
  const config = parseConfig<WhatsAppChannelConfig>(channel.config)
  if (!config.whatsappAccessToken || !config.phoneNumberId) {
    return { success: false, error: 'WhatsApp credentials not configured' }
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${config.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.whatsappAccessToken}`,
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: recipientPhone,
          type: 'text',
          text: { body: messageText },
        }),
      }
    )

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.error('[WhatsApp Send] Error:', err)
      return { success: false, error: `WhatsApp API error: ${err?.error?.message || res.status}` }
    }

    const data = await res.json()
    const messageId = data.messages?.[0]?.id
    return { success: true, platformMessageId: messageId }
  } catch (err) {
    console.error('[WhatsApp Send] Exception:', err)
    return { success: false, error: 'Network error sending to WhatsApp' }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Unified dispatch
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve the destination address for a conversation (PSID or phone).
 * Returns null if the customer has no address for the channel.
 */
async function getRecipientAddress(
  conversationId: string,
  type: ChannelType
): Promise<string | null> {
  const convo = await db.conversation.findUnique({
    where: { id: conversationId },
    include: { customer: true },
  })
  if (!convo?.customer) return null

  if (type === 'facebook') return convo.customer.facebookId || null
  if (type === 'whatsapp') return convo.customer.whatsappPhone || convo.customer.phone || null
  return null
}

/**
 * Dispatch an outbound message to the right channel based on the conversation.
 * - For `website` conversations, this is a no-op (no external channel yet).
 * - Returns a SendResult indicating success/failure. Failures are logged but
 *   do NOT throw — the local DB message is already saved.
 */
export async function dispatchToChannel(
  conversationId: string,
  messageText: string,
  options?: { existingMessageId?: string }
): Promise<SendResult & { platformMessageId?: string }> {
  const channelInfo = await getChannelConfig(conversationId)
  if (!channelInfo) {
    return { success: false, error: 'No channel configured' }
  }

  // Website chat: no external API call needed (the widget polls or streams).
  // Instead, push a real-time event so any connected widget receives the reply
  // instantly over the SSE stream.
  if (channelInfo.type === 'website') {
    if (options?.existingMessageId) {
      notifyWidgetMessage(conversationId, {
        id: options.existingMessageId,
        content: messageText,
        senderType: 'agent', // set by caller context; kept generic here
        contentType: 'text',
        createdAt: new Date(),
      })
    }
    return { success: true }
  }

  const address = await getRecipientAddress(conversationId, channelInfo.type)
  if (!address) {
    return {
      success: false,
      error: `No recipient address for ${channelInfo.type} channel`,
    }
  }

  let result: SendResult
  if (channelInfo.type === 'facebook') {
    result = await sendToFacebook(address, messageText)
  } else {
    result = await sendToWhatsApp(address, messageText)
  }

  // Stash the platform message ID back onto the DB message so inbound status
  // webhooks can later reconcile delivery/read receipts.
  if (result.success && result.platformMessageId && options?.existingMessageId) {
    try {
      const existing = await db.message.findUnique({ where: { id: options.existingMessageId } })
      if (existing) {
        const meta = parseConfig<Record<string, unknown>>(existing.metadata || '{}')
        meta.platformMessageId = result.platformMessageId
        meta.facebookMessageId = channelInfo.type === 'facebook' ? result.platformMessageId : meta.facebookMessageId
        meta.whatsappMessageId = channelInfo.type === 'whatsapp' ? result.platformMessageId : meta.whatsappMessageId
        await db.message.update({
          where: { id: existing.id },
          data: { metadata: JSON.stringify(meta) },
        })
      }
    } catch (err) {
      console.error('[Channel Dispatch] Failed to attach platform ID:', err)
    }
  }

  return result
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

async function getSetting(key: string): Promise<string | null> {
  const s = await db.setting.findUnique({ where: { key } })
  return s?.value || null
}

async function getActiveChannel(type: ChannelType) {
  const channels = await db.channel.findMany({ where: { type, isActive: true } })
  return channels[0] || null
}

function parseConfig<T = Record<string, unknown>>(raw: string | null | undefined): T {
  if (!raw) return {} as T
  try {
    return JSON.parse(raw) as T
  } catch {
    return {} as T
  }
}

// Re-export for type-only consumers
export type { FacebookChannelConfig, WhatsAppChannelConfig }
