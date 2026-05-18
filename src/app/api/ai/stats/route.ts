import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAISettings } from '@/lib/ai'

export async function GET() {
  try {
    // Get document and FAQ stats
    const [
      activeDocs,
      inactiveDocs,
      activeFaqs,
      inactiveFaqs,
      allDocs,
      allFaqs,
    ] = await Promise.all([
      db.document.count({ where: { isActive: true } }),
      db.document.count({ where: { isActive: false } }),
      db.faq.count({ where: { isActive: true } }),
      db.faq.count({ where: { isActive: false } }),
      db.document.findMany({ where: { isActive: true }, select: { content: true } }),
      db.faq.findMany({ where: { isActive: true }, select: { answer: true } }),
    ])

    // Calculate total knowledge characters
    const docChars = allDocs.reduce((sum, d) => sum + d.content.length, 0)
    const faqChars = allFaqs.reduce((sum, f) => sum + f.answer.length, 0)
    const totalChars = docChars + faqChars

    // Get AI settings
    const aiSettings = await getAISettings()

    return NextResponse.json({
      documents: {
        active: activeDocs,
        inactive: inactiveDocs,
        total: activeDocs + inactiveDocs,
      },
      faqs: {
        active: activeFaqs,
        inactive: inactiveFaqs,
        total: activeFaqs + inactiveFaqs,
      },
      totalKnowledgeChars: totalChars,
      model: 'z-ai-web-dev-sdk',
      settings: aiSettings,
    })
  } catch (error) {
    console.error('[AI Stats] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch AI stats' },
      { status: 500 }
    )
  }
}
