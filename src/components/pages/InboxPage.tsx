'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useConversationStore, useAuthStore, Message, Conversation, Customer } from '@/lib/store'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import ReactMarkdown from 'react-markdown'
import { formatDistanceToNow } from 'date-fns'
import {
  MessageSquare, Globe, Phone, Search, Filter, Pin, Archive, MoreVertical,
  Send, Sparkles, StickyNote, Paperclip, Smile, ChevronRight, ChevronLeft,
  UserCheck, Clock, Zap, AlertCircle, Check, CheckCheck, X, Tag, Edit,
  Mail, MessageCircle, Hash, Star, Trash2, ArrowDown
} from 'lucide-react'

// ===================== CONVERSATION LIST =====================

function ConversationListPanel() {
  const { conversations, selectedConversationId, selectConversation, isLoading, filters, setFilters, fetchConversations } = useConversationStore()
  const [channelFilter, setChannelFilter] = useState<string>('all')

  useEffect(() => {
    fetchConversations()
  }, [fetchConversations, filters])

  const filteredConversations = conversations.filter((c) => {
    if (channelFilter !== 'all') {
      const channelType = (c.channel as Record<string, string>)?.type || c.channelId
      if (channelFilter === 'website' && channelType !== 'website') return false
      if (channelFilter === 'facebook' && channelType !== 'facebook') return false
      if (channelFilter === 'whatsapp' && channelType !== 'whatsapp') return false
    }
    return true
  })

  const pinnedConvos = filteredConversations.filter(c => c.isPinned)
  const regularConvos = filteredConversations.filter(c => !c.isPinned)

  return (
    <div className="w-[340px] border-r border-border bg-card flex flex-col h-full shrink-0">
      {/* Search & Filters */}
      <div className="p-3 space-y-2 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            className="pl-9 h-9 bg-muted/50 border-0"
            value={filters.search}
            onChange={(e) => setFilters({ search: e.target.value })}
          />
        </div>
        <div className="flex gap-1">
          {[
            { key: 'all', label: 'All', icon: MessageSquare },
            { key: 'website', label: 'Web', icon: Globe },
            { key: 'facebook', label: 'FB', icon: MessageCircle },
            { key: 'whatsapp', label: 'WA', icon: Phone },
          ].map((f) => (
            <Button
              key={f.key}
              variant={channelFilter === f.key ? 'default' : 'ghost'}
              size="sm"
              className={cn(
                'h-7 text-xs px-2.5',
                channelFilter === f.key && 'bg-slate-900 text-white hover:bg-slate-800'
              )}
              onClick={() => setChannelFilter(f.key)}
            >
              <f.icon className="h-3 w-3 mr-1" />
              {f.label}
            </Button>
          ))}
        </div>
        <div className="flex gap-1">
          {['all', 'active', 'pending', 'closed'].map((s) => (
            <Button
              key={s}
              variant="ghost"
              size="sm"
              className={cn(
                'h-6 text-[11px] px-2',
                filters.status === (s === 'all' ? null : s) && 'bg-muted font-medium'
              )}
              onClick={() => setFilters({ status: s === 'all' ? null : s })}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {/* Conversation List */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="p-3 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-3 p-2">
                <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No conversations found</p>
          </div>
        ) : (
          <>
            {pinnedConvos.length > 0 && (
              <div className="px-3 pt-3 pb-1">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Pinned</p>
              </div>
            )}
            {pinnedConvos.map((conv) => (
              <ConversationItem
                key={conv.id}
                conversation={conv}
                isSelected={conv.id === selectedConversationId}
                onSelect={() => selectConversation(conv.id)}
              />
            ))}
            {pinnedConvos.length > 0 && regularConvos.length > 0 && (
              <div className="px-3 pt-3 pb-1">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Recent</p>
              </div>
            )}
            {regularConvos.map((conv) => (
              <ConversationItem
                key={conv.id}
                conversation={conv}
                isSelected={conv.id === selectedConversationId}
                onSelect={() => selectConversation(conv.id)}
              />
            ))}
          </>
        )}
      </ScrollArea>
    </div>
  )
}

function ConversationItem({ conversation, isSelected, onSelect }: {
  conversation: Conversation
  isSelected: boolean
  onSelect: () => void
}) {
  const customer = conversation.customer as Customer | undefined
  const channel = conversation.channel as Record<string, string> | undefined
  const channelType = channel?.type || 'website'

  const channelIcon = channelType === 'facebook' ? MessageCircle : channelType === 'whatsapp' ? Phone : Globe
  const ChannelIcon = channelIcon

  const priorityColor = conversation.priority === 'urgent' ? 'bg-red-500' : conversation.priority === 'high' ? 'bg-orange-500' : ''

  const aiModeColor = conversation.aiMode === 'auto' ? 'text-emerald-600 bg-emerald-50' : conversation.aiMode === 'suggest' ? 'text-amber-600 bg-amber-50' : 'text-slate-600 bg-slate-100'

  return (
    <motion.button
      whileHover={{ backgroundColor: 'oklch(0.97 0 0)' }}
      onClick={onSelect}
      className={cn(
        'w-full flex items-start gap-3 p-3 text-left transition-colors border-b border-border/50',
        isSelected && 'bg-slate-50 border-l-2 border-l-slate-900'
      )}
    >
      <div className="relative shrink-0">
        <Avatar className="h-10 w-10">
          <AvatarFallback className="bg-slate-200 text-slate-700 text-sm font-semibold">
            {customer?.name?.charAt(0)?.toUpperCase() || '?'}
          </AvatarFallback>
        </Avatar>
        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-white flex items-center justify-center">
          <ChannelIcon className="h-2.5 w-2.5 text-slate-500" />
        </div>
        {priorityColor && (
          <div className={cn('absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full', priorityColor)} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <span className="text-sm font-medium truncate">{customer?.name || 'Unknown'}</span>
          <span className="text-[11px] text-muted-foreground shrink-0">
            {conversation.lastMessageAt ? formatDistanceToNow(new Date(conversation.lastMessageAt), { addSuffix: false }) : ''}
          </span>
        </div>
        <p className="text-xs text-muted-foreground truncate mt-0.5">{conversation.lastMessage || 'No messages yet'}</p>
        <div className="flex items-center gap-1.5 mt-1.5">
          <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full', aiModeColor)}>
            {conversation.aiMode === 'auto' ? '🤖 Auto' : conversation.aiMode === 'suggest' ? '💡 Suggest' : '👤 Human'}
          </span>
          {conversation.unreadCount > 0 && (
            <span className="text-[10px] font-bold bg-slate-900 text-white rounded-full h-4 min-w-4 flex items-center justify-center px-1">
              {conversation.unreadCount}
            </span>
          )}
          {conversation.isPinned && <Pin className="h-3 w-3 text-muted-foreground" />}
        </div>
      </div>
    </motion.button>
  )
}

// ===================== CHAT WINDOW =====================

function ChatWindowPanel() {
  const { conversations, selectedConversationId, addMessage, updateConversation } = useConversationStore()
  const user = useAuthStore((s) => s.user)
  const [message, setMessage] = useState('')
  const [isNote, setIsNote] = useState(false)
  const [isAiTyping, setIsAiTyping] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [showDetails, setShowDetails] = useState(true)
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])

  useEffect(() => {
    const conv = conversations.find(c => c.id === selectedConversationId)
    setConversation(conv || null)
    setMessages(conv?.messages || [])
  }, [conversations, selectedConversationId])

  useEffect(() => {
    if (selectedConversationId) {
      fetchMessages(selectedConversationId)
    }
  }, [selectedConversationId])

  const fetchMessages = async (convId: string) => {
    try {
      const res = await fetch(`/api/conversations/${convId}`)
      if (res.ok) {
        const data = await res.json()
        setMessages(data.messages || [])
      }
    } catch {
      // silently fail
    }
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!message.trim() || !selectedConversationId) return
    setIsSending(true)
    try {
      const res = await fetch(`/api/conversations/${selectedConversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: message.trim(),
          senderType: isNote ? 'system' : 'agent',
          senderId: user?.id,
          contentType: 'text',
          isInternal: isNote,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setMessages(prev => [...prev, data.message])
        setMessage('')
        updateConversation(selectedConversationId, {
          lastMessage: message.trim(),
          lastMessageAt: new Date().toISOString(),
        })
      }
    } catch {
      // error
    } finally {
      setIsSending(false)
    }
  }

  const handleAiReply = async () => {
    if (!selectedConversationId) return
    setIsAiTyping(true)
    try {
      const res = await fetch(`/api/conversations/${selectedConversationId}/ai-reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      if (res.ok) {
        const data = await res.json()
        setMessages(prev => [...prev, data.message])
        updateConversation(selectedConversationId, {
          lastMessage: data.message?.content?.substring(0, 80),
          lastMessageAt: new Date().toISOString(),
        })
      }
    } catch {
      // error
    } finally {
      setIsAiTyping(false)
    }
  }

  const handleAiSuggest = async () => {
    if (!selectedConversationId) return
    try {
      const res = await fetch(`/api/conversations/${selectedConversationId}/ai-reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suggestOnly: true }),
      })
      if (res.ok) {
        const data = await res.json()
        setAiSuggestions(data.suggestions || [data.message?.content || 'Thank you for your message.'])
      }
    } catch {
      setAiSuggestions(['Thank you for reaching out. Let me look into this for you.'])
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleStatusChange = async (status: string) => {
    if (!selectedConversationId) return
    try {
      await fetch(`/api/conversations/${selectedConversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      updateConversation(selectedConversationId, { status })
    } catch {
      // error
    }
  }

  const handleAiModeChange = async (aiMode: string) => {
    if (!selectedConversationId) return
    try {
      await fetch(`/api/conversations/${selectedConversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aiMode }),
      })
      updateConversation(selectedConversationId, { aiMode })
    } catch {
      // error
    }
  }

  const customer = conversation?.customer as Customer | undefined
  const channel = conversation?.channel as Record<string, string> | undefined

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
            <MessageSquare className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold">Select a conversation</h3>
          <p className="text-sm text-muted-foreground mt-1">Choose a conversation from the left panel</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex h-full min-w-0">
      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Chat Header */}
        <div className="h-14 border-b border-border bg-card/80 backdrop-blur-sm flex items-center px-4 gap-3 shrink-0">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-slate-200 text-slate-700 text-sm font-semibold">
              {customer?.name?.charAt(0)?.toUpperCase() || '?'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold truncate">{customer?.name || 'Unknown'}</span>
              <Badge variant="outline" className="text-[10px] h-5 shrink-0">
                {channel?.type === 'facebook' ? 'Facebook' : channel?.type === 'whatsapp' ? 'WhatsApp' : 'Website'}
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {conversation.status === 'active' ? '● Active' : conversation.status === 'pending' ? '○ Pending' : '✓ Closed'}
            </p>
          </div>

          {/* AI Mode Selector */}
          <Select value={conversation.aiMode} onValueChange={handleAiModeChange}>
            <SelectTrigger className="w-[120px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto"><span className="flex items-center gap-1.5"><Zap className="h-3 w-3 text-emerald-500" /> AI Auto</span></SelectItem>
              <SelectItem value="suggest"><span className="flex items-center gap-1.5"><Sparkles className="h-3 w-3 text-amber-500" /> AI Suggest</span></SelectItem>
              <SelectItem value="human"><span className="flex items-center gap-1.5"><UserCheck className="h-3 w-3 text-slate-500" /> Human Only</span></SelectItem>
            </SelectContent>
          </Select>

          {/* Actions */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowDetails(!showDetails)}>
                  <ChevronRight className={cn("h-4 w-4 transition-transform", showDetails && "rotate-180")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Toggle details</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => updateConversation(conversation.id, { isPinned: !conversation.isPinned })}>
                <Pin className="h-4 w-4 mr-2" /> {conversation.isPinned ? 'Unpin' : 'Pin'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleStatusChange('closed')}>
                <Archive className="h-4 w-4 mr-2" /> Close Conversation
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onClick={() => handleStatusChange('closed')}>
                <Trash2 className="h-4 w-4 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Messages Area */}
        <ScrollArea className="flex-1 px-4 py-4">
          <div className="max-w-3xl mx-auto space-y-3">
            {messages.map((msg, i) => (
              <MessageBubble key={msg.id} message={msg} isLast={i === messages.length - 1} />
            ))}
            {isAiTyping && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-2"
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-slate-900 text-white text-xs">
                    <Sparkles className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
                <div className="message-ai px-4 py-3">
                  <div className="flex items-center gap-1">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 rounded-full bg-white/60 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 rounded-full bg-white/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 rounded-full bg-white/60 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* AI Suggestions */}
        <AnimatePresence>
          {aiSuggestions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="border-t border-border px-4 py-2 bg-emerald-50/50"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                <span className="text-xs font-medium text-emerald-700">AI Suggestions</span>
                <Button variant="ghost" size="icon" className="h-5 w-5 ml-auto" onClick={() => setAiSuggestions([])}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {aiSuggestions.map((suggestion, i) => (
                  <button
                    key={i}
                    onClick={() => { setMessage(suggestion); setAiSuggestions([]) }}
                    className="whitespace-nowrap text-xs bg-white border border-emerald-200 rounded-lg px-3 py-1.5 hover:bg-emerald-50 transition-colors text-left"
                  >
                    {suggestion.substring(0, 60)}{suggestion.length > 60 ? '...' : ''}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input Area */}
        <div className="border-t border-border p-3 bg-card">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center gap-2 mb-2">
              <Button
                variant={isNote ? 'default' : 'ghost'}
                size="sm"
                className={cn('h-7 text-xs', isNote && 'bg-amber-500 hover:bg-amber-600 text-white')}
                onClick={() => setIsNote(!isNote)}
              >
                <StickyNote className="h-3 w-3 mr-1" />
                Internal Note
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleAiSuggest} disabled={isAiTyping}>
                <Sparkles className="h-3 w-3 mr-1" />
                AI Suggest
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleAiReply} disabled={isAiTyping}>
                <Zap className="h-3 w-3 mr-1" />
                AI Reply
              </Button>
            </div>
            <div className="flex items-end gap-2">
              <div className="flex-1 relative">
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={isNote ? 'Write an internal note...' : 'Type a message... (Enter to send, Shift+Enter for new line)'}
                  className={cn(
                    'w-full min-h-[44px] max-h-[120px] resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/20 transition-all',
                    isNote && 'border-amber-300 bg-amber-50/50 focus:ring-amber-200'
                  )}
                  rows={1}
                />
              </div>
              <div className="flex items-center gap-1">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-9 w-9">
                        <Paperclip className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Attach file</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-9 w-9">
                        <Smile className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Emoji</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <Button
                  size="icon"
                  className={cn('h-9 w-9 shrink-0', isNote ? 'bg-amber-500 hover:bg-amber-600' : 'bg-slate-900 hover:bg-slate-800')}
                  onClick={handleSend}
                  disabled={!message.trim() || isSending}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Customer Details Panel */}
      <AnimatePresence>
        {showDetails && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 300, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-l border-border bg-card overflow-hidden shrink-0"
          >
            <ScrollArea className="h-full">
              <div className="p-4 space-y-4">
                {/* Customer Profile */}
                <div className="text-center pt-4">
                  <Avatar className="h-16 w-16 mx-auto">
                    <AvatarFallback className="bg-slate-200 text-slate-700 text-xl font-bold">
                      {customer?.name?.charAt(0)?.toUpperCase() || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <h3 className="text-base font-semibold mt-3">{customer?.name || 'Unknown'}</h3>
                  <p className="text-xs text-muted-foreground">{customer?.email || 'No email'}</p>
                  <div className="flex items-center justify-center gap-1.5 mt-2">
                    {customer?.facebookId && <Badge variant="outline" className="text-[10px] h-5"><MessageCircle className="h-2.5 w-2.5 mr-1" />FB</Badge>}
                    {customer?.whatsappPhone && <Badge variant="outline" className="text-[10px] h-5"><Phone className="h-2.5 w-2.5 mr-1" />WA</Badge>}
                    <Badge variant="outline" className="text-[10px] h-5"><Globe className="h-2.5 w-2.5 mr-1" />Web</Badge>
                  </div>
                </div>

                <Separator />

                {/* Lead Status */}
                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Lead Status</p>
                  <Select value={customer?.leadStatus || 'new'} onValueChange={() => {}}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="contacted">Contacted</SelectItem>
                      <SelectItem value="qualified">Qualified</SelectItem>
                      <SelectItem value="proposal">Proposal</SelectItem>
                      <SelectItem value="negotiation">Negotiation</SelectItem>
                      <SelectItem value="won">Won</SelectItem>
                      <SelectItem value="lost">Lost</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Sentiment */}
                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Sentiment</p>
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      'h-2.5 w-2.5 rounded-full',
                      customer?.sentiment === 'positive' ? 'bg-emerald-500' : customer?.sentiment === 'negative' ? 'bg-red-500' : 'bg-amber-500'
                    )} />
                    <span className="text-sm capitalize">{customer?.sentiment || 'neutral'}</span>
                  </div>
                </div>

                <Separator />

                {/* Contact Info */}
                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Contact Info</p>
                  <div className="space-y-2">
                    {customer?.email && (
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span className="truncate">{customer.email}</span>
                      </div>
                    )}
                    {customer?.phone && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{customer.phone}</span>
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Tags */}
                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Tags</p>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="secondary" className="text-[11px]">VIP</Badge>
                    <Badge variant="secondary" className="text-[11px]">Enterprise</Badge>
                    <Button variant="outline" size="sm" className="h-6 text-[11px] px-2">
                      <Tag className="h-3 w-3 mr-1" /> Add
                    </Button>
                  </div>
                </div>

                <Separator />

                {/* Notes */}
                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Notes</p>
                  <textarea
                    placeholder="Add notes about this customer..."
                    className="w-full h-20 text-xs border border-border rounded-lg p-2 resize-none bg-background focus:outline-none focus:ring-2 focus:ring-ring/20"
                    defaultValue={customer?.notes || ''}
                  />
                </div>
              </div>
            </ScrollArea>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ===================== MESSAGE BUBBLE =====================

function MessageBubble({ message, isLast }: { message: Message; isLast: boolean }) {
  const isCustomer = message.senderType === 'customer'
  const isAi = message.senderType === 'ai'
  const isAgent = message.senderType === 'agent'
  const isInternal = message.isInternal
  const isSystem = message.senderType === 'system'

  if (isSystem && !isInternal) {
    return (
      <div className="flex justify-center">
        <span className="text-[11px] text-muted-foreground bg-muted px-3 py-1 rounded-full">
          {message.content}
        </span>
      </div>
    )
  }

  if (isInternal) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center"
      >
        <div className="message-note px-4 py-2.5 max-w-lg w-full">
          <div className="flex items-center gap-1.5 mb-1">
            <StickyNote className="h-3 w-3 text-amber-600" />
            <span className="text-[11px] font-semibold text-amber-700">Internal Note</span>
          </div>
          <p className="text-sm text-amber-900">{message.content}</p>
          <span className="text-[10px] text-amber-600 mt-1 block">
            {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
          </span>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('flex items-start gap-2', isCustomer ? '' : 'flex-row-reverse')}
    >
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback className={cn(
          'text-xs font-semibold',
          isCustomer ? 'bg-slate-200 text-slate-700' :
          isAi ? 'bg-slate-900 text-white' :
          'bg-slate-700 text-white'
        )}>
          {isCustomer ? (message.content.charAt(0)) :
           isAi ? <Sparkles className="h-4 w-4" /> :
           'A'}
        </AvatarFallback>
      </Avatar>
      <div className={cn('max-w-[70%]', isCustomer ? '' : 'text-right')}>
        <div className="flex items-center gap-1.5 mb-1">
          {isCustomer && <span className="text-[11px] font-medium text-muted-foreground">Customer</span>}
          {isAi && <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1"><Sparkles className="h-3 w-3" /> AI Assistant</span>}
          {isAgent && <span className="text-[11px] font-medium text-muted-foreground">Agent</span>}
        </div>
        <div className={cn(
          'inline-block px-4 py-2.5 text-sm',
          isCustomer ? 'message-customer' :
          isAi ? 'message-ai' :
          'message-agent'
        )}>
          <div className="prose prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        </div>
        <div className={cn('flex items-center gap-1 mt-1', isCustomer ? '' : 'justify-end')}>
          <span className="text-[10px] text-muted-foreground">
            {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
          </span>
          {!isCustomer && (
            message.isRead ? <CheckCheck className="h-3 w-3 text-blue-500" /> : <Check className="h-3 w-3 text-muted-foreground" />
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ===================== MAIN INBOX PAGE =====================

export default function InboxPage() {
  return (
    <div className="flex h-full">
      <ConversationListPanel />
      <ChatWindowPanel />
    </div>
  )
}
