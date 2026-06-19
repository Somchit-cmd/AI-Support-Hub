import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { toJsonString } from '@/lib/automation'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, trigger, conditions, actions, isActive } = body

    const existing = await db.automationRule.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Automation rule not found' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (trigger !== undefined) updateData.trigger = trigger
    if (conditions !== undefined) updateData.conditions = toJsonString(conditions)
    if (actions !== undefined) updateData.actions = toJsonString(actions)
    if (isActive !== undefined) updateData.isActive = isActive

    const rule = await db.automationRule.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ rule })
  } catch (error) {
    console.error('[Automation PATCH] Error:', error)
    return NextResponse.json({ error: 'Failed to update automation rule' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const existing = await db.automationRule.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Automation rule not found' }, { status: 404 })
    }

    await db.automationRule.delete({ where: { id } })

    return NextResponse.json({ message: 'Automation rule deleted successfully' })
  } catch (error) {
    console.error('[Automation DELETE] Error:', error)
    return NextResponse.json({ error: 'Failed to delete automation rule' }, { status: 500 })
  }
}
