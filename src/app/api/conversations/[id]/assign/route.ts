import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { agentId, assignedBy } = body

    if (!agentId) {
      return NextResponse.json({ error: 'agentId is required' }, { status: 400 })
    }

    const [conversation, agent] = await Promise.all([
      db.conversation.findUnique({ where: { id } }),
      db.user.findUnique({ where: { id: agentId } }),
    ])

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    // Create assignment record
    const assignment = await db.assignment.create({
      data: {
        conversationId: id,
        agentId,
        assignedBy: assignedBy || null,
      },
      include: {
        agent: { select: { id: true, name: true, email: true, avatar: true, role: true } },
      },
    })

    // Update conversation with assigned agent
    const updatedConversation = await db.conversation.update({
      where: { id },
      data: { assignedToId: agentId },
      include: {
        customer: { include: { tags: true } },
        channel: true,
        assignedTo: { select: { id: true, name: true, email: true, avatar: true, role: true, status: true } },
      },
    })

    // Create notification for the assigned agent
    await db.notification.create({
      data: {
        userId: agentId,
        type: 'assignment',
        title: 'New Conversation Assigned',
        message: `You have been assigned to a conversation with ${updatedConversation.customer.name}`,
        link: `/conversations/${id}`,
      },
    })

    return NextResponse.json({ assignment, conversation: updatedConversation })
  } catch (error) {
    console.error('[Assign] Error:', error)
    return NextResponse.json({ error: 'Failed to assign conversation' }, { status: 500 })
  }
}
