'use client'

import { useEffect, useRef } from 'react'
import { useConversationStore } from '@/lib/store'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import ConversationItem from './ConversationItem'

export default function ConversationList() {
  const {
    conversations,
    selectedConversationId,
    selectConversation,
    isLoading,
  } = useConversationStore()

  const selectedRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (selectedRef.current) {
      selectedRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [selectedConversationId])

  if (isLoading) {
    return (
      <div className="p-3 space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3 p-3">
            <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-10" />
              </div>
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
          <span className="text-2xl">💬</span>
        </div>
        <p className="text-sm font-medium text-muted-foreground">No conversations found</p>
        <p className="text-xs text-muted-foreground mt-1">
          Try adjusting your filters
        </p>
      </div>
    )
  }

  // Sort: pinned first, then by lastMessageAt
  const sorted = [...conversations].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1
    if (!a.isPinned && b.isPinned) return 1
    return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
  })

  return (
    <ScrollArea className="h-full">
      <div className="p-2 space-y-0.5">
        {sorted.map((conv) => (
          <div
            key={conv.id}
            ref={conv.id === selectedConversationId ? selectedRef : undefined}
          >
            <ConversationItem
              conversation={conv}
              isSelected={conv.id === selectedConversationId}
              onClick={() => selectConversation(conv.id)}
            />
          </div>
        ))}
      </div>
    </ScrollArea>
  )
}
