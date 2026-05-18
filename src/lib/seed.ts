// Seed script to populate initial data
import { db } from './db'

async function seed() {
  console.log('[Seed] Starting database seeding...')

  // Create default channels
  const existingChannels = await db.channel.count()
  if (existingChannels === 0) {
    await db.channel.createMany({
      data: [
        { type: 'website', name: 'Website Live Chat', config: JSON.stringify({ welcomeMessage: 'Hello! How can we help you today?', primaryColor: '#0F172A' }), isActive: true },
        { type: 'facebook', name: 'Facebook Messenger', config: JSON.stringify({ pageId: '', pageName: '' }), isActive: false },
        { type: 'whatsapp', name: 'WhatsApp Business', config: JSON.stringify({ phoneNumber: '', businessName: '' }), isActive: false },
      ],
    })
    console.log('[Seed] Created default channels')
  }

  // Create default admin user if none exists
  const existingUsers = await db.user.count()
  if (existingUsers === 0) {
    // Password will be hashed via API - storing plain for initial seed
    await db.user.create({
      data: {
        email: 'admin@company.com',
        name: 'Admin User',
        password: '$2a$10$placeholder.will.be.hashed.via.api', // Will be set via login
        role: 'super_admin',
        status: 'online',
        isActive: true,
      },
    })
    console.log('[Seed] Created default admin user')
  }

  // Create default settings
  const existingSettings = await db.setting.count()
  if (existingSettings === 0) {
    await db.setting.createMany({
      data: [
        { key: 'company_name', value: 'AI Support Hub', category: 'general' },
        { key: 'company_logo', value: '', category: 'branding' },
        { key: 'ai_mode', value: 'suggest', category: 'ai' },
        { key: 'ai_personality', value: 'professional', category: 'ai' },
        { key: 'ai_system_prompt', value: '', category: 'ai' },
        { key: 'widget_primary_color', value: '#0F172A', category: 'widget' },
        { key: 'widget_welcome_message', value: 'Hello! How can we help you today?', category: 'widget' },
        { key: 'widget_position', value: 'bottom-right', category: 'widget' },
        { key: 'business_hours_enabled', value: 'false', category: 'general' },
        { key: 'business_hours_start', value: '09:00', category: 'general' },
        { key: 'business_hours_end', value: '18:00', category: 'general' },
        { key: 'auto_close_inactive_hours', value: '24', category: 'general' },
        { key: 'supported_languages', value: 'en,th,lo', category: 'general' },
      ],
    })
    console.log('[Seed] Created default settings')
  }

  // Create sample FAQs
  const existingFaqs = await db.faq.count()
  if (existingFaqs === 0) {
    await db.faq.createMany({
      data: [
        { question: 'What are your business hours?', answer: 'We are available Monday to Friday, 9:00 AM to 6:00 PM (ICT). Our AI assistant is available 24/7.', category: 'general' },
        { question: 'How can I contact support?', answer: 'You can reach us through this live chat, Facebook Messenger, or WhatsApp. Our team typically responds within 5 minutes during business hours.', category: 'general' },
        { question: 'What payment methods do you accept?', answer: 'We accept credit/debit cards (Visa, MasterCard), bank transfers, and PromptPay. All transactions are secured with SSL encryption.', category: 'billing' },
        { question: 'How do I reset my password?', answer: 'You can reset your password by clicking the "Forgot Password" link on the login page. A reset link will be sent to your registered email address.', category: 'technical' },
        { question: 'What is your refund policy?', answer: 'We offer a 30-day money-back guarantee for all our products. Refunds are processed within 5-7 business days.', category: 'billing' },
      ],
    })
    console.log('[Seed] Created sample FAQs')
  }

  // Create sample customers and conversations for demo
  const existingCustomers = await db.customer.count()
  if (existingCustomers === 0) {
    const channels = await db.channel.findMany()
    const websiteChannel = channels.find(c => c.type === 'website')
    const facebookChannel = channels.find(c => c.type === 'facebook')
    const whatsappChannel = channels.find(c => c.type === 'whatsapp')

    if (websiteChannel) {
      const customer1 = await db.customer.create({
        data: {
          name: 'Somchai Prasert',
          email: 'somchai@email.com',
          phone: '+66 81 234 5678',
          whatsappPhone: '+66 81 234 5678',
          leadStatus: 'qualified',
          sentiment: 'positive',
          lastActivity: new Date(),
        },
      })

      const customer2 = await db.customer.create({
        data: {
          name: 'Sarah Johnson',
          email: 'sarah.j@email.com',
          facebookId: 'fb_123456789',
          leadStatus: 'new',
          sentiment: 'neutral',
          lastActivity: new Date(Date.now() - 3600000),
        },
      })

      const customer3 = await db.customer.create({
        data: {
          name: 'ທ້າວ ສົມພອນ ວົງສະຫວັດ',
          phone: '+856 20 5555 1234',
          whatsappPhone: '+856 20 5555 1234',
          leadStatus: 'contacted',
          sentiment: 'neutral',
          lastActivity: new Date(Date.now() - 7200000),
        },
      })

      const customer4 = await db.customer.create({
        data: {
          name: 'Maria Garcia',
          email: 'maria.g@email.com',
          phone: '+1 555 123 4567',
          leadStatus: 'negotiation',
          sentiment: 'negative',
          lastActivity: new Date(Date.now() - 86400000),
        },
      })

      const customer5 = await db.customer.create({
        data: {
          name: 'คุณณัฐพล สุขสวัสดิ์',
          email: 'nattapol@email.com',
          facebookId: 'fb_987654321',
          whatsappPhone: '+66 89 876 5432',
          leadStatus: 'proposal',
          sentiment: 'positive',
          lastActivity: new Date(),
        },
      })

      // Create sample conversations
      const conv1 = await db.conversation.create({
        data: {
          customerId: customer1.id,
          channelId: websiteChannel.id,
          status: 'active',
          aiMode: 'suggest',
          priority: 'high',
          unreadCount: 2,
          lastMessage: 'I need help with my subscription upgrade',
          lastMessageAt: new Date(),
        },
      })

      const conv2 = await db.conversation.create({
        data: {
          customerId: customer2.id,
          channelId: facebookChannel?.id || websiteChannel.id,
          status: 'active',
          aiMode: 'auto',
          priority: 'normal',
          unreadCount: 0,
          lastMessage: 'Thanks for the quick response!',
          lastMessageAt: new Date(Date.now() - 3600000),
        },
      })

      const conv3 = await db.conversation.create({
        data: {
          customerId: customer3.id,
          channelId: whatsappChannel?.id || websiteChannel.id,
          status: 'pending',
          aiMode: 'suggest',
          priority: 'normal',
          unreadCount: 1,
          lastMessage: 'ຂ້ອຍຢາກສອບຖາມກ່ຽວກັບການສັ່ງຊື້',
          lastMessageAt: new Date(Date.now() - 7200000),
        },
      })

      const conv4 = await db.conversation.create({
        data: {
          customerId: customer4.id,
          channelId: websiteChannel.id,
          status: 'active',
          aiMode: 'human',
          priority: 'urgent',
          unreadCount: 3,
          lastMessage: 'This is unacceptable! I want a full refund NOW!',
          lastMessageAt: new Date(Date.now() - 1800000),
        },
      })

      const conv5 = await db.conversation.create({
        data: {
          customerId: customer5.id,
          channelId: facebookChannel?.id || websiteChannel.id,
          status: 'active',
          aiMode: 'auto',
          priority: 'normal',
          unreadCount: 0,
          isPinned: true,
          lastMessage: 'สนใจอยากทราบรายละเอียดแพ็กเกจ Enterprise ครับ',
          lastMessageAt: new Date(),
        },
      })

      // Create sample messages for each conversation
      const now = Date.now()
      await db.message.createMany({
        data: [
          // Conv1 - Somchai
          { conversationId: conv1.id, senderType: 'customer', content: 'Hello, I need help with upgrading my subscription', contentType: 'text', isRead: true, createdAt: new Date(now - 600000) },
          { conversationId: conv1.id, senderType: 'ai', content: 'Hello Somchai! I\'d be happy to help you with upgrading your subscription. Could you please tell me which plan you\'re currently on and which plan you\'d like to upgrade to?', contentType: 'text', isRead: true, createdAt: new Date(now - 590000) },
          { conversationId: conv1.id, senderType: 'customer', content: 'I\'m on the Basic plan and want to upgrade to Pro', contentType: 'text', isRead: true, createdAt: new Date(now - 500000) },
          { conversationId: conv1.id, senderType: 'ai', content: 'Great choice! The Pro plan includes unlimited conversations, advanced AI features, priority support, and custom integrations. The upgrade would be processed immediately, and you\'ll only pay the prorated difference. Would you like me to proceed with the upgrade?', contentType: 'text', isRead: true, createdAt: new Date(now - 490000) },
          { conversationId: conv1.id, senderType: 'customer', content: 'I need help with my subscription upgrade', contentType: 'text', isRead: false, createdAt: new Date(now - 60000) },

          // Conv2 - Sarah
          { conversationId: conv2.id, senderType: 'customer', content: 'Hi, do you have a mobile app?', contentType: 'text', isRead: true, createdAt: new Date(now - 5400000) },
          { conversationId: conv2.id, senderType: 'ai', content: 'Hi Sarah! Yes, we have mobile apps available for both iOS and Android. You can download them from the App Store or Google Play Store. Would you like me to send you the download links?', contentType: 'text', isRead: true, createdAt: new Date(now - 5390000) },
          { conversationId: conv2.id, senderType: 'customer', content: 'Thanks for the quick response!', contentType: 'text', isRead: true, createdAt: new Date(now - 3600000) },

          // Conv3 - Lao customer
          { conversationId: conv3.id, senderType: 'customer', content: 'ສະບາຍດີ, ຂ້ອຍຢາກສອບຖາມກ່ຽວກັບຜະລິດຕະພັນຂອງທ່ານ', contentType: 'text', isRead: true, createdAt: new Date(now - 10800000) },
          { conversationId: conv3.id, senderType: 'ai', content: 'ສະບາຍດີ! ຍິນດີຕ້ອນຮັບ. ຂ້ອຍພ້ອມຊ່ວຍເຫຼືອທ່ານ. ທ່ານຢາກຮູ້ຂໍ້ມູນກ່ຽວກັບຜະລິດຕະພັນຫຍັງ?', contentType: 'text', isRead: true, createdAt: new Date(now - 10790000) },
          { conversationId: conv3.id, senderType: 'customer', content: 'ຂ້ອຍຢາກສອບຖາມກ່ຽວກັບການສັ່ງຊື້', contentType: 'text', isRead: false, createdAt: new Date(now - 7200000) },

          // Conv4 - Maria (urgent)
          { conversationId: conv4.id, senderType: 'customer', content: 'I ordered 2 weeks ago and still haven\'t received anything!', contentType: 'text', isRead: true, createdAt: new Date(now - 7200000) },
          { conversationId: conv4.id, senderType: 'ai', content: 'I\'m sorry to hear about the delay with your order, Maria. Let me look into this right away. Could you please provide your order number so I can track it for you?', contentType: 'text', isRead: true, createdAt: new Date(now - 7190000) },
          { conversationId: conv4.id, senderType: 'customer', content: 'Order #ORD-2024-8899. I\'ve been waiting too long already.', contentType: 'text', isRead: true, createdAt: new Date(now - 5400000) },
          { conversationId: conv4.id, senderType: 'customer', content: 'This is unacceptable! I want a full refund NOW!', contentType: 'text', isRead: false, createdAt: new Date(now - 1800000) },

          // Conv5 - Thai customer (pinned)
          { conversationId: conv5.id, senderType: 'customer', content: 'สวัสดีครับ สนใจแพ็กเกจ Enterprise ครับ', contentType: 'text', isRead: true, createdAt: new Date(now - 86400000) },
          { conversationId: conv5.id, senderType: 'ai', content: 'สวัสดีครับคุณณัฐพล! ยินดีต้อนรับครับ แพ็กเกจ Enterprise เหมาะสำหรับองค์กรที่ต้องการฟีเจอร์ครบครัน มี SLA 99.9% และทีมสนับสนุนเฉพาะ ท่านต้องการข้อมูลเพิ่มเติมด้านไหนครับ?', contentType: 'text', isRead: true, createdAt: new Date(now - 86390000) },
          { conversationId: conv5.id, senderType: 'customer', content: 'สนใจอยากทราบรายละเอียดแพ็กเกจ Enterprise ครับ', contentType: 'text', isRead: true, createdAt: new Date(now - 3600000) },
        ],
      })

      console.log('[Seed] Created sample customers and conversations')
    }
  }

  console.log('[Seed] Seeding complete!')
}

seed()
  .catch(console.error)
  .finally(() => process.exit())
