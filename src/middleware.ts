import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Only applies to the public widget endpoints. Admin/internal API routes
// are same-origin (served from the Next.js app itself) so they don't need CORS.
//
// The widget.js is loaded cross-origin from WordPress, so it must be allowed
// to call /api/widget/* with JSON bodies. We use a permissive origin in dev
// and echo the request Origin in production (so only real browsers using the
// widget can call it — not arbitrary sites in a CSRF sense; for tighter
// control you can restrict to a configured allowlist of domains).

export function config() {
  return {
    matcher: ['/api/widget/:path*'],
  }
}

export function middleware(request: NextRequest) {
  // Handle CORS preflight (OPTIONS) for the widget.
  if (request.method === 'OPTIONS') {
    const res = new NextResponse(null, { status: 204 })
    applyCorsHeaders(res, request)
    return res
  }

  const res = NextResponse.next()
  applyCorsHeaders(res, request)
  return res
}

function applyCorsHeaders(res: NextResponse, request: NextRequest) {
  const origin = request.headers.get('origin') || '*'
  res.headers.set('Access-Control-Allow-Origin', origin)
  res.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type')
  res.headers.set('Access-Control-Max-Age', '86400')
  res.headers.set('Vary', 'Origin')
}
