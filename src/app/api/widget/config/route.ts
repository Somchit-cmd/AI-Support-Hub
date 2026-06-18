import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Public endpoint: returns the widget's display configuration.
// GET /api/widget/config
//
// The widget.js script calls this on load to pick up the primary color,
// welcome message, and position configured in Settings → Widget, so admins
// can restyle the widget without redeploying the embed snippet.

export async function GET() {
  try {
    const websiteChannel = await db.channel.findFirst({
      where: { type: 'website', isActive: true },
    })
    if (!websiteChannel) {
      return NextResponse.json(
        { available: false, error: 'Website chat is not enabled' },
        { status: 503 }
      )
    }

    const settings = await db.setting.findMany({
      where: {
        key: {
          in: [
            'company_name',
            'widget_primary_color',
            'widget_welcome_message',
            'widget_position',
          ],
        },
      },
    })

    const get = (key: string) => settings.find((s) => s.key === key)?.value

    return NextResponse.json({
      available: true,
      companyName: get('company_name') || 'Support',
      primaryColor: get('widget_primary_color') || '#0F172A',
      welcomeMessage: get('widget_welcome_message') || 'Hello! How can we help you today?',
      position: get('widget_position') || 'bottom-right',
    })
  } catch (error) {
    console.error('[Widget Config] Error:', error)
    return NextResponse.json(
      { available: false, error: 'Failed to load widget config' },
      { status: 500 }
    )
  }
}
