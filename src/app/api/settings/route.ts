import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const settings = await db.setting.findMany({
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    })

    // Group settings by category
    const grouped = settings.reduce<Record<string, typeof settings>>((acc, setting) => {
      if (!acc[setting.category]) {
        acc[setting.category] = []
      }
      acc[setting.category].push(setting)
      return acc
    }, {})

    return NextResponse.json({ settings, grouped })
  } catch (error) {
    console.error('[Settings GET] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { settings } = body as { settings: Array<{ key: string; value: string }> }

    if (!settings || !Array.isArray(settings)) {
      return NextResponse.json(
        { error: 'settings array is required' },
        { status: 400 }
      )
    }

    // Upsert each setting
    const results = await Promise.all(
      settings.map((setting) =>
        db.setting.upsert({
          where: { key: setting.key },
          update: { value: setting.value },
          create: { key: setting.key, value: setting.value },
        })
      )
    )

    return NextResponse.json({ settings: results })
  } catch (error) {
    console.error('[Settings POST] Error:', error)
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }
}
