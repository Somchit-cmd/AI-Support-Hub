import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { parseBuffer, detectType } from '@/lib/document-parser'

export async function GET() {
  try {
    const [documents, faqs] = await Promise.all([
      db.document.findMany({
        include: {
          uploadedBy: { select: { id: true, name: true, avatar: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      db.faq.findMany({
        orderBy: { createdAt: 'desc' },
      }),
    ])

    return NextResponse.json({
      documents,
      faqs,
    })
  } catch (error) {
    console.error('[Knowledge GET] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch knowledge base' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') || ''
    const defaultUserId = (await db.user.findFirst())?.id || 'unknown'

    let name: string
    let type: string
    let content: string
    let summary: string | null

    if (contentType.includes('multipart/form-data')) {
      // ---- Real file upload: parse the file with document-parser ----
      const form = await request.formData()
      const file = form.get('file')
      const uploadedById = (form.get('uploadedById') as string) || defaultUserId

      if (!(file instanceof File)) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 })
      }

      const buffer = Buffer.from(await file.arrayBuffer())
      const declaredType = (form.get('type') as string) || undefined
      const detected = detectType(file.name, declaredType)

      if (detected === 'url' || detected === 'html') {
        // HTML upload is unusual; treat raw bytes as HTML.
        const text = buffer.toString('utf-8')
        content = text
        type = 'html'
      } else {
        const result = await parseBuffer(buffer, detected, file.name)
        content = result.text
        type = result.type
      }

      name = (form.get('name') as string) || file.name.replace(/\.[^.]+$/, '')
      summary = (form.get('summary') as string) || null

      return NextResponse.json(
        { document: await persistDocument({ name, type, content, summary, uploadedById }) },
        { status: 201 }
      )
    }

    // ---- Pasted text / JSON (backward-compatible) ----
    const body = await request.json()
    name = body.name
    type = body.type || 'txt'
    content = body.content
    summary = body.summary || null

    // If declared as a URL, fetch and parse it.
    if (type === 'url' && typeof content === 'string' && /^https?:\/\//i.test(content.trim())) {
      const { parseUrl } = await import('@/lib/document-parser')
      const result = await parseUrl(content.trim())
      content = result.text
      if (!name) name = result.title || content.trim()
    }

    if (!name || !content) {
      return NextResponse.json(
        { error: 'name and content are required' },
        { status: 400 }
      )
    }

    const document = await persistDocument({
      name,
      type,
      content,
      summary,
      uploadedById: body.uploadedById || defaultUserId,
      isActive: body.isActive,
    })

    return NextResponse.json({ document }, { status: 201 })
  } catch (error) {
    console.error('[Knowledge POST] Error:', error)
    const msg = error instanceof Error ? error.message : 'Failed to create document'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// Shared create helper.
async function persistDocument({
  name,
  type,
  content,
  summary,
  uploadedById,
  isActive,
}: {
  name: string
  type: string
  content: string
  summary: string | null
  uploadedById: string
  isActive?: boolean
}) {
  return db.document.create({
    data: {
      name,
      type,
      content,
      summary,
      uploadedById,
      isActive: isActive ?? true,
    },
    include: {
      uploadedBy: { select: { id: true, name: true, avatar: true } },
    },
  })
}
