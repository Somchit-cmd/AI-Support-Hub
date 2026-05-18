import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { generateAIResponse, getKnowledgeContext, getAISettings } from '@/lib/ai'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const conversation = await db.conversation.findUnique({
      where: { id },
      include: {
        customer: { include: { tags: true } },
        messages: {
          orderBy: { createdAt: 'asc' },
          include: {
            sender: { select: { id: true, name: true, avatar: true } },
          },
        },
      },
    })

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    // Check AI mode - only allow in auto or suggest mode
    if (conversation.aiMode === 'human') {
      return NextResponse.json(
        { error: 'AI replies are disabled for this conversation (human mode)' },
        { status: 400 }
      )
    }

    // Build conversation context for AI
    const conversationHistory = conversation.messages
      .map((m) => `${m.senderType}: ${m.content}`)
      .join('\n')

    const recentMessages = conversation.messages.slice(-10).map((m) => ({
      role: m.senderType === 'customer' ? 'user' : 'assistant',
      content: m.content,
    }))

    // Load AI settings from database
    const aiSettings = await getAISettings()

    // Get the last customer message for smarter RAG retrieval
    const lastCustomerMessage = conversation.messages
      .filter((m) => m.senderType === 'customer')
      .pop()?.content || ''

    // Load knowledge base context using the smarter RAG function
    const knowledgeContext = await getKnowledgeContext(lastCustomerMessage)

    // Call AI service with settings from database
    const aiResponse = await generateAIResponse({
      messages: recentMessages,
      customerName: conversation.customer.name,
      knowledgeContext,
      conversationHistory,
      temperature: aiSettings.aiTemperature,
      maxTokens: aiSettings.aiMaxTokens,
    })

    // Save AI message
    const message = await db.message.create({
      data: {
        conversationId: id,
        content: aiResponse.content,
        senderType: 'ai',
        contentType: 'text',
        metadata: JSON.stringify({ model: aiResponse.model, tokens: aiResponse.tokens }),
      },
      include: {
        sender: { select: { id: true, name: true, avatar: true } },
      },
    })

    // Save AI log
    const aiLog = await db.aiLog.create({
      data: {
        conversationId: id,
        messageId: message.id,
        prompt: conversationHistory.slice(-1000),
        response: aiResponse.content,
        tokens: aiResponse.tokens,
        model: aiResponse.model,
        responseTime: aiResponse.responseTime,
      },
    })

    // Update conversation
    await db.conversation.update({
      where: { id },
      data: {
        lastMessage: aiResponse.content,
        lastMessageAt: new Date(),
      },
    })

    return NextResponse.json({
      message,
      aiLog: {
        id: aiLog.id,
        tokens: aiLog.tokens,
        model: aiLog.model,
        responseTime: aiLog.responseTime,
      },
    })
  } catch (error) {
    console.error('[AI Reply] Error:', error)
    return NextResponse.json({ error: 'Failed to generate AI reply' }, { status: 500 })
  }
}
