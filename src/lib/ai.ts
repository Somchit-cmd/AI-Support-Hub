// AI Service - Uses z-ai-web-dev-sdk for chat completions
// This module should ONLY be used in backend (API routes)

import ZAI from 'z-ai-web-dev-sdk'

let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null

async function getZAI() {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create()
  }
  return zaiInstance
}

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

export interface AIChatOptions {
  messages: { role: string; content: string }[]
  systemPrompt?: string
  knowledgeContext?: string
  customerName?: string
  conversationHistory?: string
}

export interface AIChatResponse {
  content: string
  tokens: number
  model: string
  responseTime: number
}

export async function generateAIResponse(options: AIChatOptions): Promise<AIChatResponse> {
  const startTime = Date.now()
  const zai = await getZAI()

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
    { role: 'assistant' as const, content: fullSystemPrompt },
    ...options.messages.map(m => ({
      role: (m.role === 'assistant' ? 'assistant' : 'user') as 'user' | 'assistant',
      content: m.content,
    })),
  ]

  try {
    const completion = await zai.chat.completions.create({
      messages,
      thinking: { type: 'disabled' },
    })

    const content = completion.choices[0]?.message?.content || 'I apologize, but I was unable to generate a response. Please try again or connect with a human agent.'
    const tokens = completion.usage?.total_tokens || 0
    const responseTime = Date.now() - startTime

    return {
      content,
      tokens,
      model: completion.model || 'gpt-4',
      responseTime,
    }
  } catch (error) {
    console.error('[AI Service] Error generating response:', error)
    throw new Error('Failed to generate AI response')
  }
}

// Generate AI suggested replies for agents
export async function generateSuggestedReplies(
  conversationContext: string,
  lastMessages: string,
  count: number = 3
): Promise<string[]> {
  const zai = await getZAI()

  const completion = await zai.chat.completions.create({
    messages: [
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
    ],
    thinking: { type: 'disabled' },
  })

  try {
    const content = completion.choices[0]?.message?.content || '[]'
    const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    return JSON.parse(cleaned)
  } catch {
    return ['Thank you for your message. Let me look into this for you.']
  }
}

// Detect language of input text
export async function detectLanguage(text: string): Promise<string> {
  const zai = await getZAI()

  const completion = await zai.chat.completions.create({
    messages: [
      {
        role: 'assistant',
        content: 'Detect the language of the following text. Respond with ONLY one word: "english", "thai", "lao", or "other". No other text.',
      },
      {
        role: 'user',
        content: text.substring(0, 200),
      },
    ],
    thinking: { type: 'disabled' },
  })

  return completion.choices[0]?.message?.content?.toLowerCase().trim() || 'english'
}

// Analyze customer sentiment
export async function analyzeSentiment(text: string): Promise<'positive' | 'neutral' | 'negative'> {
  const zai = await getZAI()

  const completion = await zai.chat.completions.create({
    messages: [
      {
        role: 'assistant',
        content: 'Analyze the sentiment of the following text. Respond with ONLY one word: "positive", "neutral", or "negative". No other text.',
      },
      {
        role: 'user',
        content: text.substring(0, 500),
      },
    ],
    thinking: { type: 'disabled' },
  })

  const result = completion.choices[0]?.message?.content?.toLowerCase().trim() || 'neutral'
  if (['positive', 'negative'].includes(result)) return result as 'positive' | 'negative'
  return 'neutral'
}

// Summarize a conversation
export async function summarizeConversation(messages: string): Promise<string> {
  const zai = await getZAI()

  const completion = await zai.chat.completions.create({
    messages: [
      {
        role: 'assistant',
        content: 'Summarize the following customer support conversation in 2-3 sentences. Focus on the main issue and resolution status.',
      },
      {
        role: 'user',
        content: messages,
      },
    ],
    thinking: { type: 'disabled' },
  })

  return completion.choices[0]?.message?.content || 'No summary available.'
}
