'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  Settings, Bot, Globe, MessageCircle, Phone, Palette, Clock,
  Save, Languages, Key, Sparkles, Monitor
} from 'lucide-react'

interface SettingItem {
  id: string
  key: string
  value: string
  category: string
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Form state
  const [companyName, setCompanyName] = useState('')
  const [aiMode, setAiMode] = useState('suggest')
  const [aiPersonality, setAiPersonality] = useState('professional')
  const [aiSystemPrompt, setAiSystemPrompt] = useState('')
  const [widgetColor, setWidgetColor] = useState('#0F172A')
  const [widgetWelcome, setWidgetWelcome] = useState('Hello! How can we help you today?')
  const [widgetPosition, setWidgetPosition] = useState('bottom-right')
  const [businessHoursEnabled, setBusinessHoursEnabled] = useState(false)
  const [businessHoursStart, setBusinessHoursStart] = useState('09:00')
  const [businessHoursEnd, setBusinessHoursEnd] = useState('18:00')
  const [autoCloseHours, setAutoCloseHours] = useState('24')

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/settings')
      if (res.ok) {
        const data = await res.json()
        const settingsList = data.settings || []
        setSettings(settingsList)
        // Apply to form
        const get = (key: string) => settingsList.find((s: SettingItem) => s.key === key)?.value || ''
        setCompanyName(get('company_name') || 'AI Support Hub')
        setAiMode(get('ai_mode') || 'suggest')
        setAiPersonality(get('ai_personality') || 'professional')
        setAiSystemPrompt(get('ai_system_prompt') || '')
        setWidgetColor(get('widget_primary_color') || '#0F172A')
        setWidgetWelcome(get('widget_welcome_message') || 'Hello! How can we help you today?')
        setWidgetPosition(get('widget_position') || 'bottom-right')
        setBusinessHoursEnabled(get('business_hours_enabled') === 'true')
        setBusinessHoursStart(get('business_hours_start') || '09:00')
        setBusinessHoursEnd(get('business_hours_end') || '18:00')
        setAutoCloseHours(get('auto_close_inactive_hours') || '24')
      }
    } catch {
      // error
    } finally {
      setIsLoading(false)
    }
  }

  const saveSettings = async (updates: { key: string; value: string }[]) => {
    setSaving(true)
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: updates }),
      })
    } catch {
      // error
    } finally {
      setSaving(false)
    }
  }

  const handleSaveAll = async () => {
    await saveSettings([
      { key: 'company_name', value: companyName },
      { key: 'ai_mode', value: aiMode },
      { key: 'ai_personality', value: aiPersonality },
      { key: 'ai_system_prompt', value: aiSystemPrompt },
      { key: 'widget_primary_color', value: widgetColor },
      { key: 'widget_welcome_message', value: widgetWelcome },
      { key: 'widget_position', value: widgetPosition },
      { key: 'business_hours_enabled', value: String(businessHoursEnabled) },
      { key: 'business_hours_start', value: businessHoursStart },
      { key: 'business_hours_end', value: businessHoursEnd },
      { key: 'auto_close_inactive_hours', value: autoCloseHours },
    ])
  }

  if (isLoading) {
    return (
      <div className="h-full overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          <Skeleton className="h-10 w-48" />
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-48 w-full rounded-xl" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto custom-scrollbar">
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
            <p className="text-sm text-muted-foreground mt-1">Configure your support platform</p>
          </div>
          <Button onClick={handleSaveAll} disabled={saving} className="bg-slate-900 hover:bg-slate-800">
            <Save className="h-4 w-4 mr-1" /> {saving ? 'Saving...' : 'Save All'}
          </Button>
        </div>

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="general" className="gap-1.5"><Globe className="h-4 w-4" /> General</TabsTrigger>
            <TabsTrigger value="ai" className="gap-1.5"><Bot className="h-4 w-4" /> AI</TabsTrigger>
            <TabsTrigger value="channels" className="gap-1.5"><MessageCircle className="h-4 w-4" /> Channels</TabsTrigger>
            <TabsTrigger value="widget" className="gap-1.5"><Palette className="h-4 w-4" /> Widget</TabsTrigger>
          </TabsList>

          {/* General Settings */}
          <TabsContent value="general" className="space-y-4 mt-4">
            <Card className="border-0 shadow-sm">
              <CardHeader><CardTitle className="text-sm">Company Branding</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Company Name</Label>
                  <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardHeader><CardTitle className="text-sm">Business Hours</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Enable Business Hours</Label>
                  <Switch checked={businessHoursEnabled} onCheckedChange={setBusinessHoursEnabled} />
                </div>
                {businessHoursEnabled && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Start Time</Label>
                      <Input type="time" value={businessHoursStart} onChange={(e) => setBusinessHoursStart(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>End Time</Label>
                      <Input type="time" value={businessHoursEnd} onChange={(e) => setBusinessHoursEnd(e.target.value)} />
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Auto-close Inactive Chats (hours)</Label>
                  <Input type="number" value={autoCloseHours} onChange={(e) => setAutoCloseHours(e.target.value)} />
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardHeader><CardTitle className="text-sm">Supported Languages</CardTitle></CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Badge variant="secondary">🇬🇧 English</Badge>
                  <Badge variant="secondary">🇹🇭 ไทย</Badge>
                  <Badge variant="secondary">🇱🇦 ລາວ</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-2">AI auto-detects and responds in the customer&apos;s language</p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* AI Settings */}
          <TabsContent value="ai" className="space-y-4 mt-4">
            <Card className="border-0 shadow-sm">
              <CardHeader><CardTitle className="text-sm">AI Configuration</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Default AI Mode</Label>
                  <Select value={aiMode} onValueChange={setAiMode}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">🤖 Auto - AI replies automatically</SelectItem>
                      <SelectItem value="suggest">💡 Suggest - AI drafts, agent approves</SelectItem>
                      <SelectItem value="human">👤 Human - No AI responses</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>AI Personality</Label>
                  <Select value={aiPersonality} onValueChange={setAiPersonality}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="friendly">Friendly</SelectItem>
                      <SelectItem value="casual">Casual</SelectItem>
                      <SelectItem value="formal">Formal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Custom System Prompt</Label>
                  <Textarea
                    value={aiSystemPrompt}
                    onChange={(e) => setAiSystemPrompt(e.target.value)}
                    placeholder="Override the default AI system prompt with custom instructions..."
                    className="min-h-[120px]"
                  />
                  <p className="text-xs text-muted-foreground">Leave empty to use the default prompt</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Channel Settings */}
          <TabsContent value="channels" className="space-y-4 mt-4">
            <Card className="border-0 shadow-sm">
              <CardHeader><CardTitle className="text-sm">Channel Connections</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {/* Facebook */}
                <div className="flex items-center gap-4 p-3 rounded-lg border border-border">
                  <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center">
                    <MessageCircle className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-medium">Facebook Messenger</h3>
                    <p className="text-xs text-muted-foreground">Connect your Facebook Page</p>
                  </div>
                  <Badge variant="outline" className="text-xs">Not Connected</Badge>
                  <Button size="sm" variant="outline">Connect</Button>
                </div>

                {/* WhatsApp */}
                <div className="flex items-center gap-4 p-3 rounded-lg border border-border">
                  <div className="h-10 w-10 rounded-lg bg-green-50 flex items-center justify-center">
                    <Phone className="h-5 w-5 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-medium">WhatsApp Business</h3>
                    <p className="text-xs text-muted-foreground">Connect WhatsApp Cloud API</p>
                  </div>
                  <Badge variant="outline" className="text-xs">Not Connected</Badge>
                  <Button size="sm" variant="outline">Connect</Button>
                </div>

                {/* Website */}
                <div className="flex items-center gap-4 p-3 rounded-lg border border-border">
                  <div className="h-10 w-10 rounded-lg bg-slate-50 flex items-center justify-center">
                    <Globe className="h-5 w-5 text-slate-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-medium">Website Live Chat</h3>
                    <p className="text-xs text-muted-foreground">Embed chat widget on your website</p>
                  </div>
                  <Badge className="text-xs bg-emerald-100 text-emerald-700">Active</Badge>
                </div>
              </CardContent>
            </Card>

            {/* Embed Code */}
            <Card className="border-0 shadow-sm">
              <CardHeader><CardTitle className="text-sm">Website Widget Embed Code</CardTitle></CardHeader>
              <CardContent>
                <div className="bg-slate-900 text-slate-100 rounded-lg p-4 font-mono text-xs overflow-x-auto">
                  <pre>{`<script>
  window.AI_SUPPORT_HUB = {
    widgetId: 'your-widget-id',
    position: '${widgetPosition}',
    primaryColor: '${widgetColor}',
    welcome: '${widgetWelcome}'
  };
</script>
<script src="/widget.js" async></script>`}</pre>
                </div>
                <p className="text-xs text-muted-foreground mt-2">Add this code before the closing &lt;/body&gt; tag on your website</p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Widget Settings */}
          <TabsContent value="widget" className="space-y-4 mt-4">
            <Card className="border-0 shadow-sm">
              <CardHeader><CardTitle className="text-sm">Widget Customization</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Primary Color</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={widgetColor}
                      onChange={(e) => setWidgetColor(e.target.value)}
                      className="h-9 w-12 rounded border border-border cursor-pointer"
                    />
                    <Input value={widgetColor} onChange={(e) => setWidgetColor(e.target.value)} className="flex-1" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Welcome Message</Label>
                  <Textarea
                    value={widgetWelcome}
                    onChange={(e) => setWidgetWelcome(e.target.value)}
                    placeholder="Hello! How can we help you today?"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Widget Position</Label>
                  <Select value={widgetPosition} onValueChange={setWidgetPosition}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bottom-right">Bottom Right</SelectItem>
                      <SelectItem value="bottom-left">Bottom Left</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Widget Preview */}
            <Card className="border-0 shadow-sm">
              <CardHeader><CardTitle className="text-sm">Widget Preview</CardTitle></CardHeader>
              <CardContent>
                <div className="bg-slate-50 rounded-lg p-6 flex items-end justify-end min-h-[200px]">
                  <div className="text-right">
                    <div
                      className="rounded-t-2xl rounded-bl-sm p-4 text-white text-sm max-w-[240px] shadow-lg"
                      style={{ backgroundColor: widgetColor }}
                    >
                      {widgetWelcome}
                    </div>
                    <div
                      className="h-12 w-12 rounded-full flex items-center justify-center mt-3 ml-auto shadow-lg cursor-pointer"
                      style={{ backgroundColor: widgetColor }}
                    >
                      <MessageCircle className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
