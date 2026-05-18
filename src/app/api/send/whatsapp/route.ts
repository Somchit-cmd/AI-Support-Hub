import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Send a message via WhatsApp Cloud API
// POST /api/send/whatsapp
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { recipientPhone, messageText, conversationId, templateName, templateLanguage } = body

    if (!recipientPhone || (!messageText && !templateName)) {
      return NextResponse.json(
        { error: 'Recipient phone number and message text (or template) are required' },
        { status: 400 }
      )
    }

    // Get the WhatsApp channel config with access token
    const channels = await db.channel.findMany({ where: { type: 'whatsapp', isActive: true } })
    const channel = channels[0]

    if (!channel) {
      return NextResponse.json({ error: 'No active WhatsApp channel found' }, { status: 400 })
    }

    const config = JSON.parse(channel.config)
    const { whatsappAccessToken, phoneNumberId } = config

    if (!whatsappAccessToken || !phoneNumberId) {
      return NextResponse.json({ error: 'WhatsApp credentials not configured' }, { status: 400 })
    }

    // Build the message payload
    let messagePayload: Record<string, unknown>
    if (templateName) {
      // Send template message
      messagePayload = {
        messaging_product: 'whatsapp',
        to: recipientPhone,
        type: 'template',
        template: {
          name: templateName,
          language: { code: templateLanguage || 'en' },
        },
      }
    } else {
      // Send regular text message
      messagePayload = {
        messaging_product: 'whatsapp',
        to: recipientPhone,
        type: 'text',
        text: { body: messageText },
      }
    }

    // Send message via WhatsApp Cloud API
    const sendRes = await fetch(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${whatsappAccessToken}`,
        },
        body: JSON.stringify(messagePayload),
      }
    )

    if (!sendRes.ok) {
      const errorData = await sendRes.json()
      console.error('[WhatsApp Send] Error:', errorData)
      return NextResponse.json(
        { error: 'Failed to send WhatsApp message', details: errorData },
        { status: 500 }
      )
    }

    const sendResult = await sendRes.json()
    const whatsappMessageId = sendResult.messages?.[0]?.id
    console.log(`[WhatsApp Send] ✅ Message sent to ${recipientPhone}, ID: ${whatsappMessageId}`)

    // Store the sent message in the database
    if (conversationId) {
      await db.message.create({
        data: {
          conversationId,
          senderType: 'agent',
          content: messageText || `[Template: ${templateName}]`,
          contentType: 'text',
          metadata: JSON.stringify({
            whatsappMessageId,
            recipientPhone,
          }),
          isRead: false,
          isInternal: false,
        },
      })

      await db.conversation.update({
        where: { id: conversationId },
        data: {
          lastMessage: (messageText || `[Template: ${templateName}]`).substring(0, 200),
          lastMessageAt: new Date(),
        },
      })
    }

    return NextResponse.json({
      success: true,
      messageId: whatsappMessageId,
      recipientPhone,
    })
  } catch (error) {
    console.error('[WhatsApp Send] Error:', error)
    return NextResponse.json({ error: 'Failed to send WhatsApp message' }, { status: 500 })
  }
}
