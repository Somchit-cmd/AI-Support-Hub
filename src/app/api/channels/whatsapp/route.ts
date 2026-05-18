import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Connect WhatsApp Business to the platform
// POST /api/channels/whatsapp/connect
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      phoneNumberId,
      businessAccountId,
      whatsappAccessToken,
      whatsappPhoneNumber,
      businessName,
      verifyToken,
      wabaId,
    } = body

    if (!phoneNumberId || !whatsappAccessToken) {
      return NextResponse.json(
        { error: 'Phone Number ID and Access Token are required' },
        { status: 400 }
      )
    }

    // Verify the access token by calling WhatsApp Cloud API
    let isValid = false
    let verifiedPhoneNumber = whatsappPhoneNumber || ''
    try {
      const verifyRes = await fetch(
        `https://graph.facebook.com/v21.0/${phoneNumberId}?access_token=${whatsappAccessToken}`
      )
      if (verifyRes.ok) {
        const verifyData = await verifyRes.json()
        if (verifyData.verified_name) {
          isValid = true
          verifiedPhoneNumber = verifyData.display_phone_number || verifiedPhoneNumber
        }
      }
    } catch {
      // Token verification failed
    }

    // Find existing WhatsApp channel or create one
    const existingChannels = await db.channel.findMany({ where: { type: 'whatsapp' } })
    const existingChannel = existingChannels.find((c) => {
      try {
        const config = JSON.parse(c.config)
        return config.phoneNumberId === phoneNumberId
      } catch { return false }
    })

    const config = {
      phoneNumberId,
      businessAccountId: businessAccountId || '',
      whatsappAccessToken,
      whatsappPhoneNumber: verifiedPhoneNumber,
      businessName: businessName || '',
      wabaId: wabaId || businessAccountId || '',
      verifyToken: verifyToken || 'ai_support_hub_verify_token',
      isConnected: isValid,
      connectedAt: new Date().toISOString(),
    }

    let channel
    if (existingChannel) {
      channel = await db.channel.update({
        where: { id: existingChannel.id },
        data: {
          name: `WhatsApp - ${businessName || verifiedPhoneNumber || phoneNumberId}`,
          config: JSON.stringify(config),
          isActive: isValid,
        },
      })
    } else {
      channel = await db.channel.create({
        data: {
          type: 'whatsapp',
          name: `WhatsApp - ${businessName || verifiedPhoneNumber || phoneNumberId}`,
          config: JSON.stringify(config),
          isActive: isValid,
        },
      })
    }

    // Save verify token to settings for webhook verification
    await db.setting.upsert({
      where: { key: 'whatsapp_verify_token' },
      update: { value: config.verifyToken },
      create: { key: 'whatsapp_verify_token', value: config.verifyToken, category: 'channels' },
    })

    // Save access token to settings
    await db.setting.upsert({
      where: { key: 'whatsapp_access_token' },
      update: { value: whatsappAccessToken },
      create: { key: 'whatsapp_access_token', value: whatsappAccessToken, category: 'channels' },
    })

    return NextResponse.json({
      channel,
      isValid,
      message: isValid
        ? `✅ WhatsApp Business "${businessName || verifiedPhoneNumber}" connected successfully!`
        : `⚠️ Configuration saved but token verification failed. Please check your credentials.`,
    })
  } catch (error) {
    console.error('[WhatsApp Connect] Error:', error)
    return NextResponse.json({ error: 'Failed to connect WhatsApp Business' }, { status: 500 })
  }
}

// Disconnect WhatsApp Business
export async function DELETE() {
  try {
    const channels = await db.channel.findMany({ where: { type: 'whatsapp' } })
    for (const channel of channels) {
      const config = JSON.parse(channel.config)
      await db.channel.update({
        where: { id: channel.id },
        data: {
          config: JSON.stringify({ ...config, isConnected: false, whatsappAccessToken: '' }),
          isActive: false,
        },
      })
    }

    return NextResponse.json({ message: 'WhatsApp Business disconnected' })
  } catch (error) {
    console.error('[WhatsApp Disconnect] Error:', error)
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 })
  }
}
