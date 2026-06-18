import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isWebhookAuthorized } from '@/lib/webhook-security'
import { generateAndSaveAIReply } from '@/lib/ai'
import { dispatchToChannel } from '@/lib/channels'

// Facebook Webhook Verification (GET)
// When you configure your webhook in Facebook Developer Portal,
// Facebook sends a GET request with hub.mode, hub.challenge, and hub.verify_token
// You must echo back the hub.challenge to verify the webhook
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const mode = searchParams.get('hub.mode')
    const challenge = searchParams.get('hub.challenge')
    const verifyToken = searchParams.get('hub.verify_token')

    // Get the configured verify token from settings
    const verifyTokenSetting = await db.setting.findUnique({
      where: { key: 'facebook_verify_token' },
    })
    const expectedToken = verifyTokenSetting?.value || 'ai_support_hub_verify_token'

    if (mode === 'subscribe' && challenge && verifyToken === expectedToken) {
      console.log('[Facebook Webhook] ✅ Verification successful')
      return new Response(challenge, { status: 200 })
    }

    console.log('[Facebook Webhook] ❌ Verification failed', { mode, verifyToken })
    return NextResponse.json({ error: 'Invalid verification request' }, { status: 403 })
  } catch (error) {
    console.error('[Facebook Webhook GET] Error:', error)
    return NextResponse.json({ error: 'Webhook verification failed' }, { status: 500 })
  }
}

// Facebook Webhook Events (POST)
// Facebook sends events here when messages are received on your Page
export async function POST(request: Request) {
  try {
    // Capture the RAW body first — signature verification needs the exact bytes.
    const rawBody = await request.text()
    const signature = request.headers.get('x-hub-signature-256')

    // Verify the webhook signature (skipped in dev if no app secret is set).
    const { authorized, reason } = await isWebhookAuthorized(rawBody, signature)
    if (!authorized) {
      console.warn(`[Facebook Webhook] ❌ Unauthorized (${reason})`)
      // Return 200 anyway so Facebook doesn't keep retrying, but don't process.
      return NextResponse.json({ status: 'unauthorized' })
    }

    const body = JSON.parse(rawBody)

    // Always return 200 quickly to acknowledge receipt (Facebook requirement)
    // Process in background

    if (body.object === 'page') {
      for (const entry of body.entry || []) {
        const pageId = entry.id
        const timeOfEvent = entry.time

        for (const messagingEvent of entry.messaging || []) {
          const senderId = messagingEvent.sender?.id
          const recipientId = messagingEvent.recipient?.id
          const message = messagingEvent.message

          // Handle incoming text/attachment messages
          if (message) {
            const messageText = message.text || ''
            const messageId = message.mid
            const attachments = message.attachments || []

            console.log(`[Facebook Webhook] 📩 Message from PSID ${senderId} to Page ${recipientId}: ${messageText}`)

            // Process the message asynchronously
            processFacebookMessage({
              senderPsid: senderId,
              recipientPageId: recipientId,
              pageId,
              messageText,
              messageId,
              attachments,
              timestamp: new Date(timeOfEvent),
            }).then((conversationId) => {
              // Trigger AI auto-reply if the conversation is in auto mode.
              if (conversationId) maybeAutoReply(conversationId)
            }).catch((err) => {
              console.error('[Facebook Webhook] Error processing message:', err)
            })
          }

          // Handle message echoes (messages sent by the page)
          if (message?.is_echo) {
            console.log(`[Facebook Webhook] 📤 Echo: ${message.mid}`)
          }

          // Handle message delivery receipts
          if (messagingEvent.delivery) {
            console.log(`[Facebook Webhook] ✅ Delivered: ${messagingEvent.delivery.mids?.join(', ')}`)
          }

          // Handle message read receipts
          if (messagingEvent.read) {
            console.log(`[Facebook Webhook] 👁️ Read at: ${messagingEvent.read.watermark}`)
          }

          // Handle postback events (Get Started button, persistent menu)
          if (messagingEvent.postback) {
            const payload = messagingEvent.postback.payload
            console.log(`[Facebook Webhook] 🔘 Postback from ${senderId}: ${payload}`)

            processFacebookPostback({
              senderPsid: senderId,
              pageId: recipientId,
              payload,
              timestamp: new Date(timeOfEvent),
            }).then((conversationId) => {
              if (conversationId) maybeAutoReply(conversationId)
            }).catch((err) => {
              console.error('[Facebook Webhook] Error processing postback:', err)
            })
          }
        }
      }
    }

    return NextResponse.json({ status: 'ok' })
  } catch (error) {
    console.error('[Facebook Webhook POST] Error:', error)
    // Still return 200 to prevent Facebook from retrying
    return NextResponse.json({ status: 'ok' })
  }
}

// Trigger an AI auto-reply if the conversation is in 'auto' mode.
// Failures are logged but never bubble up — webhook must stay 200.
async function maybeAutoReply(conversationId: string) {
  try {
    const convo = await db.conversation.findUnique({
      where: { id: conversationId },
      select: { aiMode: true },
    })
    if (!convo || convo.aiMode !== 'auto') return

    console.log(`[Facebook Webhook] 🤖 Auto-replying to conversation ${conversationId}`)
    const result = await generateAndSaveAIReply(conversationId)

    // Deliver the AI reply back to Facebook.
    dispatchToChannel(conversationId, result.content).catch((err) => {
      console.error('[Facebook Webhook] Auto-reply delivery failed:', err)
    })
  } catch (err) {
    console.error('[Facebook Webhook] Auto-reply failed:', err)
  }
}

// Process incoming Facebook message and store in database.
// Returns the conversation ID (used by the auto-reply hook).
async function processFacebookMessage(data: {
  senderPsid: string
  recipientPageId: string
  pageId: string
  messageText: string
  messageId: string
  attachments: Array<{ type: string; payload: { url?: string } }>
  timestamp: Date
}): Promise<string | null> {
  // 1. Find the Facebook channel by page ID
  const channels = await db.channel.findMany({ where: { type: 'facebook', isActive: true } })
  let channel = channels.find((c) => {
    try {
      const config = JSON.parse(c.config)
      return config.pageId === data.pageId || config.pageId === data.recipientPageId
    } catch { return false }
  })

  // If no matching channel, use the first active Facebook channel
  if (!channel) {
    channel = channels[0]
  }

  if (!channel) {
    console.log('[Facebook Webhook] No active Facebook channel found, skipping message')
    return null
  }

  // 2. Find or create customer by PSID
  let customer = await db.customer.findFirst({
    where: { facebookId: data.senderPsid },
  })

  if (!customer) {
    // Try to get user info from Facebook Graph API
    let customerName = `Facebook User ${data.senderPsid.slice(-4)}`
    try {
      const pageAccessToken = await getPageAccessToken(channel.id)
      if (pageAccessToken) {
        const userInfoRes = await fetch(
          `https://graph.facebook.com/v21.0/${data.senderPsid}?fields=first_name,last_name,profile_pic&access_token=${pageAccessToken}`
        )
        if (userInfoRes.ok) {
          const userInfo = await userInfoRes.json()
          const firstName = userInfo.first_name || ''
          const lastName = userInfo.last_name || ''
          customerName = `${firstName} ${lastName}`.trim() || customerName
        }
      }
    } catch {
      // If we can't fetch user info, use default name
    }

    customer = await db.customer.create({
      data: {
        name: customerName,
        facebookId: data.senderPsid,
        sentiment: 'neutral',
        lastActivity: new Date(),
      },
    })
    console.log(`[Facebook Webhook] ✅ Created new customer: ${customerName}`)
  }

  // 3. Find or create conversation
  let conversation = await db.conversation.findFirst({
    where: {
      customerId: customer.id,
      channelId: channel.id,
      status: { in: ['active', 'pending'] },
    },
  })

  if (!conversation) {
    conversation = await db.conversation.create({
      data: {
        customerId: customer.id,
        channelId: channel.id,
        status: 'active',
        aiMode: 'auto',
        priority: 'normal',
        lastMessageAt: new Date(),
        lastMessage: data.messageText.substring(0, 200),
      },
    })
    console.log(`[Facebook Webhook] ✅ Created new conversation: ${conversation.id}`)
  }

  // 4. Store the message
  const content = data.messageText || `[${data.attachments.map(a => a.type).join(', ')} attachment(s)]`
  const metadata: Record<string, unknown> = {
    facebookMessageId: data.messageId,
    senderPsid: data.senderPsid,
    pageId: data.pageId,
    attachments: data.attachments,
  }

  await db.message.create({
    data: {
      conversationId: conversation.id,
      senderType: 'customer',
      content,
      contentType: data.messageText ? 'text' : 'image',
      metadata: JSON.stringify(metadata),
      isRead: false,
      isInternal: false,
      createdAt: data.timestamp,
    },
  })

  // 5. Update conversation
  await db.conversation.update({
    where: { id: conversation.id },
    data: {
      lastMessage: content.substring(0, 200),
      lastMessageAt: new Date(),
      unreadCount: { increment: 1 },
    },
  })

  // 6. Update customer last activity
  await db.customer.update({
    where: { id: customer.id },
    data: { lastActivity: new Date() },
  })

  console.log(`[Facebook Webhook] ✅ Message stored in conversation ${conversation.id}`)

  return conversation.id
}

// Process Facebook postback (Get Started, persistent menu clicks).
// Returns the conversation ID (used by the auto-reply hook).
async function processFacebookPostback(data: {
  senderPsid: string
  pageId: string
  payload: string
  timestamp: Date
}): Promise<string | null> {
  // Find or create customer and send welcome message
  const channels = await db.channel.findMany({ where: { type: 'facebook', isActive: true } })
  const channel = channels[0]
  if (!channel) return null

  let customer = await db.customer.findFirst({
    where: { facebookId: data.senderPsid },
  })

  if (!customer) {
    let customerName = `Facebook User ${data.senderPsid.slice(-4)}`
    try {
      const pageAccessToken = await getPageAccessToken(channel.id)
      if (pageAccessToken) {
        const userInfoRes = await fetch(
          `https://graph.facebook.com/v21.0/${data.senderPsid}?fields=first_name,last_name&access_token=${pageAccessToken}`
        )
        if (userInfoRes.ok) {
          const userInfo = await userInfoRes.json()
          customerName = `${userInfo.first_name || ''} ${userInfo.last_name || ''}`.trim() || customerName
        }
      }
    } catch { /* ignore */ }

    customer = await db.customer.create({
      data: {
        name: customerName,
        facebookId: data.senderPsid,
        sentiment: 'neutral',
        lastActivity: new Date(),
      },
    })
  }

  // Create conversation with welcome message
  const conversation = await db.conversation.create({
    data: {
      customerId: customer.id,
      channelId: channel.id,
      status: 'active',
      aiMode: 'auto',
      priority: 'normal',
      lastMessageAt: new Date(),
      lastMessage: `Postback: ${data.payload}`,
    },
  })

  await db.message.create({
    data: {
      conversationId: conversation.id,
      senderType: 'customer',
      content: `[Postback: ${data.payload}]`,
      contentType: 'text',
      metadata: JSON.stringify({ senderPsid: data.senderPsid, postback: data.payload }),
      isRead: false,
      createdAt: data.timestamp,
    },
  })

  return conversation.id
}

// Helper: Get Page Access Token from channel config
async function getPageAccessToken(channelId: string): Promise<string | null> {
  try {
    const channel = await db.channel.findUnique({ where: { id: channelId } })
    if (!channel) return null
    const config = JSON.parse(channel.config)
    return config.pageAccessToken || config.accessToken || null
  } catch {
    return null
  }
}
