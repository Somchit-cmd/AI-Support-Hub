import { create } from 'zustand'

// ============================================
// APP NAVIGATION STATE
// ============================================

export type AppPage = 'inbox' | 'dashboard' | 'customers' | 'knowledge' | 'settings' | 'staff' | 'automation'

interface AppState {
  currentPage: AppPage
  setCurrentPage: (page: AppPage) => void
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  theme: 'light' | 'dark'
  setTheme: (theme: 'light' | 'dark') => void
}

export const useAppStore = create<AppState>((set) => ({
  currentPage: 'inbox',
  setCurrentPage: (page) => set({ currentPage: page }),
  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  theme: 'light',
  setTheme: (theme) => set({ theme }),
}))

// ============================================
// AUTH STATE
// ============================================

export interface AuthUser {
  id: string
  email: string
  name: string
  role: string
  avatar: string | null
  status: string
}

interface AuthState {
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<boolean>
  logout: () => Promise<void>
  checkAuth: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  login: async (email: string, password: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (!res.ok) return false
      const data = await res.json()
      set({ user: data.user, isAuthenticated: true })
      return true
    } catch {
      return false
    }
  },
  logout: async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } finally {
      set({ user: null, isAuthenticated: false })
    }
  },
  checkAuth: async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (!res.ok) {
        set({ user: null, isAuthenticated: false, isLoading: false })
        return
      }
      const data = await res.json()
      set({ user: data.user, isAuthenticated: true, isLoading: false })
    } catch {
      set({ user: null, isAuthenticated: false, isLoading: false })
    }
  },
}))

// ============================================
// CONVERSATIONS STATE
// ============================================

export interface Conversation {
  id: string
  customerId: string
  channelId: string
  assignedToId: string | null
  status: string
  aiMode: string
  priority: string
  subject: string | null
  unreadCount: number
  isPinned: boolean
  lastMessageAt: string
  lastMessage: string | null
  closedAt: string | null
  createdAt: string
  updatedAt: string
  customer?: Customer
  channel?: Channel
  assignedTo?: AuthUser
  messages?: Message[]
}

export interface Customer {
  id: string
  name: string
  email: string | null
  phone: string | null
  facebookId: string | null
  whatsappPhone: string | null
  avatar: string | null
  leadStatus: string
  sentiment: string
  notes: string
  lastActivity: string
  createdAt: string
  updatedAt: string
  tags?: CustomerTag[]
}

export interface CustomerTag {
  id: string
  name: string
  color: string
}

export interface Channel {
  id: string
  type: string
  name: string
  config: string
  isActive: boolean
}

export interface Message {
  id: string
  conversationId: string
  senderType: string
  senderId: string | null
  content: string
  contentType: string
  metadata: string
  isRead: boolean
  isInternal: boolean
  createdAt: string
  sender?: AuthUser
}

interface ConversationState {
  conversations: Conversation[]
  selectedConversationId: string | null
  isLoading: boolean
  filters: {
    channel: string | null
    status: string | null
    search: string
    aiMode: string | null
  }
  setConversations: (conversations: Conversation[]) => void
  selectConversation: (id: string | null) => void
  setFilters: (filters: Partial<ConversationState['filters']>) => void
  fetchConversations: () => Promise<void>
  addMessage: (conversationId: string, message: Message) => void
  updateConversation: (id: string, updates: Partial<Conversation>) => void
}

export const useConversationStore = create<ConversationState>((set, get) => ({
  conversations: [],
  selectedConversationId: null,
  isLoading: false,
  filters: {
    channel: null,
    status: null,
    search: '',
    aiMode: null,
  },
  setConversations: (conversations) => set({ conversations }),
  selectConversation: (id) => set({ selectedConversationId: id }),
  setFilters: (filters) => set((s) => ({ filters: { ...s.filters, ...filters } })),
  fetchConversations: async () => {
    set({ isLoading: true })
    try {
      const params = new URLSearchParams()
      const { filters } = get()
      if (filters.channel) params.set('channel', filters.channel)
      if (filters.status) params.set('status', filters.status)
      if (filters.search) params.set('search', filters.search)
      if (filters.aiMode) params.set('aiMode', filters.aiMode)
      const res = await fetch(`/api/conversations?${params}`)
      if (res.ok) {
        const data = await res.json()
        set({ conversations: data.conversations || [] })
      }
    } finally {
      set({ isLoading: false })
    }
  },
  addMessage: (conversationId, message) =>
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === conversationId
          ? { ...c, messages: [...(c.messages || []), message], lastMessage: message.content, lastMessageAt: message.createdAt }
          : c
      ),
    })),
  updateConversation: (id, updates) =>
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === id ? { ...c, ...updates } : c
      ),
    })),
}))

// ============================================
// NOTIFICATIONS STATE
// ============================================

interface NotificationItem {
  id: string
  userId: string
  type: string
  title: string
  message: string
  isRead: boolean
  link: string | null
  createdAt: string
}

interface NotificationState {
  notifications: NotificationItem[]
  unreadCount: number
  addNotification: (notification: NotificationItem) => void
  markRead: (id: string) => void
  markAllRead: () => void
  fetchNotifications: () => Promise<void>
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  unreadCount: 0,
  addNotification: (notification) =>
    set((s) => ({
      notifications: [notification, ...s.notifications],
      unreadCount: s.unreadCount + (notification.isRead ? 0 : 1),
    })),
  markRead: (id) =>
    set((s) => ({
      notifications: s.notifications.map((n) =>
        n.id === id ? { ...n, isRead: true } : n
      ),
      unreadCount: Math.max(0, s.unreadCount - 1),
    })),
  markAllRead: () =>
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, isRead: true })),
      unreadCount: 0,
    })),
  fetchNotifications: async () => {
    try {
      const res = await fetch('/api/notifications')
      if (res.ok) {
        const data = await res.json()
        set({
          notifications: data.notifications || [],
          unreadCount: (data.notifications || []).filter((n: NotificationItem) => !n.isRead).length,
        })
      }
    } catch {
      // silently fail
    }
  },
}))
