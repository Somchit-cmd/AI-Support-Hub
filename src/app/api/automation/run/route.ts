import { NextResponse } from 'next/server'
import { runInactivitySweep } from '@/lib/automation'

// Manual/external trigger for the inactivity automation sweep.
//
// GET /api/automation/run?token=<CRON_SECRET>
//
// Designed to be called by an external cron job (GitHub Actions, Vercel Cron,
// cron-job.org, etc.) every hour or so. Returns the number of conversations
// that matched an inactivity rule.
//
// Security: requires a token matching the `automation_cron_token` setting
// (or env var AUTOMATION_CRON_TOKEN). If neither is set, the endpoint refuses
// to run — you must configure a token to enable scheduled automation.

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    const expected = process.env.AUTOMATION_CRON_TOKEN
    if (!expected) {
      return NextResponse.json(
        { error: 'Scheduled automation is disabled. Set AUTOMATION_CRON_TOKEN to enable.' },
        { status: 503 }
      )
    }

    if (token !== expected) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const matched = await runInactivitySweep()
    return NextResponse.json({ ok: true, matched, ranAt: new Date().toISOString() })
  } catch (error) {
    console.error('[Automation Run] Error:', error)
    return NextResponse.json({ error: 'Failed to run automation sweep' }, { status: 500 })
  }
}
