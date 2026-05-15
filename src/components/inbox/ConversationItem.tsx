'use client'

import { motion } from 'framer-motion'
import { formatDistanceToNow } from 'date-fns'
import { Globe, Phone, MessageCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import type { Conversation } from '@/lib/store'

const channelIcons: Record<string, React.ElementType> = {
  website: Globe,
  facebook: MessageCircle,
  whatsapp: Phone,
}

const channelColors: Record<string, string> = {
  website: 'text-emerald-600 dark:text-emerald-400',
  facebook: 'text-sky-600 dark:text-sky-400',
  whatsapp: 'text-green-600 dark:text-green-400',
}

const priorityColors: Record<string, string> = {
  urgent: 'bg-red-500',
  high: 'bg-orange-500',
  normal: 'bg-slate-300 dark:bg-slate-600',
  low: 'bg-slate-200 dark:bg-slate-700',
}

const aiModeBadge: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  auto: { label: 'AI Auto', variant: 'default' },
  suggest: { label: 'AI Suggest', variant: 'secondary' },
  human: { label: 'Human', variant: 'outline' },
}

interface ConversationItemProps {
  conversation: Conversation
  isSelected: boolean
  onClick: () => void
}

export default function ConversationItem({
  conversation,
  isSelected,
  onClick,
}: ConversationItemProps) {
  const customer = conversation.customer
  const ChannelIcon = channelIcons[conversation.channel?.type || 'website'] || Globe
  const channelColor = channelColors[conversation.channel?.type || 'website'] || ''
  const aiBadge = aiModeBadge[conversation.aiMode] || aiModeBadge.human

  return (
    <motion.button
      whileHover={{ x: 2 }}
      onClick={onClick}
      className={cn(
        'w-full flex items-start gap-3 p-3 rounded-xl text-left transition-all duration-200 group',
        isSelected
          ? 'bg-slate-100 dark:bg-slate-800 shadow-sm'
          : 'hover:bg-accent/50'
      )}
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <Avatar className="h-10 w-10">
          <AvatarFallback className="bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold">
            {customer?.name?.charAt(0).toUpperCase() || '?'}
          </AvatarFallback>
        </Avatar>
        {/* Priority dot */}
        <span
          className={cn(
            'absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900',
            priorityColors[conversation.priority] || priorityColors.normal
          )}
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className={cn(
            'text-sm font-semibold truncate',
            conversation.unreadCount > 0 ? 'text-foreground' : 'text-muted-foreground'
          )}>
            {customer?.name || 'Unknown'}
          </p>
          <span className="text-[11px] text-muted-foreground whitespace-nowrap flex-shrink-0">
            {conversation.lastMessageAt
              ? formatDistanceToNow(new Date(conversation.lastMessageAt), { addSuffix: false })
              : ''}
          </span>
        </div>

        <div className="flex items-center gap-1.5 mt-0.5">
          <ChannelIcon className={cn('w-3 h-3 flex-shrink-0', channelColor)} />
          <p className="text-xs text-muted-foreground truncate flex-1">
            {conversation.lastMessage || 'No messages yet'}
          </p>
        </div>

        <div className="flex items-center gap-1.5 mt-1.5">
          <Badge
            variant={aiBadge.variant}
            className="h-4 text-[10px] px-1.5 py-0 font-medium"
          >
            {aiBadge.label}
          </Badge>

          {conversation.isPinned && (
            <span className="text-[10px] text-muted-foreground">📌</span>
          )}

          {conversation.unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="h-4 min-w-4 text-[10px] px-1 py-0 ml-auto font-bold"
            >
              {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
            </Badge>
          )}
        </div>
      </div>
    </motion.button>
  )
}
