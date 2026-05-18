import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const faqs = await db.faq.findMany({
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ faqs })
  } catch (error) {
    console.error('[FAQs GET] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch FAQs' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { question, answer, category, isActive } = body

    if (!question || !answer) {
      return NextResponse.json(
        { error: 'question and answer are required' },
        { status: 400 }
      )
    }

    const faq = await db.faq.create({
      data: {
        question,
        answer,
        category: category || 'general',
        isActive: isActive !== undefined ? isActive : true,
      },
    })

    return NextResponse.json({ faq }, { status: 201 })
  } catch (error) {
    console.error('[FAQs POST] Error:', error)
    return NextResponse.json({ error: 'Failed to create FAQ' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { id, question, answer, category, isActive } = body

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const existing = await db.faq.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'FAQ not found' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    if (question !== undefined) updateData.question = question
    if (answer !== undefined) updateData.answer = answer
    if (category !== undefined) updateData.category = category
    if (isActive !== undefined) updateData.isActive = isActive

    const faq = await db.faq.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ faq })
  } catch (error) {
    console.error('[FAQs PUT] Error:', error)
    return NextResponse.json({ error: 'Failed to update FAQ' }, { status: 500 })
  }
}
