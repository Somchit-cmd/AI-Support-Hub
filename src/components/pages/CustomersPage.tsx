'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import {
  Users, Search, Plus, Mail, Phone, Globe, MessageCircle,
  Star, ArrowUpDown, Download, MoreHorizontal, Tag, Edit, Trash2
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface CustomerData {
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
  tags: { id: string; name: string; color: string }[]
  _count?: { conversations: number }
}

const leadStatusColors: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700',
  contacted: 'bg-purple-100 text-purple-700',
  qualified: 'bg-emerald-100 text-emerald-700',
  proposal: 'bg-amber-100 text-amber-700',
  negotiation: 'bg-orange-100 text-orange-700',
  won: 'bg-green-100 text-green-700',
  lost: 'bg-red-100 text-red-700',
}

const sentimentColors: Record<string, string> = {
  positive: 'text-emerald-600',
  neutral: 'text-amber-600',
  negative: 'text-red-600',
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<CustomerData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [leadFilter, setLeadFilter] = useState<string>('all')
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerData | null>(null)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [newCustomer, setNewCustomer] = useState({ name: '', email: '', phone: '' })

  useEffect(() => {
    fetchCustomers()
  }, [search, leadFilter])

  const fetchCustomers = async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      const res = await fetch(`/api/customers?${params}`)
      if (res.ok) {
        const data = await res.json()
        let custs = data.customers || []
        if (leadFilter !== 'all') {
          custs = custs.filter((c: CustomerData) => c.leadStatus === leadFilter)
        }
        setCustomers(custs)
      }
    } catch {
      // error
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddCustomer = async () => {
    if (!newCustomer.name.trim()) return
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCustomer),
      })
      if (res.ok) {
        setShowAddDialog(false)
        setNewCustomer({ name: '', email: '', phone: '' })
        fetchCustomers()
      }
    } catch {
      // error
    }
  }

  const handleDeleteCustomer = async (id: string) => {
    try {
      await fetch(`/api/customers/${id}`, { method: 'DELETE' })
      fetchCustomers()
      setSelectedCustomer(null)
    } catch {
      // error
    }
  }

  const handleExportCsv = () => {
    const headers = ['Name', 'Email', 'Phone', 'Lead Status', 'Sentiment', 'Last Activity']
    const rows = customers.map(c => [c.name, c.email || '', c.phone || '', c.leadStatus, c.sentiment, c.lastActivity])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'customers.csv'
    a.click()
  }

  return (
    <div className="h-full flex">
      {/* Customer List */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="p-6 pb-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
              <p className="text-sm text-muted-foreground mt-1">{customers.length} total customers</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleExportCsv}>
                <Download className="h-4 w-4 mr-1" /> Export
              </Button>
              <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogTrigger asChild>
                  <Button size="sm" className="bg-slate-900 hover:bg-slate-800">
                    <Plus className="h-4 w-4 mr-1" /> Add Customer
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Customer</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label>Name</Label>
                      <Input value={newCustomer.name} onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })} placeholder="Customer name" />
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input value={newCustomer.email} onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })} placeholder="email@example.com" />
                    </div>
                    <div className="space-y-2">
                      <Label>Phone</Label>
                      <Input value={newCustomer.phone} onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })} placeholder="+66 xxx xxx xxxx" />
                    </div>
                    <Button onClick={handleAddCustomer} className="w-full bg-slate-900 hover:bg-slate-800">
                      Add Customer
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search customers..."
                className="pl-9 h-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={leadFilter} onValueChange={setLeadFilter}>
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue placeholder="Lead Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
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
        </div>

        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          ) : customers.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>No customers found</p>
            </div>
          ) : (
            <div className="px-6 pb-6 space-y-2">
              {customers.map((customer) => (
                <motion.div
                  key={customer.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  whileHover={{ scale: 1.005 }}
                  onClick={() => setSelectedCustomer(customer)}
                  className={cn(
                    'flex items-center gap-4 p-3 rounded-xl border cursor-pointer transition-colors',
                    selectedCustomer?.id === customer.id ? 'border-slate-900 bg-slate-50' : 'border-border hover:bg-muted/50'
                  )}
                >
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-slate-200 text-slate-700 text-sm font-semibold">
                      {customer.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{customer.name}</span>
                      {customer.facebookId && <MessageCircle className="h-3 w-3 text-slate-400" />}
                      {customer.whatsappPhone && <Phone className="h-3 w-3 text-slate-400" />}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{customer.email || customer.phone || 'No contact info'}</p>
                  </div>
                  <Badge className={cn('text-[10px] h-5', leadStatusColors[customer.leadStatus] || 'bg-slate-100 text-slate-700')}>
                    {customer.leadStatus}
                  </Badge>
                  <div className="flex items-center gap-1">
                    <div className={cn('h-2 w-2 rounded-full', customer.sentiment === 'positive' ? 'bg-emerald-500' : customer.sentiment === 'negative' ? 'bg-red-500' : 'bg-amber-500')} />
                    <span className={cn('text-xs', sentimentColors[customer.sentiment])}>{customer.sentiment}</span>
                  </div>
                  <span className="text-xs text-muted-foreground w-20 text-right">
                    {formatDistanceToNow(new Date(customer.lastActivity), { addSuffix: false })}
                  </span>
                </motion.div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Customer Detail Panel */}
      {selectedCustomer && (
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 360, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          className="border-l border-border bg-card overflow-hidden shrink-0"
        >
          <ScrollArea className="h-full">
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Customer Details</h2>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedCustomer(null)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>

              <div className="text-center">
                <Avatar className="h-20 w-20 mx-auto">
                  <AvatarFallback className="bg-slate-200 text-slate-700 text-2xl font-bold">
                    {selectedCustomer.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <h3 className="text-lg font-semibold mt-3">{selectedCustomer.name}</h3>
                <div className="flex items-center justify-center gap-2 mt-1">
                  {selectedCustomer.email && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Mail className="h-3 w-3" /> {selectedCustomer.email}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex justify-center gap-2">
                {selectedCustomer.email && (
                  <Button variant="outline" size="sm" className="h-7 text-xs">
                    <Mail className="h-3 w-3 mr-1" /> Email
                  </Button>
                )}
                {selectedCustomer.phone && (
                  <Button variant="outline" size="sm" className="h-7 text-xs">
                    <Phone className="h-3 w-3 mr-1" /> Call
                  </Button>
                )}
              </div>

              <Separator />

              <div>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Lead Status</p>
                <Badge className={cn('text-xs', leadStatusColors[selectedCustomer.leadStatus] || '')}>
                  {selectedCustomer.leadStatus}
                </Badge>
              </div>

              <div>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Contact Info</p>
                <div className="space-y-2 text-sm">
                  {selectedCustomer.email && (
                    <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /> {selectedCustomer.email}</div>
                  )}
                  {selectedCustomer.phone && (
                    <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /> {selectedCustomer.phone}</div>
                  )}
                  {selectedCustomer.facebookId && (
                    <div className="flex items-center gap-2"><MessageCircle className="h-4 w-4 text-muted-foreground" /> Facebook: {selectedCustomer.facebookId}</div>
                  )}
                  {selectedCustomer.whatsappPhone && (
                    <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /> WhatsApp: {selectedCustomer.whatsappPhone}</div>
                  )}
                </div>
              </div>

              <div>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Notes</p>
                <Textarea
                  placeholder="Add notes..."
                  className="text-sm h-20"
                  defaultValue={selectedCustomer.notes}
                />
              </div>

              <div>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Sentiment</p>
                <div className="flex items-center gap-2">
                  <div className={cn(
                    'h-3 w-3 rounded-full',
                    selectedCustomer.sentiment === 'positive' ? 'bg-emerald-500' : selectedCustomer.sentiment === 'negative' ? 'bg-red-500' : 'bg-amber-500'
                  )} />
                  <span className="text-sm capitalize">{selectedCustomer.sentiment}</span>
                </div>
              </div>

              <Button
                variant="destructive"
                size="sm"
                className="w-full"
                onClick={() => handleDeleteCustomer(selectedCustomer.id)}
              >
                <Trash2 className="h-4 w-4 mr-1" /> Delete Customer
              </Button>
            </div>
          </ScrollArea>
        </motion.div>
      )}
    </div>
  )
}
