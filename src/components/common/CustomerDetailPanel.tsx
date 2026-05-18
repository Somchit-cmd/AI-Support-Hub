'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { formatDistanceToNow } from 'date-fns'
import {
  Globe,
  MessageCircle,
  Phone,
  Mail,
  Edit3,
  Tag,
  X,
} from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { Conversation, Customer, CustomerTag } from '@/lib/store'

const sentimentColors: Record<string, string> = {
  positive: 'text-emerald-600 dark:text-emerald-400',
  neutral: 'text-slate-500 dark:text-slate-400',
  negative: 'text-red-600 dark:text-red-400',
}

const sentimentBg: Record<string, string> = {
  positive: 'bg-emerald-100 dark:bg-emerald-900/30',
  neutral: 'bg-slate-100 dark:bg-slate-800/30',
  negative: 'bg-red-100 dark:bg-red-900/30',
}

interface CustomerDetailPanelProps {
  conversation: Conversation
  onClose: () => void
}

export default function CustomerDetailPanel({
  conversation,
  onClose,
}: CustomerDetailPanelProps) {
  const customer = conversation.customer
  const [notes, setNotes] = useState(customer?.notes || '')
  const [isUpdating, setIsUpdating] = useState(false)
  const [customerDetails, setCustomerDetails] = useState<Customer | null>(customer || null)

  useEffect(() => {
    if (customer?.id) {
      // Fetch full customer details
      fetch(`/api/customers/${customer.id}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.customer) setCustomerDetails(data.customer)
        })
        .catch(() => {})
    }
  }, [customer?.id])

  const handleSaveNotes = async () => {
    if (!customer?.id) return
    setIsUpdating(true)
    try {
      const res = await fetch(`/api/customers/${customer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      })
      if (res.ok) {
        const data = await res.json()
        setCustomerDetails(data.customer)
      }
    } catch {
      // silently fail
    } finally {
      setIsUpdating(false)
    }
  }

  const handleUpdateLeadStatus = async (leadStatus: string) => {
    if (!customer?.id) return
    try {
      const res = await fetch(`/api/customers/${customer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadStatus }),
      })
      if (res.ok) {
        const data = await res.json()
        setCustomerDetails(data.customer)
      }
    } catch {
      // silently fail
    }
  }

  if (!customerDetails) {
    return (
      <div className="w-[300px] border-l border-border/50 bg-card/50 p-6">
        <Skeleton className="h-12 w-12 rounded-full mb-4" />
        <Skeleton className="h-4 w-32 mb-2" />
        <Skeleton className="h-3 w-24 mb-6" />
        <Skeleton className="h-3 w-full mb-2" />
        <Skeleton className="h-3 w-full mb-2" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    )
  }

  const tags: CustomerTag[] = customerDetails.tags || []

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.2 }}
      className="w-[300px] border-l border-border/50 bg-card/50 backdrop-blur-sm flex flex-col flex-shrink-0"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border/50">
        <h3 className="text-sm font-semibold">Customer Details</h3>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground"
          onClick={onClose}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-5">
          {/* Profile */}
          <div className="flex flex-col items-center text-center">
            <Avatar className="h-16 w-16 mb-3">
              <AvatarFallback className="bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xl font-semibold">
                {customerDetails.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <h4 className="text-base font-semibold">{customerDetails.name}</h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              Last active{' '}
              {formatDistanceToNow(new Date(customerDetails.lastActivity), {
                addSuffix: true,
              })}
            </p>
          </div>

          {/* Contact Info */}
          <div className="space-y-2">
            {customerDetails.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-muted-foreground truncate">
                  {customerDetails.email}
                </span>
              </div>
            )}
            {customerDetails.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">
                  {customerDetails.phone}
                </span>
              </div>
            )}
          </div>

          {/* Channel badges */}
          <div className="flex flex-wrap gap-1.5">
            {customerDetails.facebookId && (
              <Badge
                variant="secondary"
                className="text-[10px] gap-1 bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400"
              >
                <MessageCircle className="w-3 h-3" /> Facebook
              </Badge>
            )}
            {customerDetails.whatsappPhone && (
              <Badge
                variant="secondary"
                className="text-[10px] gap-1 bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400"
              >
                <Phone className="w-3 h-3" /> WhatsApp
              </Badge>
            )}
            <Badge
              variant="secondary"
              className="text-[10px] gap-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
            >
              <Globe className="w-3 h-3" /> Website
            </Badge>
          </div>

          <Separator />

          {/* Lead Status */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">
              Lead Status
            </Label>
            <Select
              value={customerDetails.leadStatus}
              onValueChange={handleUpdateLeadStatus}
            >
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
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">
              Sentiment
            </Label>
            <div
              className={cn(
                'inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium',
                sentimentBg[customerDetails.sentiment] || sentimentBg.neutral,
                sentimentColors[customerDetails.sentiment] || sentimentColors.neutral
              )}
            >
              {customerDetails.sentiment.charAt(0).toUpperCase() +
                customerDetails.sentiment.slice(1)}
            </div>
          </div>

          {/* Tags */}
          {tags.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Tag className="w-3 h-3 text-muted-foreground" />
                <Label className="text-xs font-medium text-muted-foreground">
                  Tags
                </Label>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <Badge
                    key={tag.id}
                    variant="secondary"
                    className="text-[10px] font-medium"
                    style={{ borderColor: tag.color, borderWidth: 1 }}
                  >
                    {tag.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <Separator />

          {/* Notes */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">
              Notes
            </Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes about this customer..."
              className="min-h-[80px] text-xs rounded-xl"
            />
            <Button
              size="sm"
              className="w-full h-7 text-xs rounded-lg"
              onClick={handleSaveNotes}
              disabled={isUpdating}
            >
              <Edit3 className="w-3 h-3 mr-1" />
              Save Notes
            </Button>
          </div>
        </div>
      </ScrollArea>
    </motion.div>
  )
}
