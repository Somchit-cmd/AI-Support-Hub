import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const customer = await db.customer.findUnique({
      where: { id },
      include: {
        tags: true,
        conversations: {
          include: {
            channel: true,
            assignedTo: { select: { id: true, name: true, avatar: true } },
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
          orderBy: { lastMessageAt: 'desc' },
        },
      },
    })

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    // Get total message count across all conversations
    const messageCount = await db.message.count({
      where: {
        conversation: { customerId: id },
      },
    })

    return NextResponse.json({
      customer: {
        ...customer,
        messageCount,
      },
    })
  } catch (error) {
    console.error('[Customer GET] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch customer' }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, email, phone, leadStatus, sentiment, notes, tags } = body

    const existing = await db.customer.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (email !== undefined) updateData.email = email
    if (phone !== undefined) updateData.phone = phone
    if (leadStatus !== undefined) updateData.leadStatus = leadStatus
    if (sentiment !== undefined) updateData.sentiment = sentiment
    if (notes !== undefined) updateData.notes = notes

    // Handle tags update - replace all tags
    if (tags !== undefined) {
      await db.customerTag.deleteMany({ where: { customerId: id } })
      if (Array.isArray(tags) && tags.length > 0) {
        updateData.tags = {
          create: tags.map((tag: { name: string; color?: string }) => ({
            name: tag.name,
            color: tag.color || '#6B7280',
          })),
        }
      }
    }

    const customer = await db.customer.update({
      where: { id },
      data: updateData,
      include: { tags: true },
    })

    return NextResponse.json({ customer })
  } catch (error) {
    console.error('[Customer PATCH] Error:', error)
    return NextResponse.json({ error: 'Failed to update customer' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const existing = await db.customer.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    // Cascade deletes will handle related records
    await db.customer.delete({ where: { id } })

    return NextResponse.json({ message: 'Customer deleted successfully' })
  } catch (error) {
    console.error('[Customer DELETE] Error:', error)
    return NextResponse.json({ error: 'Failed to delete customer' }, { status: 500 })
  }
}
