// AI Provider Abstraction Layer
// Supports: z-ai-web-dev-sdk (default), OpenAI, Google Gemini, and Custom OpenAI-compatible APIs
// This module should ONLY be used in backend (API routes)

import ZAI from 'z-ai-web-dev-sdk'
import OpenAI from 'openai'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { db } from '@/lib/db'

// ============================================
// TYPES
// ============================================

export type AIProviderType = 'z-ai' | 'openai' | 'google' | 'custom'

export interface AIProviderConfig {
  provider: AIProviderType
  apiKey: string
  model: string
  baseUrl?: string  // For custom/OpenAI-compatible endpoints
  organization?: string // OpenAI organization
}

export interface AIProviderResponse {
  content: string
  tokens: number
  model: string
  provider: AIProviderType
  responseTime: number
}

export interface AIProviderInfo {
  id: AIProviderType
  name: string
  description: string
  icon: string
  defaultModel: string
  availableModels: { id: string; name: string }[]
  requiresApiKey: boolean
  requiresBaseUrl: boolean
  apiKeyLabel: string
  apiKeyPlaceholder: string
  docsUrl: string
}

// ============================================
// PROVIDER REGISTRY
// ============================================

export const AI_PROVIDERS: Record<AIProviderType, AIProviderInfo> = {
  'z-ai': {
    id: 'z-ai',
    name: 'Z-AI (Default)',
    description: 'Built-in AI powered by z-ai-web-dev-sdk. No API key required.',
    icon: 'Sparkles',
    defaultModel: 'default',
    availableModels: [
      { id: 'default', name: 'Z-AI Default' },
    ],
    requiresApiKey: false,
    requiresBaseUrl: false,
    apiKeyLabel: '',
    apiKeyPlaceholder: '',
    docsUrl: '',
  },
  'openai': {
    id: 'openai',
    name: 'OpenAI (ChatGPT)',
    description: 'Use OpenAI GPT models. Requires an API key from platform.openai.com.',
    icon: 'Bot',
    defaultModel: 'gpt-4o',
    availableModels: [
      { id: 'gpt-4o', name: 'GPT-4o (Recommended)' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini (Faster, Cheaper)' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
      { id: 'gpt-4', name: 'GPT-4' },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo (Budget)' },
    ],
    requiresApiKey: true,
    requiresBaseUrl: false,
    apiKeyLabel: 'OpenAI API Key',
    apiKeyPlaceholder: 'sk-xxxxxxxxxxxxxxxxxxxxxxxx',
    docsUrl: 'https://platform.openai.com/api-keys',
  },
  'google': {
    id: 'google',
    name: 'Google Gemini',
    description: 'Use Google Gemini models. Requires an API key from Google AI Studio.',
    icon: 'Globe',
    defaultModel: 'gemini-1.5-flash',
    availableModels: [
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash (Fast)' },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro (Advanced)' },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
      { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite' },
    ],
    requiresApiKey: true,
    requiresBaseUrl: false,
    apiKeyLabel: 'Google AI API Key',
    apiKeyPlaceholder: 'AIzaSyxxxxxxxxxxxxxxxxxxxxxxx',
    docsUrl: 'https://aistudio.google.com/apikey',
  },
  'custom': {
    id: 'custom',
    name: 'Custom Provider',
    description: 'Connect to any OpenAI-compatible API (e.g., Ollama, LM Studio, Together AI, Groq, etc.)',
    icon: 'Settings',
    defaultModel: 'default',
    availableModels: [
      { id: 'default', name: 'Default Model' },
    ],
    requiresApiKey: true,
    requiresBaseUrl: true,
    apiKeyLabel: 'API Key',
    apiKeyPlaceholder: 'your-api-key',
    docsUrl: '',
  },
}

// ============================================
// PROVIDER CONFIG FROM DATABASE
// ============================================

let cachedConfig: AIProviderConfig | null = null
let configCacheTime = 0
const CONFIG_CACHE_TTL = 60_000 // 1 minute cache

export async function getAIProviderConfig(): Promise<AIProviderConfig> {
  const now = Date.now()
  if (cachedConfig && now - configCacheTime < CONFIG_CACHE_TTL) {
    return cachedConfig
  }

  try {
    const keys = [
      'ai_provider',
      'ai_provider_api_key',
      'ai_provider_model',
      'ai_provider_base_url',
      'ai_provider_organization',
    ]

    const settings = await db.setting.findMany({
      where: { key: { in: keys } },
    })

    const get = (key: string) => settings.find((s) => s.key === key)?.value || ''

    const provider = (get('ai_provider') || 'z-ai') as AIProviderType
    const config: AIProviderConfig = {
      provider,
      apiKey: get('ai_provider_api_key'),
      model: get('ai_provider_model') || AI_PROVIDERS[provider]?.defaultModel || 'default',
      baseUrl: get('ai_provider_base_url'),
      organization: get('ai_provider_organization'),
    }

    cachedConfig = config
    configCacheTime = now
    return config
  } catch (error) {
    console.error('[AI Providers] Error loading provider config:', error)
    return {
      provider: 'z-ai',
      apiKey: '',
      model: 'default',
    }
  }
}

export function clearProviderConfigCache() {
  cachedConfig = null
  configCacheTime = 0
}

// ============================================
// Z-AI PROVIDER
// ============================================

let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null

async function getZAI() {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create()
  }
  return zaiInstance
}

async function generateWithZAI(
  messages: { role: string; content: string }[]
): Promise<AIProviderResponse> {
  const startTime = Date.now()
  const zai = await getZAI()

  const formattedMessages = messages.map((m) => ({
    role: (m.role === 'assistant' ? 'assistant' : 'user') as 'user' | 'assistant',
    content: m.content,
  }))

  const completion = await zai.chat.completions.create({
    messages: formattedMessages,
    thinking: { type: 'disabled' },
  })

  return {
    content: completion.choices[0]?.message?.content || 'No response generated.',
    tokens: completion.usage?.total_tokens || 0,
    model: completion.model || 'z-ai-default',
    provider: 'z-ai',
    responseTime: Date.now() - startTime,
  }
}

// ============================================
// OPENAI PROVIDER
// ============================================

async function generateWithOpenAI(
  messages: { role: string; content: string }[],
  config: AIProviderConfig,
  temperature?: number,
  maxTokens?: number,
): Promise<AIProviderResponse> {
  const startTime = Date.now()

  const openai = new OpenAI({
    apiKey: config.apiKey,
    organization: config.organization || undefined,
  })

  const formattedMessages = messages.map((m) => ({
    role: m.role as 'system' | 'user' | 'assistant',
    content: m.content,
  }))

  const completion = await openai.chat.completions.create({
    model: config.model,
    messages: formattedMessages,
    temperature: temperature ?? 0.7,
    max_tokens: maxTokens ?? 2048,
  })

  return {
    content: completion.choices[0]?.message?.content || 'No response generated.',
    tokens: completion.usage?.total_tokens || 0,
    model: completion.model || config.model,
    provider: 'openai',
    responseTime: Date.now() - startTime,
  }
}

// ============================================
// GOOGLE GEMINI PROVIDER
// ============================================

async function generateWithGoogle(
  messages: { role: string; content: string }[],
  config: AIProviderConfig,
  temperature?: number,
  maxTokens?: number,
): Promise<AIProviderResponse> {
  const startTime = Date.now()

  const genAI = new GoogleGenerativeAI(config.apiKey)
  const model = genAI.getGenerativeModel({
    model: config.model,
    generationConfig: {
      temperature: temperature ?? 0.7,
      maxOutputTokens: maxTokens ?? 2048,
    },
  })

  // Convert messages to Gemini format
  // First message is system prompt, rest are conversation
  let systemInstruction = ''
  const history: { role: string; parts: { text: string }[] }[] = []
  let lastUserMessage = ''

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    if (i === 0 && msg.role === 'assistant') {
      // First "assistant" message is actually the system prompt in our format
      systemInstruction = msg.content
    } else if (msg.role === 'user') {
      lastUserMessage = msg.content
      // Add previous user-assistant pairs to history
      if (i > 0) {
        history.push({ role: 'user', parts: [{ text: msg.content }] })
      }
    } else if (msg.role === 'assistant') {
      history.push({ role: 'model', parts: [{ text: msg.content }] })
    }
  }

  // If there's history, use chat; otherwise use simple generate
  let result
  if (history.length > 0 && systemInstruction) {
    const chat = model.startChat({
      history: history.slice(0, -1), // Exclude the last user message from history
      systemInstruction,
    })
    result = await chat.sendMessage(lastUserMessage)
  } else if (systemInstruction) {
    // Simple generation with system instruction
    result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: lastUserMessage || messages[messages.length - 1]?.content || '' }] }],
      systemInstruction,
    })
  } else {
    // Fallback: just generate from the last message
    result = await model.generateContent(lastUserMessage || messages[messages.length - 1]?.content || '')
  }

  const response = result.response
  const text = response.text()

  return {
    content: text || 'No response generated.',
    tokens: (response.usageMetadata?.promptTokenCount || 0) + (response.usageMetadata?.candidatesTokenCount || 0),
    model: config.model,
    provider: 'google',
    responseTime: Date.now() - startTime,
  }
}

// ============================================
// CUSTOM PROVIDER (OpenAI-compatible)
// ============================================

async function generateWithCustom(
  messages: { role: string; content: string }[],
  config: AIProviderConfig,
  temperature?: number,
  maxTokens?: number,
): Promise<AIProviderResponse> {
  const startTime = Date.now()

  if (!config.baseUrl) {
    throw new Error('Custom provider requires a base URL')
  }

  const openai = new OpenAI({
    apiKey: config.apiKey || 'not-needed',
    baseURL: config.baseUrl,
  })

  const formattedMessages = messages.map((m) => ({
    role: m.role as 'system' | 'user' | 'assistant',
    content: m.content,
  }))

  const completion = await openai.chat.completions.create({
    model: config.model,
    messages: formattedMessages,
    temperature: temperature ?? 0.7,
    max_tokens: maxTokens ?? 2048,
  })

  return {
    content: completion.choices[0]?.message?.content || 'No response generated.',
    tokens: completion.usage?.total_tokens || 0,
    model: completion.model || config.model,
    provider: 'custom',
    responseTime: Date.now() - startTime,
  }
}

// ============================================
// UNIFIED GENERATION FUNCTION
// ============================================

export async function generateWithProvider(
  messages: { role: string; content: string }[],
  temperature?: number,
  maxTokens?: number,
): Promise<AIProviderResponse> {
  const config = await getAIProviderConfig()

  switch (config.provider) {
    case 'openai':
      if (!config.apiKey) throw new Error('OpenAI API key is required. Configure it in Settings > AI.')
      return generateWithOpenAI(messages, config, temperature, maxTokens)

    case 'google':
      if (!config.apiKey) throw new Error('Google AI API key is required. Configure it in Settings > AI.')
      return generateWithGoogle(messages, config, temperature, maxTokens)

    case 'custom':
      if (!config.baseUrl) throw new Error('Custom provider requires a base URL. Configure it in Settings > AI.')
      return generateWithCustom(messages, config, temperature, maxTokens)

    case 'z-ai':
    default:
      return generateWithZAI(messages)
  }
}

// ============================================
// PROVIDER CONNECTION TEST
// ============================================

export async function testProviderConnection(config: AIProviderConfig): Promise<{
  success: boolean
  message: string
  model?: string
  responseTime?: number
}> {
  const startTime = Date.now()

  try {
    const testMessages = [
      { role: 'assistant', content: 'You are a helpful assistant. Respond with exactly: "Connection successful!"' },
      { role: 'user', content: 'Hello, are you working?' },
    ]

    let result: AIProviderResponse

    switch (config.provider) {
      case 'openai': {
        if (!config.apiKey) {
          return { success: false, message: 'OpenAI API key is required.' }
        }
        const openai = new OpenAI({
          apiKey: config.apiKey,
          organization: config.organization || undefined,
        })
        const completion = await openai.chat.completions.create({
          model: config.model,
          messages: testMessages.map(m => ({ role: m.role as 'system' | 'user' | 'assistant', content: m.content })),
          max_tokens: 50,
        })
        result = {
          content: completion.choices[0]?.message?.content || '',
          tokens: completion.usage?.total_tokens || 0,
          model: completion.model || config.model,
          provider: 'openai',
          responseTime: Date.now() - startTime,
        }
        break
      }

      case 'google': {
        if (!config.apiKey) {
          return { success: false, message: 'Google AI API key is required.' }
        }
        const genAI = new GoogleGenerativeAI(config.apiKey)
        const model = genAI.getGenerativeModel({ model: config.model })
        const response = await model.generateContent('Respond with exactly: "Connection successful!"')
        result = {
          content: response.response.text(),
          tokens: (response.response.usageMetadata?.promptTokenCount || 0) + (response.response.usageMetadata?.candidatesTokenCount || 0),
          model: config.model,
          provider: 'google',
          responseTime: Date.now() - startTime,
        }
        break
      }

      case 'custom': {
        if (!config.baseUrl) {
          return { success: false, message: 'Custom provider requires a base URL.' }
        }
        const openai = new OpenAI({
          apiKey: config.apiKey || 'not-needed',
          baseURL: config.baseUrl,
        })
        const completion = await openai.chat.completions.create({
          model: config.model,
          messages: testMessages.map(m => ({ role: m.role as 'system' | 'user' | 'assistant', content: m.content })),
          max_tokens: 50,
        })
        result = {
          content: completion.choices[0]?.message?.content || '',
          tokens: completion.usage?.total_tokens || 0,
          model: completion.model || config.model,
          provider: 'custom',
          responseTime: Date.now() - startTime,
        }
        break
      }

      case 'z-ai':
      default: {
        result = await generateWithZAI(testMessages)
        break
      }
    }

    return {
      success: true,
      message: `Connected to ${AI_PROVIDERS[config.provider]?.name || config.provider} successfully!`,
      model: result.model,
      responseTime: result.responseTime,
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error occurred'
    console.error(`[AI Providers] Test connection failed for ${config.provider}:`, errMsg)

    // Provide user-friendly error messages
    if (errMsg.includes('401') || errMsg.includes('Incorrect API key')) {
      return { success: false, message: 'Invalid API key. Please check your API key and try again.' }
    }
    if (errMsg.includes('404') || errMsg.includes('model')) {
      return { success: false, message: `Model "${config.model}" not found. Please check the model name.` }
    }
    if (errMsg.includes('429') || errMsg.includes('rate limit')) {
      return { success: false, message: 'Rate limit exceeded. Please wait and try again.' }
    }
    if (errMsg.includes('ECONNREFUSED') || errMsg.includes('fetch')) {
      return { success: false, message: 'Could not connect to the API. Please check the base URL and your network.' }
    }

    return { success: false, message: `Connection failed: ${errMsg}` }
  }
}
