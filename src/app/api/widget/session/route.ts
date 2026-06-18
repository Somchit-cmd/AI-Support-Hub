import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Public endpoint for the website widget.
// Creates (or resumes) a customer + conversation for a website visitor and
// returns a sessionId the widget uses for all subsequent calls.
//
// POST /api/widget/session
// Body: { name?, email?, phone? }
//
// The widget stores the returned sessionId in localStorage so returning
// visitors keep the same conversation thread.

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const { name, email, phone, sessionId } = body

    // ---- Resume an existing session ----
    if (sessionId) {
      const convo = await db.conversation.findUnique({
        where: { id: sessionId },
        include: {
          customer: true,
          channel: { select: { type: true, isActive: true } },
        },
      })
      if (
        convo &&
        convo.channel?.type === 'website' &&
        convo.channel?.isActive &&
        convo.status !== 'closed'
      ) {
        return NextResponse.json({ sessionId: convo.id, resumed: true })
      }
      // Otherwise fall through and create a fresh session.
    }

    // ---- Find the active website channel ----
    const websiteChannel = await db.channel.findFirst({
      where: { type: 'website', isActive: true },
    })
    if (!websiteChannel) {
      return NextResponse.json(
        { error: 'Website chat is not available' },
        { status: 503 }
      )
    }

    // ---- Resolve or create the customer ----
    // Prefer matching by email; fall back to phone.
    let customer = await (email ? db.customer.findFirst({ where: { email } }) : Promise.resolve(null))
    if (!customer && phone) {
      customer = await db.customer.findFirst({ where: { phone } })
    }

    const visitorName =
      name || customer?.name || (email ? email.split('@')[0] : 'Website Visitor')

    if (!customer) {
      customer = await db.customer.create({
        data: {
          name: visitorName,
          email: email || null,
          phone: phone || null,
          leadStatus: 'new',
          sentiment: 'neutral',
          lastActivity: new Date(),
        },
      })
    } else {
      // Fill in any newly-provided contact details.
      await db.customer.update({
        where: { id: customer.id },
        data: {
          name: name || customer.name,
          email: email || customer.email,
          phone: phone || customer.phone,
          lastActivity: new Date(),
        },
      })
    }

    // ---- Create the conversation ----
    // The default aiMode for widget conversations follows the global ai_mode
    // setting (default "suggest"). Agents can switch per conversation.
    const aiModeSetting = await db.setting.findUnique({
      where: { key: 'ai_mode' },
    })
    const aiMode = aiModeSetting?.value || 'suggest'

    const welcomeSetting = await db.setting.findUnique({
      where: { key: 'widget_welcome_message' },
    })

    const conversation = await db.conversation.create({
      data: {
        customerId: customer.id,
        channelId: websiteChannel.id,
        status: 'active',
        aiMode,
        priority: 'normal',
        lastMessageAt: new Date(),
      },
    })

    // Post a system welcome message so the visitor sees something immediately.
    const welcomeMessage =
      welcomeSetting?.value || 'Hello! How can we help you today?'
    await db.message.create({
      data: {
        conversationId: conversation.id,
        senderType: 'system',
        content: welcomeMessage,
        contentType: 'text',
        isRead: true,
        isInternal: false,
        metadata: JSON.stringify({ widget: true, kind: 'welcome' }),
      },
    })

    return NextResponse.json({
      sessionId: conversation.id,
      welcomeMessage,
      resumed: false,
    })
  } catch (error) {
    console.error('[Widget Session] Error:', error)
    return NextResponse.json(
      { error: 'Failed to start chat session' },
      { status: 500 }
    )
  }
}
