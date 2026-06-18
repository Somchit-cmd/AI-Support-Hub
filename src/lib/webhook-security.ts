// Webhook signature verification for Meta (Facebook Messenger & WhatsApp).
// Both use HMAC-SHA256 with the App Secret as the key.
//   - Facebook: signs the raw body, header `x-hub-signature-256` → "sha256=<hex>"
//   - WhatsApp: signs the raw body, header `x-hub-signature-256` → "sha256=<hex>"
//
// If no app secret is configured, verification is skipped (with a warning) so
// the app remains usable for local development. In production you MUST set the
// app secret via the connect wizard.

import crypto from 'crypto'
import { db } from '@/lib/db'

/**
 * Load the configured Meta App Secret.
 * Stored as the `meta_app_secret` setting when you connect a channel.
 */
export async function getAppSecret(): Promise<string | null> {
  const s = await db.setting.findUnique({ where: { key: 'meta_app_secret' } })
  return s?.value || null
}

/**
 * Verify a Meta webhook signature against the raw request body.
 *
 * @param body       The raw request body (string or Buffer)
 * @param signature  The value of the `x-hub-signature-256` header
 * @param appSecret  The App Secret from the Meta Developer Portal
 * @returns true if the signature is valid, false otherwise
 */
export function verifyMetaSignature(
  body: string | Buffer,
  signature: string | null,
  appSecret: string
): boolean {
  if (!signature || !signature.startsWith('sha256=')) {
    return false
  }

  const expected = signature.replace('sha256=', '')
  const hmac = crypto.createHmac('sha256', appSecret).update(body).digest('hex')

  // Timing-safe comparison to prevent timing attacks.
  try {
    const a = Buffer.from(expected)
    const b = Buffer.from(hmac)
    if (a.length !== b.length) return false
    return crypto.timingSafeEqual(a, b)
  } catch {
    return false
  }
}

/**
 * High-level helper: verifies the incoming webhook POST if an app secret
 * is configured. Returns whether the request should be processed.
 *
 * - If NO app secret is set → returns `true` (permissive, dev mode) and logs
 *   a warning. Set the app secret for production.
 * - If an app secret IS set → returns `true` only if the signature matches.
 */
export async function isWebhookAuthorized(
  body: string | Buffer,
  signature: string | null
): Promise<{ authorized: boolean; reason: string }> {
  const appSecret = await getAppSecret()

  if (!appSecret) {
    console.warn(
      '[Webhook Security] ⚠️ No app secret configured — skipping signature verification. ' +
        'Set the app secret in the channel connect wizard for production use.'
    )
    return { authorized: true, reason: 'no-app-secret (dev mode)' }
  }

  const valid = verifyMetaSignature(body, signature, appSecret)
  return {
    authorized: valid,
    reason: valid ? 'signature-valid' : 'signature-invalid',
  }
}
