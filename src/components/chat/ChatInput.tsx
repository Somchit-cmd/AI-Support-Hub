'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Sparkles, Send, Paperclip, Smile, StickyNote, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/lib/store'
import { useSocket } from '@/hooks/use-socket'
import { toast } from 'sonner'

interface ChatInputProps {
  conversationId: string
  onSend: (content: string, isInternal: boolean) => Promise<void>
}

export default function ChatInput({ conversationId, onSend }: ChatInputProps) {
  const [content, setContent] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [isAiLoading, setIsAiLoading] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const user = useAuthStore((s) => s.user)
  const { emit } = useSocket()

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`
    }
  }, [content])

  // Typing indicator via socket
  const emitTyping = useCallback(
    (isTyping: boolean) => {
      if (user) {
        emit('typing_start', {
          conversationId,
          userId: user.id,
          name: user.name,
        })
        if (!isTyping) {
          emit('typing_stop', {
            conversationId,
            userId: user.id,
            name: user.name,
          })
        }
      }
    },
    [conversationId, user, emit]
  )

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value)
    emitTyping(true)

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }
    typingTimeoutRef.current = setTimeout(() => {
      emitTyping(false)
    }, 2000)
  }

  const handleSend = async () => {
    const trimmed = content.trim()
    if (!trimmed || isSending) return

    setIsSending(true)
    try {
      await onSend(trimmed, isInternal)
      setContent('')
      emitTyping(false)

      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    } catch {
      toast.error('Failed to send message')
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleAiSuggest = async () => {
    setIsAiLoading(true)
    try {
      const res = await fetch(`/api/conversations/${conversationId}/ai-reply`, {
        method: 'POST',
      })
      if (res.ok) {
        toast.success('AI reply generated')
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error((data as { error?: string }).error || 'Failed to generate AI reply')
      }
    } catch {
      toast.error('Failed to generate AI reply')
    } finally {
      setIsAiLoading(false)
    }
  }

  return (
    <div className="border-t border-border/50 bg-card/50 backdrop-blur-sm">
      {/* Internal note toggle */}
      <div className="flex items-center gap-2 px-4 pt-2">
        <Button
          variant={isInternal ? 'default' : 'ghost'}
          size="sm"
          className={cn(
            'h-7 text-xs gap-1.5 rounded-lg',
            isInternal && 'bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900/50 dark:text-amber-300 dark:hover:bg-amber-900/70'
          )}
          onClick={() => setIsInternal(!isInternal)}
        >
          <StickyNote className="w-3 h-3" />
          Internal Note
        </Button>

        <Separator orientation="vertical" className="h-4" />

        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1.5 rounded-lg"
          onClick={handleAiSuggest}
          disabled={isAiLoading}
        >
          {isAiLoading ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Sparkles className="w-3 h-3" />
          )}
          AI Suggest
        </Button>
      </div>

      {/* Input area */}
      <div className="flex items-end gap-2 p-3">
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            placeholder={
              isInternal
                ? 'Write an internal note... (only visible to team)'
                : 'Type a message... (Shift+Enter for new line)'
            }
            value={content}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            className={cn(
              'min-h-[40px] max-h-[160px] resize-none rounded-xl pr-3 text-sm',
              isInternal && 'border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-900/20 focus-visible:ring-amber-400'
            )}
            rows={1}
          />
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-muted-foreground"
          >
            <Paperclip className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-muted-foreground"
          >
            <Smile className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            className={cn(
              'h-9 w-9 rounded-xl',
              isInternal
                ? 'bg-amber-600 hover:bg-amber-700'
                : 'bg-slate-800 hover:bg-slate-700 dark:bg-slate-100 dark:hover:bg-slate-200 dark:text-slate-900'
            )}
            onClick={handleSend}
            disabled={!content.trim() || isSending}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
