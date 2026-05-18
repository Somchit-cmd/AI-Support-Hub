import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAISettings } from '@/lib/ai'
import { AI_PROVIDERS, getAIProviderConfig } from '@/lib/ai-providers'
import { getUsageStats, getBudgetStatus } from '@/lib/ai-usage'

export async function GET() {
  try {
    // Get document and FAQ stats
    const [
      activeDocs,
      inactiveDocs,
      activeFaqs,
      inactiveFaqs,
      allDocs,
      allFaqs,
    ] = await Promise.all([
      db.document.count({ where: { isActive: true } }),
      db.document.count({ where: { isActive: false } }),
      db.faq.count({ where: { isActive: true } }),
      db.faq.count({ where: { isActive: false } }),
      db.document.findMany({ where: { isActive: true }, select: { content: true } }),
      db.faq.findMany({ where: { isActive: true }, select: { answer: true } }),
    ])

    // Calculate total knowledge characters
    const docChars = allDocs.reduce((sum, d) => sum + d.content.length, 0)
    const faqChars = allFaqs.reduce((sum, f) => sum + f.answer.length, 0)
    const totalChars = docChars + faqChars

    // Get AI settings
    const aiSettings = await getAISettings()

    // Get provider config
    const providerConfig = await getAIProviderConfig()
    const providerInfo = AI_PROVIDERS[providerConfig.provider]

    // Get comprehensive usage stats
    const [todayStats, weekStats, monthStats, budgetStatus] = await Promise.all([
      getUsageStats('today'),
      getUsageStats('7d'),
      getUsageStats('30d'),
      getBudgetStatus(),
    ])

    // Get recent AI logs for activity display
    const recentLogs = await db.aiLog.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        model: true,
        provider: true,
        tokens: true,
        estimatedCost: true,
        responseTime: true,
        createdAt: true,
      },
    }).catch(() => [])

    return NextResponse.json({
      documents: {
        active: activeDocs,
        inactive: inactiveDocs,
        total: activeDocs + inactiveDocs,
      },
      faqs: {
        active: activeFaqs,
        inactive: inactiveFaqs,
        total: activeFaqs + inactiveFaqs,
      },
      totalKnowledgeChars: totalChars,
      model: providerConfig.model || providerInfo?.defaultModel || 'default',
      provider: providerConfig.provider,
      providerName: providerInfo?.name || providerConfig.provider,
      settings: aiSettings,
      // Usage tracking data
      usage: {
        today: todayStats,
        week: weekStats,
        month: monthStats,
      },
      budget: budgetStatus,
      recentLogs,
    })
  } catch (error) {
    console.error('[AI Stats] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch AI stats' },
      { status: 500 }
    )
  }
}
