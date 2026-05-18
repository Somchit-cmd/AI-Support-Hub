import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const existing = await db.document.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    await db.document.delete({ where: { id } })

    return NextResponse.json({ message: 'Document deleted successfully' })
  } catch (error) {
    console.error('[Document DELETE] Error:', error)
    return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 })
  }
}
