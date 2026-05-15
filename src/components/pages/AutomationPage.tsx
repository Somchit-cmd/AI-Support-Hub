'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Zap, Plus, Trash2, Edit, MessageSquare, Clock, Tag,
  ArrowRight, Shield, AlertTriangle, Play, Pause
} from 'lucide-react'

interface AutomationRule {
  id: string
  name: string
  trigger: string
  conditions: string
  actions: string
  isActive: boolean
  createdAt: string
}

const triggerIcons: Record<string, React.ElementType> = {
  new_conversation: MessageSquare,
  keyword_match: Tag,
  sentiment_change: AlertTriangle,
  inactivity: Clock,
}

const triggerLabels: Record<string, string> = {
  new_conversation: 'New Conversation',
  keyword_match: 'Keyword Match',
  sentiment_change: 'Sentiment Change',
  inactivity: 'Inactivity',
}

export default function AutomationPage() {
  const [rules, setRules] = useState<AutomationRule[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [newRule, setNewRule] = useState({
    name: '',
    trigger: 'new_conversation',
    conditions: '{}',
    actions: '{}',
  })

  useEffect(() => {
    fetchRules()
  }, [])

  const fetchRules = async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/automation')
      if (res.ok) {
        const data = await res.json()
        setRules(data.rules || [])
      }
    } catch {
      // error
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddRule = async () => {
    if (!newRule.name.trim()) return
    try {
      const res = await fetch('/api/automation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRule),
      })
      if (res.ok) {
        setShowAddDialog(false)
        setNewRule({ name: '', trigger: 'new_conversation', conditions: '{}', actions: '{}' })
        fetchRules()
      }
    } catch {
      // error
    }
  }

  const handleToggleRule = async (id: string, isActive: boolean) => {
    try {
      await fetch(`/api/automation/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive }),
      })
      fetchRules()
    } catch {
      // error
    }
  }

  const handleDeleteRule = async (id: string) => {
    try {
      await fetch(`/api/automation/${id}`, { method: 'DELETE' })
      fetchRules()
    } catch {
      // error
    }
  }

  return (
    <div className="h-full overflow-y-auto custom-scrollbar">
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Automation Rules</h1>
            <p className="text-sm text-muted-foreground mt-1">Automate workflows and routing</p>
          </div>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button className="bg-slate-900 hover:bg-slate-800">
                <Plus className="h-4 w-4 mr-1" /> Add Rule
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Automation Rule</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Rule Name</Label>
                  <Input value={newRule.name} onChange={(e) => setNewRule({ ...newRule, name: e.target.value })} placeholder="e.g. Auto-tag VIP customers" />
                </div>
                <div className="space-y-2">
                  <Label>Trigger</Label>
                  <Select value={newRule.trigger} onValueChange={(v) => setNewRule({ ...newRule, trigger: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new_conversation">New Conversation</SelectItem>
                      <SelectItem value="keyword_match">Keyword Match</SelectItem>
                      <SelectItem value="sentiment_change">Sentiment Change</SelectItem>
                      <SelectItem value="inactivity">Inactivity</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Conditions (JSON)</Label>
                  <Textarea value={newRule.conditions} onChange={(e) => setNewRule({ ...newRule, conditions: e.target.value })} className="font-mono text-xs h-20" />
                </div>
                <div className="space-y-2">
                  <Label>Actions (JSON)</Label>
                  <Textarea value={newRule.actions} onChange={(e) => setNewRule({ ...newRule, actions: e.target.value })} className="font-mono text-xs h-20" />
                </div>
                <Button onClick={handleAddRule} className="w-full bg-slate-900 hover:bg-slate-800">Create Rule</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Preset Rules */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { name: 'Auto-tag VIP', trigger: 'keyword_match', desc: 'Tag customers as VIP when they mention "enterprise" or "upgrade"', icon: Tag },
            { name: 'Negative Sentiment Alert', trigger: 'sentiment_change', desc: 'Alert team when customer sentiment turns negative', icon: AlertTriangle },
            { name: 'Auto-close Inactive', trigger: 'inactivity', desc: 'Close conversations inactive for 24+ hours', icon: Clock },
            { name: 'Welcome Message', trigger: 'new_conversation', desc: 'Send welcome message to new website chat visitors', icon: MessageSquare },
          ].map((preset) => (
            <Card key={preset.name} className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => {
              setNewRule({ name: preset.name, trigger: preset.trigger, conditions: '{}', actions: '{}' })
              setShowAddDialog(true)
            }}>
              <CardContent className="p-4 flex items-start gap-3">
                <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <preset.icon className="h-4 w-4 text-slate-600" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">{preset.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{preset.desc}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Active Rules */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
          </div>
        ) : rules.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Zap className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p>No automation rules yet</p>
            <p className="text-xs mt-1">Create rules to automate your workflows</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rules.map((rule) => {
              const TriggerIcon = triggerIcons[rule.trigger] || Zap
              return (
                <motion.div
                  key={rule.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-4 p-4 rounded-xl border border-border hover:bg-muted/30 transition-colors"
                >
                  <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                    <TriggerIcon className="h-5 w-5 text-slate-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold">{rule.name}</h3>
                      <Badge variant="outline" className="text-[10px] h-5">
                        {triggerLabels[rule.trigger] || rule.trigger}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">Trigger: {triggerLabels[rule.trigger]}</p>
                  </div>
                  <Switch
                    checked={rule.isActive}
                    onCheckedChange={() => handleToggleRule(rule.id, rule.isActive)}
                  />
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteRule(rule.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
