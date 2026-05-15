import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const mode = searchParams.get('hub.mode')
    const challenge = searchParams.get('hub.challenge')
    const verifyToken = searchParams.get('hub.verify_token')

    // Facebook webhook verification
    // In production, verify the token matches your app's verify token
    if (mode === 'subscribe' && challenge) {
      console.log('[Facebook Webhook] Verification request received')
      // Echo back the challenge for verification
      return new Response(challenge, { status: 200 })
    }

    return NextResponse.json({ error: 'Invalid verification request' }, { status: 400 })
  } catch (error) {
    console.error('[Facebook Webhook GET] Error:', error)
    return NextResponse.json({ error: 'Webhook verification failed' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()

    console.log('[Facebook Webhook] Event received:', JSON.stringify(body, null, 2))

    // Process Facebook webhook events
    if (body.object === 'page') {
      for (const entry of body.entry || []) {
        for (const messagingEvent of entry.messaging || []) {
          const senderId = messagingEvent.sender?.id
          const recipientId = messagingEvent.recipient?.id
          const message = messagingEvent.message

          if (message && message.text) {
            console.log(`[Facebook Webhook] Message from ${senderId} to ${recipientId}: ${message.text}`)

            // In a production app, you would:
            // 1. Find or create a customer by facebookId
            // 2. Find or create a conversation
            // 3. Store the message
            // 4. Trigger AI or agent notification
          }

          // Handle postback events
          if (messagingEvent.postback) {
            console.log(`[Facebook Webhook] Postback from ${senderId}: ${messagingEvent.postback.payload}`)
          }
        }
      }
    }

    // Always return 200 quickly to acknowledge receipt
    return NextResponse.json({ status: 'ok' })
  } catch (error) {
    console.error('[Facebook Webhook POST] Error:', error)
    // Still return 200 to prevent Facebook from retrying
    return NextResponse.json({ status: 'ok' })
  }
}
