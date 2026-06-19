import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { toJsonString } from '@/lib/automation'

export async function GET() {
  try {
    const rules = await db.automationRule.findMany({
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ rules })
  } catch (error) {
    console.error('[Automation GET] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch automation rules' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, trigger, conditions, actions, isActive } = body

    if (!name || !trigger) {
      return NextResponse.json(
        { error: 'name and trigger are required' },
        { status: 400 }
      )
    }

    const rule = await db.automationRule.create({
      data: {
        name,
        trigger,
        // toJsonString prevents the double-encode that happened when the UI
        // sent an already-stringified '{}' value (it became '"{}"' before).
        conditions: toJsonString(conditions),
        actions: toJsonString(actions),
        isActive: isActive !== undefined ? isActive : true,
      },
    })

    return NextResponse.json({ rule }, { status: 201 })
  } catch (error) {
    console.error('[Automation POST] Error:', error)
    return NextResponse.json({ error: 'Failed to create automation rule' }, { status: 500 })
  }
}
