import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// WhatsApp Webhook Verification (GET)
// When you configure your webhook in Meta Business Settings,
// WhatsApp sends a GET request with hub.mode, hub.challenge, and hub.verify_token
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const mode = searchParams.get('hub.mode')
    const challenge = searchParams.get('hub.challenge')
    const verifyToken = searchParams.get('hub.verify_token')

    // Get the configured verify token from settings
    const verifyTokenSetting = await db.setting.findUnique({
      where: { key: 'whatsapp_verify_token' },
    })
    const expectedToken = verifyTokenSetting?.value || 'ai_support_hub_verify_token'

    if (mode === 'subscribe' && challenge && verifyToken === expectedToken) {
      console.log('[WhatsApp Webhook] ✅ Verification successful')
      return new Response(challenge, { status: 200 })
    }

    console.log('[WhatsApp Webhook] ❌ Verification failed', { mode, verifyToken })
    return NextResponse.json({ error: 'Invalid verification request' }, { status: 403 })
  } catch (error) {
    console.error('[WhatsApp Webhook GET] Error:', error)
    return NextResponse.json({ error: 'Webhook verification failed' }, { status: 500 })
  }
}

// WhatsApp Webhook Events (POST)
// WhatsApp sends events here when messages are received on your Business number
export async function POST(request: Request) {
  try {
    const body = await request.json()

    if (body.object) {
      for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
          // Handle incoming messages
          const messages = change.value?.messages
          if (messages) {
            for (const msg of messages) {
              const from = msg.from // Customer's phone number
              const messageId = msg.id
              const type = msg.type
              const timestamp = new Date(parseInt(msg.timestamp) * 1000)

              let messageText = ''
              let contentType = 'text'

              switch (type) {
                case 'text':
                  messageText = msg.text?.body || ''
                  break
                case 'image':
                  messageText = msg.image?.caption || '[Image]'
                  contentType = 'image'
                  break
                case 'document':
                  messageText = msg.document?.caption || '[Document]'
                  contentType = 'file'
                  break
                case 'audio':
                  messageText = '[Voice Message]'
                  contentType = 'voice'
                  break
                case 'video':
                  messageText = msg.video?.caption || '[Video]'
                  contentType = 'file'
                  break
                case 'sticker':
                  messageText = '[Sticker]'
                  contentType = 'emoji'
                  break
                case 'location':
                  messageText = `[Location: ${msg.location?.latitude}, ${msg.location?.longitude}]`
                  contentType = 'text'
                  break
                case 'contacts':
                  messageText = '[Contact Shared]'
                  contentType = 'text'
                  break
                case 'reaction':
                  messageText = `[Reaction: ${msg.reaction?.emoji}]`
                  contentType = 'emoji'
                  break
                default:
                  messageText = `[${type}]`
              }

              console.log(`[WhatsApp Webhook] 📩 Message from ${from}, type: ${type}, text: ${messageText}`)

              // Process the message
              processWhatsAppMessage({
                from,
                messageId,
                messageText,
                contentType,
                whatsappMessageId: messageId,
                timestamp,
                contactInfo: change.value?.contacts?.[0],
              }).catch((err) => {
                console.error('[WhatsApp Webhook] Error processing message:', err)
              })
            }
          }

          // Handle message status updates (sent, delivered, read)
          const statuses = change.value?.statuses
          if (statuses) {
            for (const status of statuses) {
              console.log(`[WhatsApp Webhook] 📊 Status: ${status.id} → ${status.status}`)
              // Update message read/delivered status in the database
              await updateMessageStatus(status.id, status.status)
            }
          }

          // Handle errors from WhatsApp
          if (change.value?.errors) {
            for (const error of change.value.errors) {
              console.error(`[WhatsApp Webhook] ❌ Error: ${error.message}`, error)
            }
          }
        }
      }
    }

    // Always return 200 quickly (WhatsApp requirement)
    return NextResponse.json({ status: 'ok' })
  } catch (error) {
    console.error('[WhatsApp Webhook POST] Error:', error)
    return NextResponse.json({ status: 'ok' })
  }
}

// Process incoming WhatsApp message and store in database
async function processWhatsAppMessage(data: {
  from: string
  messageId: string
  messageText: string
  contentType: string
  whatsappMessageId: string
  timestamp: Date
  contactInfo?: {
    wa_id: string
    name: string
  }
}) {
  // 1. Find the WhatsApp channel
  const channels = await db.channel.findMany({ where: { type: 'whatsapp', isActive: true } })
  let channel = channels[0]

  if (!channel) {
    console.log('[WhatsApp Webhook] No active WhatsApp channel found, skipping message')
    return
  }

  // 2. Find or create customer by phone number
  const customerName = data.contactInfo?.name || `WhatsApp ${data.from.slice(-4)}`

  let customer = await db.customer.findFirst({
    where: { whatsappPhone: data.from },
  })

  if (!customer) {
    // Also check by phone field
    customer = await db.customer.findFirst({
      where: { phone: data.from },
    })
  }

  if (!customer) {
    customer = await db.customer.create({
      data: {
        name: customerName,
        whatsappPhone: data.from,
        phone: data.from,
        sentiment: 'neutral',
        lastActivity: new Date(),
      },
    })
    console.log(`[WhatsApp Webhook] ✅ Created new customer: ${customerName}`)
  } else {
    // Update customer name if we have better info
    if (data.contactInfo?.name && customer.name.startsWith('WhatsApp')) {
      await db.customer.update({
        where: { id: customer.id },
        data: { name: data.contactInfo.name, lastActivity: new Date() },
      })
    } else {
      await db.customer.update({
        where: { id: customer.id },
        data: { lastActivity: new Date() },
      })
    }
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
    console.log(`[WhatsApp Webhook] ✅ Created new conversation: ${conversation.id}`)
  }

  // 4. Store the message
  const metadata: Record<string, unknown> = {
    whatsappMessageId: data.whatsappMessageId,
    from: data.from,
    contactName: data.contactInfo?.name,
  }

  await db.message.create({
    data: {
      conversationId: conversation.id,
      senderType: 'customer',
      content: data.messageText,
      contentType: data.contentType,
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
      lastMessage: data.messageText.substring(0, 200),
      lastMessageAt: new Date(),
      unreadCount: { increment: 1 },
    },
  })

  console.log(`[WhatsApp Webhook] ✅ Message stored in conversation ${conversation.id}`)
}

// Update message delivery status
async function updateMessageStatus(whatsappMessageId: string, status: string) {
  try {
    // Find the message by WhatsApp ID in metadata
    const messages = await db.message.findMany({
      where: { senderType: { in: ['agent', 'ai'] } },
    })

    for (const msg of messages) {
      try {
        const metadata = JSON.parse(msg.metadata || '{}')
        if (metadata.whatsappMessageId === whatsappMessageId) {
          await db.message.update({
            where: { id: msg.id },
            data: { isRead: status === 'read' },
          })
          break
        }
      } catch {
        continue
      }
    }
  } catch {
    // silently fail
  }
}
