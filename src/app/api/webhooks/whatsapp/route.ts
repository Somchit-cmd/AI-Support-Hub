import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const mode = searchParams.get('hub.mode')
    const challenge = searchParams.get('hub.challenge')
    const verifyToken = searchParams.get('hub.verify_token')

    // WhatsApp webhook verification
    if (mode === 'subscribe' && challenge) {
      console.log('[WhatsApp Webhook] Verification request received')
      return new Response(challenge, { status: 200 })
    }

    return NextResponse.json({ error: 'Invalid verification request' }, { status: 400 })
  } catch (error) {
    console.error('[WhatsApp Webhook GET] Error:', error)
    return NextResponse.json({ error: 'Webhook verification failed' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()

    console.log('[WhatsApp Webhook] Event received:', JSON.stringify(body, null, 2))

    // Process WhatsApp webhook events
    if (body.object) {
      for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
          const messages = change.value?.messages

          if (messages) {
            for (const msg of messages) {
              const from = msg.from
              const text = msg.text?.body
              const type = msg.type

              console.log(`[WhatsApp Webhook] Message from ${from}, type: ${type}, text: ${text}`)

              // In a production app, you would:
              // 1. Find or create a customer by whatsappPhone
              // 2. Find or create a conversation
              // 3. Store the message
              // 4. Trigger AI or agent notification
            }
          }

          // Handle status updates
          const statuses = change.value?.statuses
          if (statuses) {
            for (const status of statuses) {
              console.log(`[WhatsApp Webhook] Status update: ${status.id} -> ${status.status}`)
            }
          }
        }
      }
    }

    // Always return 200 quickly to acknowledge receipt
    return NextResponse.json({ status: 'ok' })
  } catch (error) {
    console.error('[WhatsApp Webhook POST] Error:', error)
    // Still return 200 to prevent WhatsApp from retrying
    return NextResponse.json({ status: 'ok' })
  }
}
