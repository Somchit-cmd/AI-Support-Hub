'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  MessageSquare, BarChart3, Users, Clock, Zap, TrendingUp,
  Bot, UserCheck, Globe, MessageCircle, Phone
} from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'

interface DashboardData {
  totalConversations: number
  activeConversations: number
  totalMessages: number
  aiMessages: number
  humanMessages: number
  customerMessages: number
  totalCustomers: number
  aiResolutionRate: number
  avgResponseTime: number
  conversationsByChannel: { type: string; count: number }[]
  messagesByDay: { date: string; count: number }[]
  sentimentDistribution: { sentiment: string; count: number }[]
  topAgents: { name: string; assignedConversations: number }[]
}

const statCards = [
  { key: 'totalConversations', label: 'Total Conversations', icon: MessageSquare, color: 'text-slate-700', bg: 'bg-slate-100' },
  { key: 'activeConversations', label: 'Active Chats', icon: BarChart3, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  { key: 'aiResolutionRate', label: 'AI Resolution', icon: Zap, color: 'text-amber-600', bg: 'bg-amber-50', suffix: '%' },
  { key: 'avgResponseTime', label: 'Avg Response', icon: Clock, color: 'text-slate-600', bg: 'bg-slate-100', suffix: 'ms' },
  { key: 'totalCustomers', label: 'Total Customers', icon: Users, color: 'text-slate-700', bg: 'bg-slate-100' },
  { key: 'totalMessages', label: 'Total Messages', icon: TrendingUp, color: 'text-slate-700', bg: 'bg-slate-100' },
]

const COLORS = ['#1E293B', '#334155', '#64748B', '#94A3B8', '#CBD5E1']
const CHANNEL_COLORS: Record<string, string> = { website: '#1E293B', facebook: '#334155', whatsapp: '#64748B' }
const SENTIMENT_COLORS: Record<string, string> = { positive: '#10B981', neutral: '#F59E0B', negative: '#EF4444' }

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
}
const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchDashboard = async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/dashboard')
      if (res.ok) {
        const d = await res.json()
        setData(d)
      }
    } catch {
      // error
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboard()
  }, [])

  const channelData = (data?.conversationsByChannel || []).map(c => ({
    name: c.type.charAt(0).toUpperCase() + c.type.slice(1),
    value: c.count,
    color: CHANNEL_COLORS[c.type] || '#1E293B',
  }))

  const sentimentData = (data?.sentimentDistribution || []).map(s => ({
    name: s.sentiment.charAt(0).toUpperCase() + s.sentiment.slice(1),
    value: s.count,
    color: SENTIMENT_COLORS[s.sentiment] || '#94A3B8',
  }))

  const messagesByDayData = (data?.messagesByDay || []).map(d => ({
    date: d.date,
    messages: d.count,
  }))

  const aiVsHumanData = [
    { name: 'AI', count: data?.aiMessages || 0, fill: '#1E293B' },
    { name: 'Agent', count: data?.humanMessages || 0, fill: '#64748B' },
    { name: 'Customer', count: data?.customerMessages || 0, fill: '#CBD5E1' },
  ]

  return (
    <div className="h-full overflow-y-auto custom-scrollbar">
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Overview of your support operations</p>
        </div>

        {/* Stat Cards */}
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4"
        >
          {isLoading
            ? Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="border-0 shadow-sm">
                  <CardContent className="p-4">
                    <Skeleton className="h-4 w-20 mb-2" />
                    <Skeleton className="h-8 w-16" />
                  </CardContent>
                </Card>
              ))
            : statCards.map((card) => {
                const Icon = card.icon
                const value = data?.[card.key as keyof DashboardData]
                return (
                  <motion.div key={card.key} variants={item}>
                    <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] font-medium text-muted-foreground">{card.label}</span>
                          <div className={cn('h-7 w-7 rounded-lg flex items-center justify-center', card.bg)}>
                            <Icon className={cn('h-3.5 w-3.5', card.color)} />
                          </div>
                        </div>
                        <p className="text-2xl font-bold">
                          {typeof value === 'number'
                            ? card.suffix === '%'
                              ? `${Math.round(value)}%`
                              : card.suffix === 'ms'
                                ? value < 1000 ? `${value}ms` : `${(value / 1000).toFixed(1)}s`
                                : value.toLocaleString()
                            : '0'}
                        </p>
                      </CardContent>
                    </Card>
                  </motion.div>
                )
              })}
        </motion.div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Daily Conversations */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Daily Messages</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-[200px] w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={messagesByDayData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#94A3B8" />
                    <YAxis tick={{ fontSize: 11 }} stroke="#94A3B8" />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="messages"
                      stroke="#1E293B"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: '#1E293B' }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Channel Distribution */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Channel Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-[200px] w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={channelData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      dataKey="value"
                      stroke="none"
                    >
                      {channelData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend
                      formatter={(value: string) => <span className="text-xs text-muted-foreground">{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* AI vs Human Messages */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Messages by Sender</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-[200px] w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={aiVsHumanData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#94A3B8" />
                    <YAxis tick={{ fontSize: 11 }} stroke="#94A3B8" />
                    <Tooltip />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {aiVsHumanData.map((entry, index) => (
                        <Cell key={index} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Sentiment Distribution */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Customer Sentiment</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-[200px] w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={sentimentData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      dataKey="value"
                      stroke="none"
                    >
                      {sentimentData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend
                      formatter={(value: string) => <span className="text-xs text-muted-foreground">{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Top Agents */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Team Performance</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (data?.topAgents || []).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <UserCheck className="h-8 w-8 mx-auto mb-2 opacity-50" />
                No agent data yet
              </div>
            ) : (
              <div className="space-y-3">
                {(data?.topAgents || []).map((agent, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                    <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-sm font-semibold text-slate-700">
                      {agent.name.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{agent.name}</p>
                      <p className="text-xs text-muted-foreground">{agent.assignedConversations} conversations</p>
                    </div>
                    <Badge variant="secondary" className="text-xs">Active</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
