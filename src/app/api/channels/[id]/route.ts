import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, config, isActive } = body

    const existing = await db.channel.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (config !== undefined) updateData.config = JSON.stringify(config)
    if (isActive !== undefined) updateData.isActive = isActive

    const channel = await db.channel.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ channel })
  } catch (error) {
    console.error('[Channel PATCH] Error:', error)
    return NextResponse.json({ error: 'Failed to update channel' }, { status: 500 })
  }
}
