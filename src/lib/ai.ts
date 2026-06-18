// AI Service - Uses configurable AI providers (z-ai, OpenAI, Google Gemini, Custom)
// This module should ONLY be used in backend (API routes)

import { db } from '@/lib/db'
import {
  generateWithProvider,
  getAIProviderConfig,
  clearProviderConfigCache,
  AI_PROVIDERS,
  type AIProviderType,
} from './ai-providers'

// Re-export provider utilities for use in API routes
export { clearProviderConfigCache, AI_PROVIDERS, type AIProviderType }

// Default system prompt for customer support
const DEFAULT_SYSTEM_PROMPT = `You are an AI customer support assistant for a company. You are helpful, professional, and knowledgeable.

Guidelines:
- Always be polite and professional
- Answer based on the company knowledge base when available
- Support English, Thai, and Lao languages - detect and respond in the customer's language
- If you don't know the answer, say so honestly and suggest connecting with a human agent
- Keep responses concise but thorough
- Use the customer's name when available
- Never share internal company information not in the knowledge base
- If a customer seems frustrated, show empathy and offer to escalate to a human agent

When responding in Thai: Use polite particles (ครับ/ค่ะ) appropriately.
When responding in Lao: Use polite language conventions.`

// AI Settings interface
export interface AISettings {
  aiMode: string
  aiPersonality: string
  aiSystemPrompt: string
  aiTemperature: number
  aiMaxTokens: number
  ragEnabled: boolean
  ragMaxDocuments: number
  ragMaxFaqs: number
  aiProvider: AIProviderType
  aiProviderApiKey: string
  aiProviderModel: string
  aiProviderBaseUrl: string
}

// Default AI settings
const DEFAULT_AI_SETTINGS: AISettings = {
  aiMode: 'suggest',
  aiPersonality: 'professional',
  aiSystemPrompt: '',
  aiTemperature: 0.7,
  aiMaxTokens: 2048,
  ragEnabled: true,
  ragMaxDocuments: 5,
  ragMaxFaqs: 10,
  aiProvider: 'z-ai',
  aiProviderApiKey: '',
  aiProviderModel: 'default',
  aiProviderBaseUrl: '',
}

// Load AI settings from database
export async function getAISettings(): Promise<AISettings> {
  try {
    const aiSettingKeys = [
      'ai_mode',
      'ai_personality',
      'ai_system_prompt',
      'ai_temperature',
      'ai_max_tokens',
      'rag_enabled',
      'rag_max_documents',
      'rag_max_faqs',
      'ai_provider',
      'ai_provider_api_key',
      'ai_provider_model',
      'ai_provider_base_url',
    ]

    const settings = await db.setting.findMany({
      where: { key: { in: aiSettingKeys } },
    })

    const get = (key: string) => settings.find((s) => s.key === key)?.value || ''

    const provider = (get('ai_provider') || 'z-ai') as AIProviderType

    return {
      aiMode: get('ai_mode') || DEFAULT_AI_SETTINGS.aiMode,
      aiPersonality: get('ai_personality') || DEFAULT_AI_SETTINGS.aiPersonality,
      aiSystemPrompt: get('ai_system_prompt') || DEFAULT_AI_SETTINGS.aiSystemPrompt,
      aiTemperature: Number(get('ai_temperature')) || DEFAULT_AI_SETTINGS.aiTemperature,
      aiMaxTokens: Number(get('ai_max_tokens')) || DEFAULT_AI_SETTINGS.aiMaxTokens,
      ragEnabled: get('rag_enabled') === 'false' ? false : DEFAULT_AI_SETTINGS.ragEnabled,
      ragMaxDocuments: Number(get('rag_max_documents')) || DEFAULT_AI_SETTINGS.ragMaxDocuments,
      ragMaxFaqs: Number(get('rag_max_faqs')) || DEFAULT_AI_SETTINGS.ragMaxFaqs,
      aiProvider: provider,
      aiProviderApiKey: get('ai_provider_api_key'),
      aiProviderModel: get('ai_provider_model') || AI_PROVIDERS[provider]?.defaultModel || 'default',
      aiProviderBaseUrl: get('ai_provider_base_url'),
    }
  } catch (error) {
    console.error('[AI Service] Error loading settings:', error)
    return DEFAULT_AI_SETTINGS
  }
}

// Get knowledge context using RAG (smarter retrieval with keyword matching)
export async function getKnowledgeContext(
  customerMessage: string,
  maxDocuments?: number,
  maxFaqs?: number
): Promise<string> {
  try {
    const settings = await getAISettings()

    if (!settings.ragEnabled) {
      return ''
    }

    const docLimit = maxDocuments || settings.ragMaxDocuments
    const faqLimit = maxFaqs || settings.ragMaxFaqs

    // Load active documents and FAQs
    const [documents, faqs] = await Promise.all([
      db.document.findMany({ where: { isActive: true } }),
      db.faq.findMany({ where: { isActive: true } }),
    ])

    // Extract keywords from customer message (simple keyword matching)
    const messageWords = customerMessage
      .toLowerCase()
      .replace(/[^\w\s\u0E00-\u0E7F\u0E80-\u0EFF]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2)

    // Score FAQs by relevance
    const scoredFaqs = faqs.map((faq) => {
      const questionWords = faq.question.toLowerCase().split(/\s+/)
      const answerWords = faq.answer.toLowerCase().split(/\s+/)
      const allWords = [...questionWords, ...answerWords]

      let score = 0
      for (const word of messageWords) {
        if (allWords.some((w) => w.includes(word) || word.includes(w))) {
          score += 2 // Exact partial match
        }
      }
      // Category match bonus
      if (messageWords.some((w) => faq.category.toLowerCase().includes(w))) {
        score += 1
      }

      return { faq, score }
    })

    // Sort FAQs by relevance score and take top matches
    const relevantFaqs = scoredFaqs
      .sort((a, b) => b.score - a.score)
      .slice(0, faqLimit)
      .filter((f) => f.score > 0 || faqs.length <= faqLimit) // Include all if few FAQs
      .map((f) => f.faq)

    // Score documents by relevance
    const scoredDocs = documents.map((doc) => {
      const docWords = (doc.name + ' ' + doc.content).toLowerCase().split(/\s+/)
      let score = 0
      for (const word of messageWords) {
        if (docWords.some((w) => w.includes(word) || word.includes(w))) {
          score += 1
        }
      }

      return { doc, score }
    })

    // Sort documents by relevance score and take top matches
    const relevantDocs = scoredDocs
      .sort((a, b) => b.score - a.score)
      .slice(0, docLimit)
      .filter((d) => d.score > 0 || documents.length <= docLimit) // Include all if few docs
      .map((d) => d.doc)

    // Build knowledge context
    const knowledgeContext = [
      ...relevantDocs.map((d) => `[Document: ${d.name}]\n${d.content.substring(0, 500)}`),
      ...relevantFaqs.map((f) => `[FAQ] Q: ${f.question}\nA: ${f.answer}`),
    ].join('\n\n')

    return knowledgeContext
  } catch (error) {
    console.error('[AI Service] Error loading knowledge context:', error)
    return ''
  }
}

export interface AIChatOptions {
  messages: { role: string; content: string }[]
  systemPrompt?: string
  knowledgeContext?: string
  customerName?: string
  conversationHistory?: string
  temperature?: number
  maxTokens?: number
}

export interface AIChatResponse {
  content: string
  tokens: number
  model: string
  responseTime: number
  provider: AIProviderType
}

export async function generateAIResponse(options: AIChatOptions): Promise<AIChatResponse> {
  const startTime = Date.now()

  const systemPrompt = options.systemPrompt || DEFAULT_SYSTEM_PROMPT

  // Build the full prompt with context
  let fullSystemPrompt = systemPrompt

  if (options.customerName) {
    fullSystemPrompt += `\n\nCurrent customer name: ${options.customerName}`
  }

  if (options.knowledgeContext) {
    fullSystemPrompt += `\n\n--- RELEVANT KNOWLEDGE BASE ---\n${options.knowledgeContext}\n--- END KNOWLEDGE BASE ---\n\nUse the above knowledge to answer the customer's question. If the answer is not in the knowledge base, say you don't have that information.`
  }

  if (options.conversationHistory) {
    fullSystemPrompt += `\n\n--- CONVERSATION HISTORY SUMMARY ---\n${options.conversationHistory}\n--- END HISTORY ---`
  }

  const messages = [
    { role: 'assistant', content: fullSystemPrompt },
    ...options.messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  ]

  try {
    // Use the provider abstraction layer
    const result = await generateWithProvider(
      messages,
      options.temperature,
      options.maxTokens,
    )

    return {
      content: result.content,
      tokens: result.tokens,
      model: result.model,
      responseTime: Date.now() - startTime,
      provider: result.provider,
    }
  } catch (error) {
    console.error('[AI Service] Error generating response:', error)
    throw new Error(
      error instanceof Error ? error.message : 'Failed to generate AI response'
    )
  }
}

// Test AI with RAG - simulates a customer message and returns full details
export async function testAIWithRAG(message: string): Promise<{
  response: string
  knowledgeContext: string
  model: string
  tokens: number
  responseTime: number
  provider: AIProviderType
}> {
  const startTime = Date.now()
  const settings = await getAISettings()

  // Get knowledge context based on the test message
  const knowledgeContext = await getKnowledgeContext(message)

  // Generate AI response
  const aiResponse = await generateAIResponse({
    messages: [{ role: 'user', content: message }],
    knowledgeContext,
    temperature: settings.aiTemperature,
    maxTokens: settings.aiMaxTokens,
  })

  return {
    response: aiResponse.content,
    knowledgeContext,
    model: aiResponse.model,
    tokens: aiResponse.tokens,
    responseTime: Date.now() - startTime,
    provider: aiResponse.provider,
  }
}

// Generate AI suggested replies for agents
export async function generateSuggestedReplies(
  conversationContext: string,
  lastMessages: string,
  count: number = 3
): Promise<string[]> {
  const messages = [
    {
      role: 'assistant',
      content: `You are a customer support assistant suggesting reply options for a human agent. 
Generate ${count} different suggested replies based on the conversation context. 
Each reply should have a different tone or approach.
Return ONLY a JSON array of strings, no other text. Example: ["reply1", "reply2", "reply3"]`,
    },
    {
      role: 'user',
      content: `Conversation context: ${conversationContext}\n\nLast messages: ${lastMessages}\n\nGenerate ${count} suggested replies:`,
    },
  ]

  try {
    const result = await generateWithProvider(messages)
    const content = result.content || '[]'
    const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    return JSON.parse(cleaned)
  } catch {
    return ['Thank you for your message. Let me look into this for you.']
  }
}

// Detect language of input text
export async function detectLanguage(text: string): Promise<string> {
  const messages = [
    {
      role: 'assistant',
      content:
        'Detect the language of the following text. Respond with ONLY one word: "english", "thai", "lao", or "other". No other text.',
    },
    {
      role: 'user',
      content: text.substring(0, 200),
    },
  ]

  try {
    const result = await generateWithProvider(messages)
    return result.content?.toLowerCase().trim() || 'english'
  } catch {
    return 'english'
  }
}

// Analyze customer sentiment
export async function analyzeSentiment(
  text: string
): Promise<'positive' | 'neutral' | 'negative'> {
  const messages = [
    {
      role: 'assistant',
      content:
        'Analyze the sentiment of the following text. Respond with ONLY one word: "positive", "neutral", or "negative". No other text.',
    },
    {
      role: 'user',
      content: text.substring(0, 500),
    },
  ]

  try {
    const result = await generateWithProvider(messages)
    const parsed = result.content?.toLowerCase().trim() || 'neutral'
    if (['positive', 'negative'].includes(parsed)) return parsed as 'positive' | 'negative'
    return 'neutral'
  } catch {
    return 'neutral'
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared AI reply pipeline
// Generates, saves, logs, and records usage for an AI reply to a conversation.
// Used by both the /api/conversations/[id]/ai-reply route AND the webhook
// auto-reply trigger (when aiMode === 'auto').
// Returns the created message, AI log, and cost — or throws on AI failure.
// ─────────────────────────────────────────────────────────────────────────────

import { recordUsage, calculateCost } from './ai-usage'

export interface GenerateAndSaveAIReplyResult {
  message: {
    id: string
    content: string
  }
  aiLog: {
    id: string
    tokens: number
    model: string
    responseTime: number
    estimatedCost: number
  }
  content: string
}

export async function generateAndSaveAIReply(
  conversationId: string
): Promise<GenerateAndSaveAIReplyResult> {
  const conversation = await db.conversation.findUnique({
    where: { id: conversationId },
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
    throw new Error('Conversation not found')
  }

  if (conversation.aiMode === 'human') {
    throw new Error('AI replies are disabled for this conversation (human mode)')
  }

  const conversationHistory = conversation.messages
    .map((m) => `${m.senderType}: ${m.content}`)
    .join('\n')

  const recentMessages = conversation.messages.slice(-10).map((m) => ({
    role: m.senderType === 'customer' ? 'user' : 'assistant',
    content: m.content,
  }))

  const aiSettings = await getAISettings()

  const lastCustomerMessage =
    conversation.messages.filter((m) => m.senderType === 'customer').pop()?.content || ''

  const knowledgeContext = await getKnowledgeContext(lastCustomerMessage)

  const aiResponse = await generateAIResponse({
    messages: recentMessages,
    customerName: conversation.customer.name,
    knowledgeContext,
    conversationHistory,
    temperature: aiSettings.aiTemperature,
    maxTokens: aiSettings.aiMaxTokens,
  })

  const message = await db.message.create({
    data: {
      conversationId,
      content: aiResponse.content,
      senderType: 'ai',
      contentType: 'text',
      metadata: JSON.stringify({ model: aiResponse.model, tokens: aiResponse.tokens }),
    },
    include: {
      sender: { select: { id: true, name: true, avatar: true } },
    },
  })

  const promptTokens = Math.round(aiResponse.tokens * 0.6)
  const completionTokens = aiResponse.tokens - promptTokens
  const estimatedCost = calculateCost(
    aiResponse.provider,
    aiResponse.model,
    promptTokens,
    completionTokens
  )

  const aiLog = await db.aiLog.create({
    data: {
      conversationId,
      messageId: message.id,
      prompt: conversationHistory.slice(-1000),
      response: aiResponse.content,
      tokens: aiResponse.tokens,
      promptTokens,
      completionTokens,
      model: aiResponse.model,
      provider: aiResponse.provider,
      responseTime: aiResponse.responseTime,
      estimatedCost,
    },
  })

  await recordUsage({
    provider: aiResponse.provider,
    model: aiResponse.model,
    promptTokens,
    completionTokens,
    totalTokens: aiResponse.tokens,
    responseTime: aiResponse.responseTime,
  })

  await db.conversation.update({
    where: { id: conversationId },
    data: {
      lastMessage: aiResponse.content,
      lastMessageAt: new Date(),
    },
  })

  return {
    message,
    aiLog: {
      id: aiLog.id,
      tokens: aiLog.tokens,
      model: aiLog.model,
      responseTime: aiLog.responseTime,
      estimatedCost,
    },
    content: aiResponse.content,
  }
}

// Summarize a conversation
export async function summarizeConversation(messages: string): Promise<string> {
  const formattedMessages = [
    {
      role: 'assistant',
      content:
        'Summarize the following customer support conversation in 2-3 sentences. Focus on the main issue and resolution status.',
    },
    {
      role: 'user',
      content: messages,
    },
  ]

  try {
    const result = await generateWithProvider(formattedMessages)
    return result.content || 'No summary available.'
  } catch {
    return 'No summary available.'
  }
}
