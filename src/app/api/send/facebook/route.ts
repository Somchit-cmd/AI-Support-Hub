import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Send a message via Facebook Messenger
// POST /api/send/facebook
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { recipientPsid, messageText, conversationId } = body

    if (!recipientPsid || !messageText) {
      return NextResponse.json(
        { error: 'Recipient PSID and message text are required' },
        { status: 400 }
      )
    }

    // Get the Facebook channel config with access token
    const channels = await db.channel.findMany({ where: { type: 'facebook', isActive: true } })
    const channel = channels[0]

    if (!channel) {
      return NextResponse.json({ error: 'No active Facebook channel found' }, { status: 400 })
    }

    const config = JSON.parse(channel.config)
    const pageAccessToken = config.pageAccessToken

    if (!pageAccessToken) {
      return NextResponse.json({ error: 'Facebook Page Access Token not configured' }, { status: 400 })
    }

    // Send message via Facebook Messenger API
    const sendRes = await fetch(
      `https://graph.facebook.com/v21.0/me/messages?access_token=${pageAccessToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: { id: recipientPsid },
          message: { text: messageText },
        }),
      }
    )

    if (!sendRes.ok) {
      const errorData = await sendRes.json()
      console.error('[Facebook Send] Error:', errorData)
      return NextResponse.json(
        { error: 'Failed to send Facebook message', details: errorData },
        { status: 500 }
      )
    }

    const sendResult = await sendRes.json()
    console.log(`[Facebook Send] ✅ Message sent to ${recipientPsid}, MID: ${sendResult.message_id}`)

    // Store the sent message in the database
    if (conversationId) {
      await db.message.create({
        data: {
          conversationId,
          senderType: 'agent',
          content: messageText,
          contentType: 'text',
          metadata: JSON.stringify({
            facebookMessageId: sendResult.message_id,
            recipientPsid,
          }),
          isRead: false,
          isInternal: false,
        },
      })

      await db.conversation.update({
        where: { id: conversationId },
        data: {
          lastMessage: messageText.substring(0, 200),
          lastMessageAt: new Date(),
        },
      })
    }

    return NextResponse.json({
      success: true,
      messageId: sendResult.message_id,
      recipientPsid,
    })
  } catch (error) {
    console.error('[Facebook Send] Error:', error)
    return NextResponse.json({ error: 'Failed to send Facebook message' }, { status: 500 })
  }
}
