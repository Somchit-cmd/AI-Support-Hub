import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const leadStatus = searchParams.get('leadStatus')
    const sentiment = searchParams.get('sentiment')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const where: Prisma.CustomerWhereInput = {}

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
      ]
    }

    if (leadStatus) {
      where.leadStatus = leadStatus
    }

    if (sentiment) {
      where.sentiment = sentiment
    }

    const [customers, total] = await Promise.all([
      db.customer.findMany({
        where,
        include: {
          tags: true,
          _count: { select: { conversations: true } },
        },
        orderBy: { lastActivity: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.customer.count({ where }),
    ])

    const customersWithCount = customers.map((customer) => ({
      ...customer,
      conversationCount: customer._count.conversations,
      _count: undefined,
    }))

    return NextResponse.json({
      customers: customersWithCount,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('[Customers GET] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, email, phone, facebookId, whatsappPhone, avatar, leadStatus, sentiment, notes, tags } = body

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const customer = await db.customer.create({
      data: {
        name,
        email: email || null,
        phone: phone || null,
        facebookId: facebookId || null,
        whatsappPhone: whatsappPhone || null,
        avatar: avatar || null,
        leadStatus: leadStatus || 'new',
        sentiment: sentiment || 'neutral',
        notes: notes || '',
        tags: tags
          ? {
              create: tags.map((tag: { name: string; color?: string }) => ({
                name: tag.name,
                color: tag.color || '#6B7280',
              })),
            }
          : undefined,
      },
      include: { tags: true },
    })

    return NextResponse.json({ customer }, { status: 201 })
  } catch (error) {
    console.error('[Customers POST] Error:', error)
    return NextResponse.json({ error: 'Failed to create customer' }, { status: 500 })
  }
}
