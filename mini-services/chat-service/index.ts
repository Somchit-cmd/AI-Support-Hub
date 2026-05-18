import { createServer } from 'http'
import { Server } from 'socket.io'

const httpServer = createServer()
const io = new Server(httpServer, {
  path: '/',
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  pingTimeout: 60000,
  pingInterval: 25000,
})

// Track online users
const onlineUsers = new Map<string, { userId: string; name: string; role: string }>()
// Track typing indicators per conversation
const typingUsers = new Map<string, Set<string>>()

io.on('connection', (socket) => {
  console.log(`[ChatService] User connected: ${socket.id}`)

  // ===== AUTHENTICATION =====
  socket.on('auth', (data: { userId: string; name: string; role: string }) => {
    onlineUsers.set(socket.id, data)
    socket.join(`user_${data.userId}`)
    socket.join('staff_room')
    
    // Broadcast user online status
    io.emit('user_status', { userId: data.userId, status: 'online' })
    console.log(`[ChatService] ${data.name} (${data.role}) authenticated`)
  })

  // ===== CONVERSATION ROOMS =====
  socket.on('join_conversation', (data: { conversationId: string }) => {
    socket.join(`conversation_${data.conversationId}`)
    console.log(`[ChatService] ${socket.id} joined conversation: ${data.conversationId}`)
  })

  socket.on('leave_conversation', (data: { conversationId: string }) => {
    socket.leave(`conversation_${data.conversationId}`)
    // Clear typing for this user in this conversation
    const typing = typingUsers.get(data.conversationId)
    if (typing) {
      typing.delete(socket.id)
      if (typing.size === 0) {
        typingUsers.delete(data.conversationId)
      }
    }
  })

  // ===== MESSAGES =====
  socket.on('send_message', (data: {
    conversationId: string
    message: {
      id: string
      senderType: string
      senderId: string
      content: string
      contentType: string
      createdAt: string
      isInternal: boolean
    }
  }) => {
    // Broadcast to everyone in the conversation room
    io.to(`conversation_${data.conversationId}`).emit('new_message', data)
    
    // Also notify staff who aren't in this conversation
    socket.to('staff_room').emit('message_notification', {
      conversationId: data.conversationId,
      message: data.message,
    })
    
    console.log(`[ChatService] Message in ${data.conversationId}: ${data.message.content.substring(0, 50)}...`)
  })

  // ===== TYPING INDICATOR =====
  socket.on('typing_start', (data: { conversationId: string; userId: string; name: string }) => {
    if (!typingUsers.has(data.conversationId)) {
      typingUsers.set(data.conversationId, new Set())
    }
    typingUsers.get(data.conversationId)!.add(socket.id)
    
    socket.to(`conversation_${data.conversationId}`).emit('typing', {
      conversationId: data.conversationId,
      userId: data.userId,
      name: data.name,
      isTyping: true,
    })
  })

  socket.on('typing_stop', (data: { conversationId: string; userId: string; name: string }) => {
    const typing = typingUsers.get(data.conversationId)
    if (typing) {
      typing.delete(socket.id)
    }
    
    socket.to(`conversation_${data.conversationId}`).emit('typing', {
      conversationId: data.conversationId,
      userId: data.userId,
      name: data.name,
      isTyping: false,
    })
  })

  // ===== READ STATUS =====
  socket.on('mark_read', (data: { conversationId: string; userId: string }) => {
    io.to(`conversation_${data.conversationId}`).emit('read_status', {
      conversationId: data.conversationId,
      userId: data.userId,
      readAt: new Date().toISOString(),
    })
  })

  // ===== CONVERSATION UPDATES =====
  socket.on('conversation_updated', (data: { conversationId: string; updates: Record<string, unknown> }) => {
    io.to('staff_room').emit('conversation_changed', data)
  })

  // ===== AI EVENTS =====
  socket.on('ai_response', (data: { conversationId: string; message: Record<string, unknown> }) => {
    io.to(`conversation_${data.conversationId}`).emit('new_message', data)
  })

  socket.on('ai_typing', (data: { conversationId: string; isTyping: boolean }) => {
    io.to(`conversation_${data.conversationId}`).emit('ai_typing_status', data)
  })

  // ===== PRESENCE =====
  socket.on('status_change', (data: { userId: string; status: string }) => {
    const user = onlineUsers.get(socket.id)
    if (user) {
      user.role = data.status // reuse or extend
      io.emit('user_status', { userId: data.userId, status: data.status })
    }
  })

  // ===== CUSTOMER CHAT (for website widget) =====
  socket.on('customer_join', (data: { conversationId: string; customerName: string }) => {
    socket.join(`conversation_${data.conversationId}`)
    socket.to(`conversation_${data.conversationId}`).emit('customer_joined', {
      conversationId: data.conversationId,
      customerName: data.customerName,
    })
  })

  socket.on('customer_message', (data: { conversationId: string; content: string; customerName: string }) => {
    io.to(`conversation_${data.conversationId}`).emit('customer_message', data)
    // Notify staff
    io.to('staff_room').emit('new_customer_message', data)
  })

  // ===== DISCONNECT =====
  socket.on('disconnect', () => {
    const user = onlineUsers.get(socket.id)
    if (user) {
      onlineUsers.delete(socket.id)
      io.emit('user_status', { userId: user.userId, status: 'offline' })
      console.log(`[ChatService] ${user.name} disconnected`)
    }
    
    // Clean up typing indicators
    for (const [convId, typing] of typingUsers.entries()) {
      if (typing.has(socket.id)) {
        typing.delete(socket.id)
        if (typing.size === 0) {
          typingUsers.delete(convId)
        }
      }
    }
  })

  socket.on('error', (error) => {
    console.error(`[ChatService] Socket error (${socket.id}):`, error)
  })
})

const PORT = 3003
httpServer.listen(PORT, () => {
  console.log(`[ChatService] Real-time chat service running on port ${PORT}`)
})

process.on('SIGTERM', () => {
  console.log('[ChatService] SIGTERM received, shutting down...')
  httpServer.close(() => process.exit(0))
})

process.on('SIGINT', () => {
  console.log('[ChatService] SIGINT received, shutting down...')
  httpServer.close(() => process.exit(0))
})
