// Document parser for the Knowledge Base
// ------------------------------------------------------------------
// Extracts plain text from uploaded files/URLs so they can feed the RAG
// pipeline. Previously the KB only accepted pasted text with a type label —
// now PDF, DOCX, TXT, and web URLs are parsed for real.
//
// Used by:
//   - /api/knowledge (file upload via multipart/form-data)
//   - /api/knowledge/import-url (fetch + extract URL content)
//
// Pure-JS implementations only (no native deps) for Windows portability.

import mammoth from 'mammoth'

export interface ParseResult {
  text: string
  type: string
  title?: string
  chars: number
}

const MAX_CHARS = 100_000 // cap extracted text to keep prompts/DB sane

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/** Detect a parser from a filename or declared type. */
export function detectType(filename: string, declared?: string): string {
  const ext = (filename.split('.').pop() || '').toLowerCase()
  if (declared && declared !== 'txt') return declared
  if (ext === 'pdf') return 'pdf'
  if (ext === 'docx') return 'docx'
  if (ext === 'doc') return 'doc'
  if (ext === 'txt' || ext === 'md') return 'txt'
  if (ext === 'html' || ext === 'htm') return 'html'
  return declared || 'txt'
}

/**
 * Parse a Buffer based on its type.
 * @param buffer  Raw file bytes
 * @param type    pdf | docx | txt | html
 * @param name    Filename (used for title)
 */
export async function parseBuffer(
  buffer: Buffer,
  type: string,
  name?: string
): Promise<ParseResult> {
  let text = ''
  const cleanType = (type || 'txt').toLowerCase()

  if (cleanType === 'pdf') {
    text = await parsePdf(buffer)
  } else if (cleanType === 'docx' || cleanType === 'doc') {
    const result = await mammoth.extractRawText({ buffer })
    text = result.value
  } else if (cleanType === 'html') {
    text = stripHtml(buffer.toString('utf-8'))
  } else {
    // txt / md / unknown → treat as UTF-8 text
    text = buffer.toString('utf-8')
  }

  text = cleanText(text)
  return {
    text,
    type: cleanType,
    title: name ? name.replace(/\.[^.]+$/, '') : undefined,
    chars: text.length,
  }
}

/**
 * Fetch a URL and extract its main text content.
 * Strips scripts/styles/nav boilerplate and collapses whitespace.
 */
export async function parseUrl(url: string): Promise<ParseResult> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'AI-Support-Hub-KnowledgeBot/1.0' },
    redirect: 'follow',
    signal: AbortSignal.timeout(20_000),
  })

  if (!res.ok) {
    throw new Error(`Failed to fetch URL (HTTP ${res.status})`)
  }

  const contentType = res.headers.get('content-type') || 'text/html'
  const raw = await res.text()
  let text: string
  let title: string | undefined

  if (contentType.includes('application/pdf')) {
    text = await parsePdf(Buffer.from(raw, 'binary'))
  } else {
    title = extractTitle(raw)
    text = stripHtml(raw)
  }

  text = cleanText(text)
  return { text, type: 'url', title, chars: text.length }
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal: per-format extractors
// ─────────────────────────────────────────────────────────────────────────────

async function parsePdf(buffer: Buffer): Promise<string> {
  // pdfjs runs in Node by importing the legacy build.
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')

  const data = new Uint8Array(buffer)
  // pdfjs v4 runs inline in Node by default (no DOM worker available).
  const doc = await pdfjs.getDocument({
    data,
    isEvalSupported: false,
  }).promise

  const pages: string[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    const strings = content.items
      .map((item) => ('str' in item ? (item as { str: string }).str : ''))
      .filter(Boolean)
    pages.push(strings.join(' '))
  }

  await doc.destroy()
  return pages.join('\n\n')
}

function extractTitle(html: string): string | undefined {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  return m ? m[1].trim() : undefined
}

function stripHtml(html: string): string {
  return html
    // Drop script/style/noscript blocks entirely.
    .replace(/<(script|style|noscript|svg|head)[\s\S]*?<\/\1>/gi, ' ')
    // Convert block elements to newlines for readability.
    .replace(/<\/(p|div|li|h[1-6]|tr|br)>/gi, '\n')
    // Strip remaining tags.
    .replace(/<[^>]+>/g, ' ')
    // Decode the common HTML entities.
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function cleanText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX_CHARS)
}
