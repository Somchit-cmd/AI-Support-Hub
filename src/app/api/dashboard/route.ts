import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    // Basic counts
    const [
      totalConversations,
      activeConversations,
      totalMessages,
      aiMessages,
      humanMessages,
      customerMessages,
      totalCustomers,
    ] = await Promise.all([
      db.conversation.count(),
      db.conversation.count({ where: { status: 'active' } }),
      db.message.count(),
      db.message.count({ where: { senderType: 'ai' } }),
      db.message.count({ where: { senderType: 'agent' } }),
      db.message.count({ where: { senderType: 'customer' } }),
      db.customer.count(),
    ])

    // AI resolution rate
    const aiResolutionRate = customerMessages > 0
      ? Math.round((aiMessages / customerMessages) * 100)
      : 0

    // Average response time from AI logs
    const aiLogs = await db.aiLog.findMany({
      select: { responseTime: true },
    })
    const avgResponseTime = aiLogs.length > 0
      ? Math.round(aiLogs.reduce((sum, log) => sum + log.responseTime, 0) / aiLogs.length)
      : 0

    // Conversations by channel
    const channels = await db.channel.findMany({
      include: { _count: { select: { conversations: true } } },
    })
    const conversationsByChannel = channels.map((ch) => ({
      type: ch.type,
      name: ch.name,
      count: ch._count.conversations,
    }))

    // Messages by day (last 7 days)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const recentMessages = await db.message.findMany({
      where: {
        createdAt: { gte: sevenDaysAgo },
      },
      select: { createdAt: true },
    })

    const messagesByDayMap = new Map<string, number>()
    for (let i = 6; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]
      messagesByDayMap.set(dateStr, 0)
    }

    recentMessages.forEach((msg) => {
      const dateStr = msg.createdAt.toISOString().split('T')[0]
      if (messagesByDayMap.has(dateStr)) {
        messagesByDayMap.set(dateStr, (messagesByDayMap.get(dateStr) || 0) + 1)
      }
    })

    const messagesByDay = Array.from(messagesByDayMap.entries()).map(([date, count]) => ({
      date,
      count,
    }))

    // Sentiment distribution
    const sentimentCounts = await db.customer.groupBy({
      by: ['sentiment'],
      _count: { sentiment: true },
    })
    const sentimentDistribution = sentimentCounts.map((s) => ({
      sentiment: s.sentiment,
      count: s._count.sentiment,
    }))

    // Top agents by assigned conversations
    const topAgentsRaw = await db.user.findMany({
      where: { role: { in: ['admin', 'agent'] } },
      include: {
        _count: { select: { assignedConversations: true } },
      },
      orderBy: {
        assignedConversations: { _count: 'desc' },
      },
      take: 5,
    })
    const topAgents = topAgentsRaw.map((agent) => ({
      id: agent.id,
      name: agent.name,
      email: agent.email,
      avatar: agent.avatar,
      role: agent.role,
      assignedConversations: agent._count.assignedConversations,
    }))

    return NextResponse.json({
      totalConversations,
      activeConversations,
      totalMessages,
      aiMessages,
      humanMessages,
      customerMessages,
      totalCustomers,
      aiResolutionRate,
      avgResponseTime,
      conversationsByChannel,
      messagesByDay,
      sentimentDistribution,
      topAgents,
    })
  } catch (error) {
    console.error('[Dashboard GET] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch dashboard stats' }, { status: 500 })
  }
}
