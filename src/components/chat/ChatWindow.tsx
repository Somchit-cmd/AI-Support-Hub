'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { formatDistanceToNow } from 'date-fns'
import {
  Globe,
  MessageCircle,
  Phone,
  Sparkles,
  Pin,
  PinOff,
  Archive,
  XCircle,
  MoreHorizontal,
  UserPlus,
  PanelRightOpen,
  PanelRightClose,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useConversationStore, useAuthStore, type Message } from '@/lib/store'
import { useSocket } from '@/hooks/use-socket'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import MessageBubble from './MessageBubble'
import ChatInput from './ChatInput'

const channelIcons: Record<string, React.ElementType> = {
  website: Globe,
  facebook: MessageCircle,
  whatsapp: Phone,
}

const channelBadgeVariant: Record<string, string> = {
  website: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  facebook: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400',
  whatsapp: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
}

interface ChatWindowProps {
  showDetails: boolean
  onToggleDetails: () => void
}

export default function ChatWindow({ showDetails, onToggleDetails }: ChatWindowProps) {
  const {
    conversations,
    selectedConversationId,
    selectConversation,
    addMessage,
    updateConversation,
  } = useConversationStore()
  const user = useAuthStore((s) => s.user)
  const { emit, on, off } = useSocket()

  const [messages, setMessages] = useState<Message[]>([])
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [typingName, setTypingName] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const selectedConversation = conversations.find(
    (c) => c.id === selectedConversationId
  )

  // Fetch messages when conversation is selected
  useEffect(() => {
    if (!selectedConversationId) {
      setMessages([])
      return
    }

    const fetchMessages = async () => {
      setIsLoadingMessages(true)
      try {
        const res = await fetch(
          `/api/conversations/${selectedConversationId}/messages?limit=100`
        )
        if (res.ok) {
          const data = await res.json()
          setMessages(data.messages || [])
        }
      } catch {
        // silently fail
      } finally {
        setIsLoadingMessages(false)
      }
    }

    fetchMessages()

    // Join socket room
    emit('join_conversation', { conversationId: selectedConversationId })

    return () => {
      emit('leave_conversation', { conversationId: selectedConversationId })
    }
  }, [selectedConversationId, emit])

  // Socket listeners for new messages
  useEffect(() => {
    const handleNewMessage = (data: { conversationId: string; message: Message }) => {
      if (data.conversationId === selectedConversationId) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.message.id)) return prev
          return [...prev, data.message]
        })
        addMessage(data.conversationId, data.message)
      }
    }

    const handleTyping = (data: { conversationId: string; name: string; isTyping: boolean }) => {
      if (data.conversationId === selectedConversationId) {
        setIsTyping(data.isTyping)
        setTypingName(data.name)
        if (data.isTyping) {
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
          typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 3000)
        }
      }
    }

    const unsubMsg = on('new_message', handleNewMessage as (...args: unknown[]) => void)
    const unsubTyping = on('typing', handleTyping as (...args: unknown[]) => void)

    return () => {
      unsubMsg()
      unsubTyping()
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    }
  }, [selectedConversationId, on, off, addMessage])

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isTyping])

  const handleSendMessage = useCallback(
    async (content: string, isInternal: boolean) => {
      if (!selectedConversationId || !user) return

      const res = await fetch(
        `/api/conversations/${selectedConversationId}/messages`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content,
            senderType: 'agent',
            senderId: user.id,
            isInternal,
          }),
        }
      )

      if (res.ok) {
        const data = await res.json()
        const message = data.message as Message

        // Emit via socket
        emit('send_message', {
          conversationId: selectedConversationId,
          message: {
            id: message.id,
            senderType: message.senderType,
            senderId: message.senderId,
            content: message.content,
            contentType: message.contentType,
            createdAt: message.createdAt,
            isInternal: message.isInternal,
          },
        })

        setMessages((prev) => {
          if (prev.some((m) => m.id === message.id)) return prev
          return [...prev, message]
        })
        addMessage(selectedConversationId, message)
      }
    },
    [selectedConversationId, user, emit, addMessage]
  )

  const handleUpdateConversation = async (updates: Record<string, unknown>) => {
    if (!selectedConversationId) return

    const res = await fetch(`/api/conversations/${selectedConversationId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })

    if (res.ok) {
      const data = await res.json()
      updateConversation(selectedConversationId, data.conversation)
      toast.success('Conversation updated')
    } else {
      toast.error('Failed to update conversation')
    }
  }

  // Empty state
  if (!selectedConversationId || !selectedConversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-muted/20">
        <div className="text-center">
          <div className="w-20 h-20 rounded-3xl bg-muted/60 flex items-center justify-center mx-auto mb-4">
            <MessageCircle className="w-10 h-10 text-muted-foreground/40" />
          </div>
          <h3 className="text-lg font-semibold text-muted-foreground">
            Select a conversation
          </h3>
          <p className="text-sm text-muted-foreground/70 mt-1">
            Choose a conversation from the list to start chatting
          </p>
        </div>
      </div>
    )
  }

  const ChannelIcon = channelIcons[selectedConversation.channel?.type || 'website'] || Globe
  const channelBadge = channelBadgeVariant[selectedConversation.channel?.type || 'website'] || ''

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Chat Header */}
      <div className="flex items-center gap-3 h-14 px-4 border-b border-border/50 bg-card/50 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <h3 className="text-sm font-semibold truncate">
            {selectedConversation.customer?.name || 'Unknown'}
          </h3>
          <span
            className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium',
              channelBadge
            )}
          >
            <ChannelIcon className="w-3 h-3" />
            {selectedConversation.channel?.name || selectedConversation.channel?.type}
          </span>
        </div>

        {/* AI Mode Selector */}
        <Select
          value={selectedConversation.aiMode}
          onValueChange={(value) => handleUpdateConversation({ aiMode: value })}
        >
          <SelectTrigger className="w-[120px] h-8 text-xs">
            <Sparkles className="w-3 h-3 mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">AI Auto</SelectItem>
            <SelectItem value="suggest">AI Suggest</SelectItem>
            <SelectItem value="human">Human Only</SelectItem>
          </SelectContent>
        </Select>

        <Separator orientation="vertical" className="h-6" />

        {/* Actions */}
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground"
                onClick={onToggleDetails}
              >
                {showDetails ? (
                  <PanelRightClose className="w-4 h-4" />
                ) : (
                  <PanelRightOpen className="w-4 h-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {showDetails ? 'Hide details' : 'Show details'}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() =>
                handleUpdateConversation({
                  isPinned: !selectedConversation.isPinned,
                })
              }
            >
              {selectedConversation.isPinned ? (
                <>
                  <PinOff className="w-4 h-4 mr-2" /> Unpin
                </>
              ) : (
                <>
                  <Pin className="w-4 h-4 mr-2" /> Pin
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleUpdateConversation({ status: 'pending' })}>
              <UserPlus className="w-4 h-4 mr-2" /> Reassign
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleUpdateConversation({ status: 'archived' })}>
              <Archive className="w-4 h-4 mr-2" /> Archive
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => handleUpdateConversation({ status: 'closed' })}
            >
              <XCircle className="w-4 h-4 mr-2" /> Close
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Messages Area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto scrollbar-thin py-4"
      >
        {isLoadingMessages ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading messages...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <p className="text-sm text-muted-foreground">No messages yet</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Start the conversation below
            </p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
          </AnimatePresence>
        )}

        {/* Typing indicator */}
        <AnimatePresence>
          {isTyping && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              className="flex items-center gap-2 px-6 py-2"
            >
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" />
              </div>
              <p className="text-xs text-muted-foreground">
                {typingName} is typing...
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Input */}
      <ChatInput
        conversationId={selectedConversationId}
        onSend={handleSendMessage}
      />
    </div>
  )
}
