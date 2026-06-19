// Automation Rule Engine
// ------------------------------------------------------------------
// Evaluates stored AutomationRules against conversation/message events and
// dispatches their actions. This is the "engine" that was missing — rules
// were previously stored but never executed.
//
// Supported triggers:
//   - new_conversation   Fires when a conversation is created
//   - keyword_match      Fires when an inbound message contains keywords
//   - sentiment_change   Fires when a customer's sentiment changes
//   - inactivity         Fires on a cron tick for conversations idle too long
//
// Supported actions:
//   - setPriority        { priority: 'normal' | 'high' | 'urgent' }
//   - assignTo           { agentId | agentRole: 'admin' | 'agent' | ... }
//   - addTag             { name, color }
//   - sendNote           { text }   (internal staff note)
//   - sendMessage        { text }   (auto-message as system)
//   - closeConversation  {}
//
// All evaluation is best-effort: a rule failure logs an error but never
// prevents the triggering message from being processed.

import { db } from '@/lib/db'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type TriggerType =
  | 'new_conversation'
  | 'keyword_match'
  | 'sentiment_change'
  | 'inactivity'

export interface RuleConditions {
  keywords?: string[]
  sentiment?: 'positive' | 'neutral' | 'negative'
  inactiveMinutes?: number
  channel?: string
}

export interface RuleActions {
  setPriority?: string
  assignToAgentId?: string
  assignToRole?: string
  addTag?: { name: string; color?: string }
  sendNote?: string
  sendMessage?: string
  closeConversation?: boolean
}

interface StoredRule {
  id: string
  name: string
  trigger: string
  conditions: string
  actions: string
  isActive: boolean
}

export interface EvalContext {
  conversationId: string
  customerId?: string
  channelType?: string
  messageContent?: string
  sentiment?: 'positive' | 'neutral' | 'negative'
  previousSentiment?: 'positive' | 'neutral' | 'negative'
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Evaluate all active rules for the given trigger against a context.
 * Call this from webhook/message-create flows.
 */
export async function runRules(
  trigger: TriggerType,
  ctx: EvalContext
): Promise<void> {
  try {
    const rules = await db.automationRule.findMany({
      where: { isActive: true, trigger },
    })

    for (const rule of rules) {
      try {
        await evaluateRule(rule, trigger, ctx)
      } catch (err) {
        console.error(`[Automation] Rule "${rule.name}" failed:`, err)
      }
    }
  } catch (err) {
    console.error('[Automation] runRules error:', err)
  }
}

/**
 * Sweep for inactive conversations. Intended to be called by a cron/scheduled
 * job. Returns the number of conversations that matched an inactivity rule.
 */
export async function runInactivitySweep(): Promise<number> {
  try {
    const rules = await db.automationRule.findMany({
      where: { isActive: true, trigger: 'inactivity' },
    })
    if (!rules.length) return 0

    let matched = 0
    for (const rule of rules) {
      const conds = parseJSON<RuleConditions>(rule.conditions)
      const minutes = conds.inactiveMinutes ?? 1440 // default 24h
      const cutoff = new Date(Date.now() - minutes * 60 * 1000)

      const stale = await db.conversation.findMany({
        where: {
          status: 'active',
          lastMessageAt: { lt: cutoff },
        },
        select: { id: true, customerId: true },
      })

      for (const convo of stale) {
        matched++
        await dispatchActions(rule, {
          conversationId: convo.id,
          customerId: convo.customerId,
        })
      }
    }
    return matched
  } catch (err) {
    console.error('[Automation] inactivity sweep error:', err)
    return 0
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Evaluation
// ─────────────────────────────────────────────────────────────────────────────

async function evaluateRule(
  rule: StoredRule,
  trigger: TriggerType,
  ctx: EvalContext
): Promise<void> {
  const conditions = parseJSON<RuleConditions>(rule.conditions)

  if (!conditionsMatch(conditions, trigger, ctx)) return

  console.log(`[Automation] ✦ Rule "${rule.name}" matched (trigger: ${trigger})`)
  await dispatchActions(rule, ctx)
}

function conditionsMatch(
  conds: RuleConditions,
  trigger: TriggerType,
  ctx: EvalContext
): boolean {
  // Channel scoping applies to all triggers.
  if (conds.channel && ctx.channelType && conds.channel !== ctx.channelType) {
    return false
  }

  if (trigger === 'keyword_match') {
    if (!conds.keywords?.length || !ctx.messageContent) return false
    const text = ctx.messageContent.toLowerCase()
    return conds.keywords.some((k) => text.includes(k.toLowerCase()))
  }

  if (trigger === 'sentiment_change') {
    if (!conds.sentiment) return false
    // Only fire when the new sentiment matches AND actually changed.
    if (ctx.sentiment !== conds.sentiment) return false
    if (ctx.previousSentiment === ctx.sentiment) return false
    return true
  }

  // new_conversation: any active rule with this trigger matches.
  // inactivity: handled by the sweep (no per-event conditions here).
  return true
}

// ─────────────────────────────────────────────────────────────────────────────
// Action dispatch
// ─────────────────────────────────────────────────────────────────────────────

async function dispatchActions(rule: StoredRule, ctx: EvalContext) {
  const actions = parseJSON<RuleActions>(rule.actions)
  const { conversationId } = ctx
  if (!conversationId) return

  const updates: Record<string, unknown> = {}

  // Priority
  if (actions.setPriority) {
    updates.priority = actions.setPriority
  }

  // Assignment
  if (actions.assignToAgentId) {
    updates.assignedToId = actions.assignToAgentId
  } else if (actions.assignToRole) {
    const agent = await db.user.findFirst({
      where: { role: actions.assignToRole, isActive: true },
    })
    if (agent) updates.assignedToId = agent.id
  }

  // Close
  if (actions.closeConversation) {
    updates.status = 'closed'
    updates.closedAt = new Date()
  }

  if (Object.keys(updates).length) {
    await db.conversation.update({ where: { id: conversationId }, data: updates })
  }

  // Internal note
  if (actions.sendNote) {
    await db.message.create({
      data: {
        conversationId,
        senderType: 'system',
        content: actions.sendNote,
        contentType: 'note',
        isInternal: true,
        metadata: JSON.stringify({ automationRule: rule.name }),
      },
    })
  }

  // Auto-message to the customer (system sender)
  if (actions.sendMessage) {
    await db.message.create({
      data: {
        conversationId,
        senderType: 'system',
        content: actions.sendMessage,
        contentType: 'text',
        isRead: false,
        metadata: JSON.stringify({ automationRule: rule.name }),
      },
    })
    await db.conversation.update({
      where: { id: conversationId },
      data: { lastMessage: actions.sendMessage.substring(0, 200), lastMessageAt: new Date() },
    })
  }

  // Tag the customer (idempotent: don't create duplicate tags)
  if (actions.addTag && ctx.customerId) {
    const existing = await db.customerTag.findFirst({
      where: { name: actions.addTag.name, customerId: ctx.customerId },
      select: { id: true },
    })
    if (!existing) {
      await db.customerTag.create({
        data: {
          name: actions.addTag.name,
          color: actions.addTag.color || '#6B7280',
          customerId: ctx.customerId,
        },
      })
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function parseJSON<T = unknown>(raw: string | null | undefined): T {
  if (!raw) return {} as T
  try {
    return JSON.parse(raw) as T
  } catch {
    return {} as T
  }
}

/**
 * Normalize an incoming conditions/actions field to a canonical JSON string.
 *
 * The UI sends raw user-typed text (e.g. `'{}'` or `'{"keywords":["x"]}'`),
 * while programmatic API callers may send objects. Without normalization,
 * calling `JSON.stringify` on an already-string value double-encodes it
 * (`'{}'` → `'"{ }"'`), which the engine then fails to parse. This helper
 * accepts either form (string | object | null) and always returns a clean
 * JSON string of the underlying object.
 */
export function toJsonString(value: unknown): string {
  if (value == null) return '{}'
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return '{}'
    // Already a JSON string — parse then re-stringify to canonicalize.
    try {
      const parsed = JSON.parse(trimmed)
      return JSON.stringify(parsed)
    } catch {
      // Not valid JSON (e.g. user typed plain text) — wrap as a string value
      // so at least it round-trips without corrupting.
      return JSON.stringify({ value: trimmed })
    }
  }
  // Object form.
  try {
    return JSON.stringify(value)
  } catch {
    return '{}'
  }
}
