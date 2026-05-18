'use client'

import { motion } from 'framer-motion'
import { formatDistanceToNow } from 'date-fns'
import ReactMarkdown from 'react-markdown'
import { Sparkles, Check, CheckCheck, StickyNote } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Message } from '@/lib/store'

interface MessageBubbleProps {
  message: Message
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isCustomer = message.senderType === 'customer'
  const isAI = message.senderType === 'ai'
  const isSystem = message.senderType === 'system'
  const isInternal = message.isInternal

  // System messages: centered subtle text
  if (isSystem) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-center py-2"
      >
        <p className="text-xs text-muted-foreground bg-muted/60 px-3 py-1.5 rounded-full">
          {message.content}
        </p>
      </motion.div>
    )
  }

  // Internal notes: amber/yellow background
  if (isInternal) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-start py-1 px-4"
      >
        <div className="max-w-[75%]">
          <div className="flex items-center gap-1.5 mb-1">
            <StickyNote className="w-3 h-3 text-amber-600 dark:text-amber-400" />
            <span className="text-[11px] font-medium text-amber-700 dark:text-amber-300">
              Internal Note
            </span>
            {message.sender && (
              <span className="text-[11px] text-amber-600/70 dark:text-amber-400/70">
                by {message.sender.name}
              </span>
            )}
          </div>
          <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800/50 rounded-2xl rounded-tl-sm px-3.5 py-2.5">
            <div className="text-sm text-amber-900 dark:text-amber-100 prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1">
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
          </div>
          <p className="text-[10px] text-amber-600/60 dark:text-amber-400/60 mt-1 ml-1">
            {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
          </p>
        </div>
      </motion.div>
    )
  }

  // Customer messages: left-aligned, light background
  if (isCustomer) {
    return (
      <motion.div
        initial={{ opacity: 0, x: -8, y: 5 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        className="flex justify-start py-1 px-4"
      >
        <div className="max-w-[75%]">
          <div className="bg-muted rounded-2xl rounded-tl-sm px-3.5 py-2.5">
            <div className="text-sm prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1">
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
          </div>
          <div className="flex items-center gap-1 mt-1 ml-1">
            <p className="text-[10px] text-muted-foreground">
              {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
            </p>
          </div>
        </div>
      </motion.div>
    )
  }

  // AI / Agent messages: right-aligned, dark background
  return (
    <motion.div
      initial={{ opacity: 0, x: 8, y: 5 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      className="flex justify-end py-1 px-4"
    >
      <div className="max-w-[75%]">
        {isAI && (
          <div className="flex items-center gap-1.5 mb-1 justify-end">
            <Sparkles className="w-3 h-3 text-slate-400" />
            <span className="text-[11px] font-medium text-muted-foreground">AI Assistant</span>
          </div>
        )}
        <div
          className={cn(
            'rounded-2xl rounded-tr-sm px-3.5 py-2.5',
            isAI
              ? 'bg-gradient-to-br from-slate-800 to-slate-900 dark:from-slate-100 dark:to-slate-200 text-white dark:text-slate-900'
              : 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900'
          )}
        >
          <div className={cn(
            'text-sm prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1',
            isAI
              ? 'prose-invert dark:prose-invert-[false]'
              : 'prose-invert dark:prose-invert-[false]'
          )}>
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        </div>
        <div className="flex items-center gap-1 mt-1 mr-1 justify-end">
          <p className="text-[10px] text-muted-foreground">
            {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
          </p>
          {message.isRead ? (
            <CheckCheck className="w-3 h-3 text-slate-400" />
          ) : (
            <Check className="w-3 h-3 text-muted-foreground" />
          )}
        </div>
      </div>
    </motion.div>
  )
}
