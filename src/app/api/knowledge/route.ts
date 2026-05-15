import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

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
    const body = await request.json()
    const { name, type, content, summary, uploadedById, isActive } = body

    if (!name || !content) {
      return NextResponse.json(
        { error: 'name and content are required' },
        { status: 400 }
      )
    }

    // For demo, just save text content as a document
    const document = await db.document.create({
      data: {
        name,
        type: type || 'txt',
        content,
        summary: summary || null,
        uploadedById: uploadedById || (await db.user.findFirst())?.id || 'unknown',
        isActive: isActive !== undefined ? isActive : true,
      },
      include: {
        uploadedBy: { select: { id: true, name: true, avatar: true } },
      },
    })

    return NextResponse.json({ document }, { status: 201 })
  } catch (error) {
    console.error('[Knowledge POST] Error:', error)
    return NextResponse.json({ error: 'Failed to create document' }, { status: 500 })
  }
}
