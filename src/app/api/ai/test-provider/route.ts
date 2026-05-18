import { NextResponse } from 'next/server'
import { testProviderConnection, type AIProviderConfig } from '@/lib/ai-providers'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { provider, apiKey, model, baseUrl, organization } = body as {
      provider: string
      apiKey?: string
      model?: string
      baseUrl?: string
      organization?: string
    }

    if (!provider) {
      return NextResponse.json(
        { error: 'Provider type is required' },
        { status: 400 }
      )
    }

    const config: AIProviderConfig = {
      provider: provider as AIProviderConfig['provider'],
      apiKey: apiKey || '',
      model: model || 'default',
      baseUrl: baseUrl || '',
      organization: organization || '',
    }

    const result = await testProviderConnection(config)

    return NextResponse.json(result)
  } catch (error) {
    console.error('[AI Test Provider] Error:', error)
    return NextResponse.json(
      { error: 'Failed to test provider connection' },
      { status: 500 }
    )
  }
}
