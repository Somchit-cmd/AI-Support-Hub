// AI Usage Tracking Utility
// Handles recording and querying AI token usage data with cost estimation
// This module should ONLY be used in backend (API routes)

import { db } from '@/lib/db'

// ============================================
// COST RATES PER PROVIDER / MODEL
// ============================================

interface ModelCostRate {
  inputPerMillion: number  // USD per 1M input tokens
  outputPerMillion: number // USD per 1M output tokens
}

type ProviderCostRates = Record<string, ModelCostRate>

const COST_RATES: Record<string, ProviderCostRates> = {
  'z-ai': {
    default: { inputPerMillion: 0, outputPerMillion: 0 },
  },
  openai: {
    'gpt-4o':          { inputPerMillion: 5,    outputPerMillion: 15 },
    'gpt-4o-mini':     { inputPerMillion: 0.15, outputPerMillion: 0.60 },
    'gpt-4-turbo':     { inputPerMillion: 10,   outputPerMillion: 30 },
    'gpt-4':           { inputPerMillion: 30,   outputPerMillion: 60 },
    'gpt-3.5-turbo':   { inputPerMillion: 0.50, outputPerMillion: 1.50 },
  },
  google: {
    'gemini-1.5-flash': { inputPerMillion: 0.075, outputPerMillion: 0.30 },
    'gemini-1.5-pro':   { inputPerMillion: 1.25,  outputPerMillion: 5 },
    'gemini-2.0-flash': { inputPerMillion: 0.10,  outputPerMillion: 0.40 },
  },
  anthropic: {
    'claude-3.5-sonnet': { inputPerMillion: 3,    outputPerMillion: 15 },
    'claude-3-haiku':    { inputPerMillion: 0.25,  outputPerMillion: 1.25 },
    'claude-3-opus':     { inputPerMillion: 15,    outputPerMillion: 75 },
  },
  custom: {
    default: { inputPerMillion: 0, outputPerMillion: 0 },
  },
}

/**
 * Calculate estimated cost for a given provider, model, and token counts.
 * Falls back to $0 for unknown providers/models (same as custom).
 */
export function calculateCost(
  provider: string,
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const providerRates = COST_RATES[provider]
  if (!providerRates) return 0

  const modelRate = providerRates[model] ?? providerRates.default
  if (!modelRate) return 0

  const inputCost = (promptTokens / 1_000_000) * modelRate.inputPerMillion
  const outputCost = (completionTokens / 1_000_000) * modelRate.outputPerMillion

  return Number((inputCost + outputCost).toFixed(6))
}

// ============================================
// RECORD USAGE
// ============================================

export interface RecordUsageParams {
  provider: string
  model: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
  responseTime: number // ms
}

/**
 * Records AI usage by upserting the daily AiUsage aggregate.
 * The caller is responsible for writing the AiLog entry separately.
 */
export async function recordUsage(params: RecordUsageParams): Promise<void> {
  const {
    provider,
    model,
    promptTokens,
    completionTokens,
    totalTokens,
    responseTime,
  } = params

  // Calculate date string as YYYY-MM-DD in the local timezone
  const now = new Date()
  const date = formatDate(now)

  // Calculate estimated cost for this single request
  const estimatedCost = calculateCost(provider, model, promptTokens, completionTokens)

  try {
    // Upsert the AiUsage record for today
    const existing = await db.aiUsage.findUnique({ where: { date } })

    if (existing) {
      // Increment counters on the existing record
      const newTotalRequests = existing.totalRequests + 1
      const newTotalTokens = existing.totalTokens + totalTokens
      const newPromptTokens = existing.promptTokens + promptTokens
      const newCompletionTokens = existing.completionTokens + completionTokens
      const newEstimatedCost = Number((existing.estimatedCost + estimatedCost).toFixed(6))
      // Running average: include the new response time
      const newAvgResponseTime = Math.round(
        (existing.avgResponseTime * existing.totalRequests + responseTime) / newTotalRequests,
      )

      await db.aiUsage.update({
        where: { date },
        data: {
          provider,
          model,
          totalRequests: newTotalRequests,
          totalTokens: newTotalTokens,
          promptTokens: newPromptTokens,
          completionTokens: newCompletionTokens,
          estimatedCost: newEstimatedCost,
          avgResponseTime: newAvgResponseTime,
        },
      })
    } else {
      // Create a new daily record
      await db.aiUsage.create({
        data: {
          date,
          provider,
          model,
          totalRequests: 1,
          totalTokens,
          promptTokens,
          completionTokens,
          estimatedCost,
          avgResponseTime: responseTime,
        },
      })
    }
  } catch (error) {
    console.error('[AI Usage] Error recording usage:', error)
    // Don't throw — usage tracking should not break the main flow
  }
}

// ============================================
// GET USAGE STATS
// ============================================

export type UsagePeriod = 'today' | '7d' | '30d' | 'month'

export interface ProviderBreakdown {
  provider: string
  totalRequests: number
  totalTokens: number
  promptTokens: number
  completionTokens: number
  estimatedCost: number
}

export interface ModelBreakdown {
  provider: string
  model: string
  totalRequests: number
  totalTokens: number
  promptTokens: number
  completionTokens: number
  estimatedCost: number
}

export interface DailyUsage {
  date: string
  totalRequests: number
  totalTokens: number
  promptTokens: number
  completionTokens: number
  estimatedCost: number
  avgResponseTime: number
}

export interface UsageStats {
  totalTokens: number
  promptTokens: number
  completionTokens: number
  totalRequests: number
  estimatedCost: number
  avgResponseTime: number
  byProvider: ProviderBreakdown[]
  byModel: ModelBreakdown[]
  daily: DailyUsage[]
}

/**
 * Returns comprehensive usage data for the specified period.
 * Period options: 'today', '7d', '30d', 'month'
 */
export async function getUsageStats(period: UsagePeriod = '30d'): Promise<UsageStats> {
  const { startDate, endDate } = getDateRange(period)

  try {
    // Fetch all usage records in the date range
    const records = await db.aiUsage.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { date: 'asc' },
    })

    // Aggregate totals
    const totals = records.reduce(
      (acc, r) => ({
        totalTokens: acc.totalTokens + r.totalTokens,
        promptTokens: acc.promptTokens + r.promptTokens,
        completionTokens: acc.completionTokens + r.completionTokens,
        totalRequests: acc.totalRequests + r.totalRequests,
        estimatedCost: acc.estimatedCost + r.estimatedCost,
        responseTimeSum: acc.responseTimeSum + r.avgResponseTime * r.totalRequests,
      }),
      {
        totalTokens: 0,
        promptTokens: 0,
        completionTokens: 0,
        totalRequests: 0,
        estimatedCost: 0,
        responseTimeSum: 0,
      },
    )

    // Calculate overall average response time
    const avgResponseTime =
      totals.totalRequests > 0
        ? Math.round(totals.responseTimeSum / totals.totalRequests)
        : 0

    // Breakdown by provider
    const providerMap = new Map<string, ProviderBreakdown>()
    for (const r of records) {
      const existing = providerMap.get(r.provider) || {
        provider: r.provider,
        totalRequests: 0,
        totalTokens: 0,
        promptTokens: 0,
        completionTokens: 0,
        estimatedCost: 0,
      }
      existing.totalRequests += r.totalRequests
      existing.totalTokens += r.totalTokens
      existing.promptTokens += r.promptTokens
      existing.completionTokens += r.completionTokens
      existing.estimatedCost += r.estimatedCost
      providerMap.set(r.provider, existing)
    }

    // Breakdown by provider+model
    const modelMap = new Map<string, ModelBreakdown>()
    for (const r of records) {
      const key = `${r.provider}::${r.model}`
      const existing = modelMap.get(key) || {
        provider: r.provider,
        model: r.model,
        totalRequests: 0,
        totalTokens: 0,
        promptTokens: 0,
        completionTokens: 0,
        estimatedCost: 0,
      }
      existing.totalRequests += r.totalRequests
      existing.totalTokens += r.totalTokens
      existing.promptTokens += r.promptTokens
      existing.completionTokens += r.completionTokens
      existing.estimatedCost += r.estimatedCost
      modelMap.set(key, existing)
    }

    // Daily usage data (for charts)
    // Fill in missing days with zero values for the last 30 days
    const dailyMap = new Map<string, DailyUsage>()
    for (const r of records) {
      dailyMap.set(r.date, {
        date: r.date,
        totalRequests: r.totalRequests,
        totalTokens: r.totalTokens,
        promptTokens: r.promptTokens,
        completionTokens: r.completionTokens,
        estimatedCost: r.estimatedCost,
        avgResponseTime: r.avgResponseTime,
      })
    }

    // Generate the full daily range for the last 30 days
    const daily: DailyUsage[] = []
    const today = new Date()
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const dateStr = formatDate(d)
      daily.push(
        dailyMap.get(dateStr) || {
          date: dateStr,
          totalRequests: 0,
          totalTokens: 0,
          promptTokens: 0,
          completionTokens: 0,
          estimatedCost: 0,
          avgResponseTime: 0,
        },
      )
    }

    return {
      totalTokens: totals.totalTokens,
      promptTokens: totals.promptTokens,
      completionTokens: totals.completionTokens,
      totalRequests: totals.totalRequests,
      estimatedCost: Number(totals.estimatedCost.toFixed(6)),
      avgResponseTime,
      byProvider: Array.from(providerMap.values()).sort(
        (a, b) => b.estimatedCost - a.estimatedCost,
      ),
      byModel: Array.from(modelMap.values()).sort(
        (a, b) => b.estimatedCost - a.estimatedCost,
      ),
      daily,
    }
  } catch (error) {
    console.error('[AI Usage] Error fetching usage stats:', error)
    return {
      totalTokens: 0,
      promptTokens: 0,
      completionTokens: 0,
      totalRequests: 0,
      estimatedCost: 0,
      avgResponseTime: 0,
      byProvider: [],
      byModel: [],
      daily: [],
    }
  }
}

// ============================================
// GET BUDGET STATUS
// ============================================

export type BudgetWarningLevel = 'green' | 'yellow' | 'red'

export interface BudgetStatus {
  monthlyBudget: number       // USD, 0 = unlimited
  monthlyUsage: number        // USD spent this month
  remainingBudget: number     // USD remaining (-1 if unlimited)
  percentageUsed: number      // 0-100
  warningLevel: BudgetWarningLevel
}

/**
 * Returns budget tracking information.
 * Monthly budget is read from the Setting key `ai_monthly_budget` (default 0 = unlimited).
 */
export async function getBudgetStatus(): Promise<BudgetStatus> {
  try {
    // Read the monthly budget setting
    const budgetSetting = await db.setting.findUnique({
      where: { key: 'ai_monthly_budget' },
    })

    const monthlyBudget = budgetSetting ? parseFloat(budgetSetting.value) || 0 : 0

    // Calculate current month's usage
    const now = new Date()
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    const today = formatDate(now)

    const monthRecords = await db.aiUsage.findMany({
      where: {
        date: {
          gte: monthStart,
          lte: today,
        },
      },
    })

    const monthlyUsage = monthRecords.reduce((sum, r) => sum + r.estimatedCost, 0)
    const usageRounded = Number(monthlyUsage.toFixed(6))

    // Determine remaining budget and percentage
    const isUnlimited = monthlyBudget === 0
    const remainingBudget = isUnlimited ? -1 : Number((monthlyBudget - usageRounded).toFixed(6))
    const percentageUsed =
      isUnlimited
        ? 0 // When unlimited, always show 0% used (no percentage is meaningful)
        : monthlyBudget > 0
          ? Math.min(Number(((usageRounded / monthlyBudget) * 100).toFixed(2)), 100)
          : 0

    // Determine warning level
    let warningLevel: BudgetWarningLevel = 'green'
    if (!isUnlimited) {
      if (percentageUsed >= 100) {
        warningLevel = 'red'
      } else if (percentageUsed >= 80) {
        warningLevel = 'red'
      } else if (percentageUsed >= 50) {
        warningLevel = 'yellow'
      }
    }

    return {
      monthlyBudget,
      monthlyUsage: usageRounded,
      remainingBudget,
      percentageUsed,
      warningLevel,
    }
  } catch (error) {
    console.error('[AI Usage] Error fetching budget status:', error)
    return {
      monthlyBudget: 0,
      monthlyUsage: 0,
      remainingBudget: -1,
      percentageUsed: 0,
      warningLevel: 'green',
    }
  }
}

// ============================================
// HELPERS
// ============================================

/**
 * Format a Date object as YYYY-MM-DD string.
 */
function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Get the start and end date strings for the given period.
 */
function getDateRange(period: UsagePeriod): { startDate: string; endDate: string } {
  const now = new Date()
  const endDate = formatDate(now)

  let startDate: string

  switch (period) {
    case 'today': {
      startDate = endDate
      break
    }
    case '7d': {
      const d = new Date(now)
      d.setDate(d.getDate() - 6) // Include today + 6 previous days = 7 days
      startDate = formatDate(d)
      break
    }
    case '30d': {
      const d = new Date(now)
      d.setDate(d.getDate() - 29) // Include today + 29 previous days = 30 days
      startDate = formatDate(d)
      break
    }
    case 'month': {
      // Current calendar month
      startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
      break
    }
    default: {
      const d = new Date(now)
      d.setDate(d.getDate() - 29)
      startDate = formatDate(d)
    }
  }

  return { startDate, endDate }
}

// ============================================
// RE-EXPORT COST RATES (for use in UI)
// ============================================

export { COST_RATES }
export type { ModelCostRate, ProviderCostRates }
