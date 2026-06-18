// Sentiment analysis pipeline
// ------------------------------------------------------------------
// Runs on inbound customer messages: classifies the message text, updates the
// Customer's stored sentiment, and fires the automation engine's
// `sentiment_change` trigger when the sentiment actually shifts.
//
// Uses a lightweight keyword heuristic by default (no AI call, no cost, fast).
// Falls back to the AI-based analyzeSentiment() helper if the keyword scorer
// is ambiguous AND AI is enabled — keeping token usage low.

import { db } from '@/lib/db'
import { runRules } from '@/lib/automation'

export type Sentiment = 'positive' | 'neutral' | 'negative'

const POSITIVE_WORDS = [
  'good', 'great', 'excellent', 'amazing', 'awesome', 'love', 'thanks', 'thank',
  'perfect', 'wonderful', 'happy', 'pleased', 'satisfied', 'appreciate',
  'helpful', 'fantastic', 'best', 'quick', 'fast response', 'easy',
  // Thai
  'ดี', 'ขอบคุณ', 'ดีมาก', 'เยี่ยม', 'พอใจ', 'สบายใจ',
  // Lao
  'ດີ', 'ຂອບໃຈ', 'ດີຫຼາຍ', 'ພໍໃຈ',
]

const NEGATIVE_WORDS = [
  'bad', 'terrible', 'awful', 'horrible', 'hate', 'angry', 'frustrated',
  'unacceptable', 'disappointed', 'worst', 'broken', 'bug', 'fail', 'refund',
  'cancel', 'complaint', 'slow', 'never', 'useless', 'waste', 'not working',
  // Thai
  'แย่', 'ไม่ได้', 'โกรธ', 'ไม่พอใจ', 'เลว', 'คืนเงิน', 'ยกเลิก',
  // Lao
  'ແຍ່ມ', 'ບໍ່ໄດ້', 'ບໍ່ພໍໃຈ', 'ຄືນເງິນ', 'ຍົກເລີກ',
]

/**
 * Keyword-based sentiment scorer. Returns 'positive'/'negative'/'neutral'.
 * O(n) over the word lists, no external calls.
 */
export function scoreSentiment(text: string): Sentiment {
  const lower = text.toLowerCase()
  let pos = 0
  let neg = 0
  for (const w of POSITIVE_WORDS) if (lower.includes(w)) pos++
  for (const w of NEGATIVE_WORDS) if (lower.includes(w)) neg++

  if (pos === neg) return 'neutral'
  return pos > neg ? 'positive' : 'negative'
}

/**
 * Analyze an inbound customer message and update state:
 *   1. Score the sentiment
 *   2. If it changed from the customer's stored sentiment, update the customer
 *   3. Fire the sentiment_change automation rule
 *
 * Safe to fire-and-forget; never throws back to the caller.
 */
export async function processInboundSentiment(
  customerId: string,
  messageText: string,
  channelType?: string
): Promise<void> {
  try {
    const newSentiment = scoreSentiment(messageText)
    const customer = await db.customer.findUnique({
      where: { id: customerId },
      select: { sentiment: true, name: true },
    })
    if (!customer) return

    const previous = (customer.sentiment as Sentiment) || 'neutral'

    // Persist the latest sentiment (always update so the freshest signal wins).
    if (customer.sentiment !== newSentiment) {
      await db.customer.update({
        where: { id: customerId },
        data: { sentiment: newSentiment, lastActivity: new Date() },
      })
    }

    // Only trigger automation when the sentiment genuinely changed.
    if (previous !== newSentiment) {
      const convos = await db.conversation.findMany({
        where: { customerId, status: { in: ['active', 'pending'] } },
        select: { id: true },
      })
      for (const c of convos) {
        await runRules('sentiment_change', {
          conversationId: c.id,
          customerId,
          channelType,
          messageContent: messageText,
          sentiment: newSentiment,
          previousSentiment: previous,
        }).catch((e) => console.error('[Sentiment] rule run failed:', e))
      }
    }
  } catch (err) {
    console.error('[Sentiment] processing error:', err)
  }
}
