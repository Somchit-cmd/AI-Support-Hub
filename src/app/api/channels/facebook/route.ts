import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Connect Facebook Page to the platform
// POST /api/channels/facebook/connect
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { pageId, pageName, pageAccessToken, appId, appSecret, verifyToken } = body

    if (!pageId || !pageName || !pageAccessToken) {
      return NextResponse.json(
        { error: 'Page ID, Page Name, and Page Access Token are required' },
        { status: 400 }
      )
    }

    // Verify the page access token by calling Facebook Graph API
    let isValid = false
    let pageInfo = { name: pageName, id: pageId }
    try {
      const verifyRes = await fetch(
        `https://graph.facebook.com/v21.0/me?access_token=${pageAccessToken}`
      )
      if (verifyRes.ok) {
        const verifyData = await verifyRes.json()
        if (verifyData.id === pageId) {
          isValid = true
          pageInfo = { name: verifyData.name || pageName, id: verifyData.id }
        }
      }
    } catch {
      // Token verification failed
    }

    // Find existing Facebook channel or create one
    const existingChannels = await db.channel.findMany({ where: { type: 'facebook' } })
    const existingChannel = existingChannels.find((c) => {
      try {
        const config = JSON.parse(c.config)
        return config.pageId === pageId
      } catch { return false }
    })

    const config = {
      pageId: pageInfo.id,
      pageName: pageInfo.name,
      pageAccessToken,
      appId: appId || '',
      appSecret: appSecret || '',
      verifyToken: verifyToken || 'ai_support_hub_verify_token',
      isConnected: isValid,
      connectedAt: new Date().toISOString(),
    }

    let channel
    if (existingChannel) {
      // Update existing channel
      channel = await db.channel.update({
        where: { id: existingChannel.id },
        data: {
          name: `Facebook - ${pageInfo.name}`,
          config: JSON.stringify(config),
          isActive: isValid,
        },
      })
    } else {
      // Create new channel
      channel = await db.channel.create({
        data: {
          type: 'facebook',
          name: `Facebook - ${pageInfo.name}`,
          config: JSON.stringify(config),
          isActive: isValid,
        },
      })
    }

    // Save verify token to settings for webhook verification
    await db.setting.upsert({
      where: { key: 'facebook_verify_token' },
      update: { value: config.verifyToken },
      create: { key: 'facebook_verify_token', value: config.verifyToken, category: 'channels' },
    })

    // Save page access token to settings
    await db.setting.upsert({
      where: { key: 'facebook_page_access_token' },
      update: { value: pageAccessToken },
      create: { key: 'facebook_page_access_token', value: pageAccessToken, category: 'channels' },
    })

    return NextResponse.json({
      channel,
      isValid,
      message: isValid
        ? `✅ Facebook Page "${pageInfo.name}" connected successfully!`
        : `⚠️ Page saved but token verification failed. Please check your Page Access Token.`,
    })
  } catch (error) {
    console.error('[Facebook Connect] Error:', error)
    return NextResponse.json({ error: 'Failed to connect Facebook Page' }, { status: 500 })
  }
}

// Disconnect Facebook Page
// POST /api/channels/facebook/disconnect
export async function DELETE() {
  try {
    const channels = await db.channel.findMany({ where: { type: 'facebook' } })
    for (const channel of channels) {
      const config = JSON.parse(channel.config)
      await db.channel.update({
        where: { id: channel.id },
        data: {
          config: JSON.stringify({ ...config, isConnected: false, pageAccessToken: '' }),
          isActive: false,
        },
      })
    }

    return NextResponse.json({ message: 'Facebook Page disconnected' })
  } catch (error) {
    console.error('[Facebook Disconnect] Error:', error)
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 })
  }
}
