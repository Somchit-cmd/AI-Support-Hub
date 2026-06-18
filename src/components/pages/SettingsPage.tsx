'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
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
import { Slider } from '@/components/ui/slider'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Bot, Globe, MessageCircle, Phone, Palette, Clock,
  Save, Sparkles, CheckCircle2, XCircle, ExternalLink,
  Copy, Check, ChevronDown, ChevronRight, AlertCircle, Shield, Key,
  Send, Loader2, BookOpen, FileText, RotateCcw, Database, Thermometer, Zap,
  Settings, Eye, EyeOff, Plug, Cpu, Brain, TrendingUp, DollarSign, Activity,
  BarChart3, AlertTriangle
} from 'lucide-react'

interface SettingItem {
  id: string
  key: string
  value: string
  category: string
}

interface ChannelData {
  id: string
  type: string
  name: string
  config: string
  isActive: boolean
}

// ===================== FACEBOOK CONNECT DIALOG =====================

function FacebookConnectDialog({
  open,
  onClose,
  channel,
  onConnected,
}: {
  open: boolean
  onClose: () => void
  channel: ChannelData | null
  onConnected: () => void
}) {
  const [step, setStep] = useState(1)
  const [isConnecting, setIsConnecting] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)
  const [formData, setFormData] = useState({
    pageId: '',
    pageName: '',
    pageAccessToken: '',
    appId: '',
    appSecret: '',
    verifyToken: 'ai_support_hub_verify_token',
  })

  // Load existing config
  useEffect(() => {
    if (channel && open) {
      try {
        const config = JSON.parse(channel.config)
        setFormData({
          pageId: config.pageId || '',
          pageName: config.pageName || '',
          pageAccessToken: config.pageAccessToken || '',
          appId: config.appId || '',
          appSecret: config.appSecret || '',
          verifyToken: config.verifyToken || 'ai_support_hub_verify_token',
        })
      } catch { /* ignore */ }
    }
  }, [channel, open])

  const handleConnect = async () => {
    setIsConnecting(true)
    setResult(null)
    try {
      const res = await fetch('/api/channels/facebook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      const data = await res.json()
      setResult({
        success: data.isValid,
        message: data.message,
      })
      if (data.isValid) {
        onConnected()
      }
    } catch {
      setResult({ success: false, message: 'Connection failed. Please check your network.' })
    } finally {
      setIsConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    try {
      await fetch('/api/channels/facebook', { method: 'DELETE' })
      onConnected()
      onClose()
    } catch { /* ignore */ }
  }

  const isConnected = channel?.isActive && (() => {
    try { return JSON.parse(channel.config).isConnected } catch { return false }
  })()

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <MessageCircle className="h-4 w-4 text-blue-600" />
            </div>
            Connect Facebook Messenger
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          {/* Connection Status */}
          {isConnected && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span className="text-sm text-emerald-700">Facebook Page is connected and active</span>
            </div>
          )}

          {/* Steps */}
          <div className="space-y-3">
            <button
              className="w-full text-left"
              onClick={() => setStep(step === 1 ? 0 : 1)}
            >
              <div className="flex items-center gap-2 p-2">
                <Badge className={step >= 1 ? 'bg-slate-900' : 'bg-slate-300'}>1</Badge>
                <span className="text-sm font-medium">Create a Facebook App</span>
                {step === 1 ? <ChevronDown className="h-4 w-4 ml-auto" /> : <ChevronRight className="h-4 w-4 ml-auto" />}
              </div>
            </button>
            <AnimatePresence>
              {step >= 1 && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="bg-slate-50 rounded-lg p-4 text-sm space-y-2 ml-6">
                    <p className="font-medium">Follow these steps in the Meta Developer Portal:</p>
                    <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground">
                      <li>Go to <a href="https://developers.facebook.com/apps/" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline inline-flex items-center gap-0.5">developers.facebook.com/apps <ExternalLink className="h-3 w-3" /></a></li>
                      <li>Click <strong>&quot;Create App&quot;</strong> → Select <strong>&quot;Business&quot;</strong> type</li>
                      <li>Give your app a name (e.g., &quot;AI Support Hub&quot;)</li>
                      <li>In your app dashboard, click <strong>&quot;Add Product&quot;</strong></li>
                      <li>Find <strong>&quot;Messenger&quot;</strong> and click <strong>&quot;Set Up&quot;</strong></li>
                      <li>Scroll to <strong>&quot;Access Tokens&quot;</strong> section</li>
                      <li>Click <strong>&quot;Add or Remove Pages&quot;</strong> and select your Facebook Page</li>
                      <li>Copy the <strong>Page Access Token</strong> generated</li>
                    </ol>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              className="w-full text-left"
              onClick={() => setStep(step === 2 ? 0 : 2)}
            >
              <div className="flex items-center gap-2 p-2">
                <Badge className={step >= 2 ? 'bg-slate-900' : 'bg-slate-300'}>2</Badge>
                <span className="text-sm font-medium">Configure Webhook</span>
                {step === 2 ? <ChevronDown className="h-4 w-4 ml-auto" /> : <ChevronRight className="h-4 w-4 ml-auto" />}
              </div>
            </button>
            <AnimatePresence>
              {step >= 2 && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="bg-slate-50 rounded-lg p-4 text-sm space-y-2 ml-6">
                    <p className="font-medium">Set up the webhook in your Facebook App:</p>
                    <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground">
                      <li>In Messenger settings, scroll to <strong>&quot;Webhooks&quot;</strong></li>
                      <li>Click <strong>&quot;Subscribe&quot;</strong> to your Page</li>
                      <li>Click <strong>&quot;Add Callback URL&quot;</strong></li>
                      <li>Enter your webhook URL:<br />
                        <code className="bg-white px-2 py-1 rounded text-xs block mt-1 font-mono">
                          https://yourdomain.com/api/webhooks/facebook
                        </code>
                      </li>
                      <li>Enter the Verify Token:<br />
                        <code className="bg-white px-2 py-1 rounded text-xs block mt-1 font-mono">
                          ai_support_hub_verify_token
                        </code>
                      </li>
                      <li>Subscribe to these events: <strong>messages, messaging_postbacks, message_deliveries, message_reads</strong></li>
                    </ol>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              className="w-full text-left"
              onClick={() => setStep(step === 3 ? 0 : 3)}
            >
              <div className="flex items-center gap-2 p-2">
                <Badge className={step >= 3 ? 'bg-slate-900' : 'bg-slate-300'}>3</Badge>
                <span className="text-sm font-medium">Enter Credentials</span>
                {step === 3 ? <ChevronDown className="h-4 w-4 ml-auto" /> : <ChevronRight className="h-4 w-4 ml-auto" />}
              </div>
            </button>
            <AnimatePresence>
              {step >= 3 && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="space-y-3 ml-6 pt-2">
                    <div className="space-y-2">
                      <Label>Facebook Page ID</Label>
                      <Input
                        value={formData.pageId}
                        onChange={(e) => setFormData({ ...formData, pageId: e.target.value })}
                        placeholder="e.g., 123456789012345"
                      />
                      <p className="text-xs text-muted-foreground">Found in your Page Settings → About → Page ID</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Page Name</Label>
                      <Input
                        value={formData.pageName}
                        onChange={(e) => setFormData({ ...formData, pageName: e.target.value })}
                        placeholder="e.g., My Company Page"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Page Access Token</Label>
                      <Input
                        type="password"
                        value={formData.pageAccessToken}
                        onChange={(e) => setFormData({ ...formData, pageAccessToken: e.target.value })}
                        placeholder="EAAxxxxxxxxxxxxx"
                      />
                      <p className="text-xs text-muted-foreground">Generated in Messenger settings → Access Tokens</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>App ID <span className="text-muted-foreground">(optional)</span></Label>
                        <Input
                          value={formData.appId}
                          onChange={(e) => setFormData({ ...formData, appId: e.target.value })}
                          placeholder="123456789"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>App Secret <span className="text-muted-foreground">(required for webhook security)</span></Label>
                        <Input
                          type="password"
                          value={formData.appSecret}
                          onChange={(e) => setFormData({ ...formData, appSecret: e.target.value })}
                          placeholder="abc123..."
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Webhook Verify Token</Label>
                      <Input
                        value={formData.verifyToken}
                        onChange={(e) => setFormData({ ...formData, verifyToken: e.target.value })}
                        placeholder="ai_support_hub_verify_token"
                      />
                      <p className="text-xs text-muted-foreground">Must match the verify token in your Facebook webhook config</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Result Message */}
          {result && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                'flex items-center gap-2 p-3 rounded-lg',
                result.success ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'
              )}
            >
              {result.success ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-red-600" />}
              <span className={cn('text-sm', result.success ? 'text-emerald-700' : 'text-red-700')}>{result.message}</span>
            </motion.div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <Button
              onClick={handleConnect}
              disabled={isConnecting || !formData.pageId || !formData.pageAccessToken}
              className="flex-1 bg-slate-900 hover:bg-slate-800"
            >
              {isConnecting ? 'Connecting...' : isConnected ? 'Update Connection' : 'Connect Facebook Page'}
            </Button>
            {isConnected && (
              <Button variant="outline" onClick={handleDisconnect} className="text-destructive">
                Disconnect
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ===================== WHATSAPP CONNECT DIALOG =====================

function WhatsAppConnectDialog({
  open,
  onClose,
  channel,
  onConnected,
}: {
  open: boolean
  onClose: () => void
  channel: ChannelData | null
  onConnected: () => void
}) {
  const [step, setStep] = useState(1)
  const [isConnecting, setIsConnecting] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)
  const [formData, setFormData] = useState({
    phoneNumberId: '',
    businessAccountId: '',
    whatsappAccessToken: '',
    whatsappPhoneNumber: '',
    businessName: '',
    verifyToken: 'ai_support_hub_verify_token',
    appSecret: '',
  })

  useEffect(() => {
    if (channel && open) {
      try {
        const config = JSON.parse(channel.config)
        setFormData({
          phoneNumberId: config.phoneNumberId || '',
          businessAccountId: config.businessAccountId || config.wabaId || '',
          whatsappAccessToken: config.whatsappAccessToken || '',
          whatsappPhoneNumber: config.whatsappPhoneNumber || '',
          businessName: config.businessName || '',
          verifyToken: config.verifyToken || 'ai_support_hub_verify_token',
          appSecret: config.appSecret || '',
        })
      } catch { /* ignore */ }
    }
  }, [channel, open])

  const handleConnect = async () => {
    setIsConnecting(true)
    setResult(null)
    try {
      const res = await fetch('/api/channels/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      const data = await res.json()
      setResult({
        success: data.isValid,
        message: data.message,
      })
      if (data.isValid) {
        onConnected()
      }
    } catch {
      setResult({ success: false, message: 'Connection failed. Please check your network.' })
    } finally {
      setIsConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    try {
      await fetch('/api/channels/whatsapp', { method: 'DELETE' })
      onConnected()
      onClose()
    } catch { /* ignore */ }
  }

  const isConnected = channel?.isActive && (() => {
    try { return JSON.parse(channel.config).isConnected } catch { return false }
  })()

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-green-50 flex items-center justify-center">
              <Phone className="h-4 w-4 text-green-600" />
            </div>
            Connect WhatsApp Business
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          {isConnected && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span className="text-sm text-emerald-700">WhatsApp Business is connected and active</span>
            </div>
          )}

          <div className="space-y-3">
            <button className="w-full text-left" onClick={() => setStep(step === 1 ? 0 : 1)}>
              <div className="flex items-center gap-2 p-2">
                <Badge className={step >= 1 ? 'bg-slate-900' : 'bg-slate-300'}>1</Badge>
                <span className="text-sm font-medium">Set Up WhatsApp Business API</span>
                {step === 1 ? <ChevronDown className="h-4 w-4 ml-auto" /> : <ChevronRight className="h-4 w-4 ml-auto" />}
              </div>
            </button>
            <AnimatePresence>
              {step >= 1 && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="bg-slate-50 rounded-lg p-4 text-sm space-y-2 ml-6">
                    <p className="font-medium">Set up WhatsApp Business API in Meta Business Suite:</p>
                    <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground">
                      <li>Go to <a href="https://business.facebook.com/wa/manage/phone-numbers/" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline inline-flex items-center gap-0.5">Meta Business Suite → WhatsApp <ExternalLink className="h-3 w-3" /></a></li>
                      <li>Create a <strong>WhatsApp Business Account (WABA)</strong></li>
                      <li>Create a <strong>Phone Number</strong> for your business</li>
                      <li>Verify your business (Meta review process, takes 1-2 days)</li>
                      <li>Go to <strong>App Dashboard → WhatsApp → API Setup</strong></li>
                      <li>Copy the <strong>Phone Number ID</strong></li>
                      <li>Copy the <strong>Permanent Access Token</strong></li>
                    </ol>
                    <div className="flex items-start gap-2 mt-2 p-2 bg-amber-50 rounded border border-amber-200">
                      <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-700">You need a Meta Business Account and a verified WhatsApp Business profile. New accounts get free 1,000 conversations/month for testing.</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <button className="w-full text-left" onClick={() => setStep(step === 2 ? 0 : 2)}>
              <div className="flex items-center gap-2 p-2">
                <Badge className={step >= 2 ? 'bg-slate-900' : 'bg-slate-300'}>2</Badge>
                <span className="text-sm font-medium">Configure Webhook</span>
                {step === 2 ? <ChevronDown className="h-4 w-4 ml-auto" /> : <ChevronRight className="h-4 w-4 ml-auto" />}
              </div>
            </button>
            <AnimatePresence>
              {step >= 2 && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="bg-slate-50 rounded-lg p-4 text-sm space-y-2 ml-6">
                    <p className="font-medium">Set up the webhook in WhatsApp settings:</p>
                    <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground">
                      <li>Go to <strong>App Dashboard → WhatsApp → Configuration</strong></li>
                      <li>Click <strong>&quot;Edit&quot;</strong> next to Webhook</li>
                      <li>Enter your Callback URL:<br />
                        <code className="bg-white px-2 py-1 rounded text-xs block mt-1 font-mono">
                          https://yourdomain.com/api/webhooks/whatsapp
                        </code>
                      </li>
                      <li>Enter the Verify Token:<br />
                        <code className="bg-white px-2 py-1 rounded text-xs block mt-1 font-mono">
                          ai_support_hub_verify_token
                        </code>
                      </li>
                      <li>Subscribe to webhook fields: <strong>messages</strong></li>
                      <li>Click <strong>&quot;Verify and Save&quot;</strong></li>
                    </ol>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <button className="w-full text-left" onClick={() => setStep(step === 3 ? 0 : 3)}>
              <div className="flex items-center gap-2 p-2">
                <Badge className={step >= 3 ? 'bg-slate-900' : 'bg-slate-300'}>3</Badge>
                <span className="text-sm font-medium">Enter Credentials</span>
                {step === 3 ? <ChevronDown className="h-4 w-4 ml-auto" /> : <ChevronRight className="h-4 w-4 ml-auto" />}
              </div>
            </button>
            <AnimatePresence>
              {step >= 3 && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="space-y-3 ml-6 pt-2">
                    <div className="space-y-2">
                      <Label>Phone Number ID</Label>
                      <Input
                        value={formData.phoneNumberId}
                        onChange={(e) => setFormData({ ...formData, phoneNumberId: e.target.value })}
                        placeholder="e.g., 123456789012345"
                      />
                      <p className="text-xs text-muted-foreground">Found in WhatsApp → API Setup</p>
                    </div>
                    <div className="space-y-2">
                      <Label>WhatsApp Business Account ID <span className="text-muted-foreground">(optional)</span></Label>
                      <Input
                        value={formData.businessAccountId}
                        onChange={(e) => setFormData({ ...formData, businessAccountId: e.target.value })}
                        placeholder="e.g., 987654321"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Access Token</Label>
                      <Input
                        type="password"
                        value={formData.whatsappAccessToken}
                        onChange={(e) => setFormData({ ...formData, whatsappAccessToken: e.target.value })}
                        placeholder="EAAxxxxxxxxxxxxx"
                      />
                      <p className="text-xs text-muted-foreground">Use a Permanent Access Token (not temporary)</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Phone Number</Label>
                        <Input
                          value={formData.whatsappPhoneNumber}
                          onChange={(e) => setFormData({ ...formData, whatsappPhoneNumber: e.target.value })}
                          placeholder="+66 xxx xxx xxxx"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Business Name</Label>
                        <Input
                          value={formData.businessName}
                          onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                          placeholder="My Company"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Webhook Verify Token</Label>
                      <Input
                        value={formData.verifyToken}
                        onChange={(e) => setFormData({ ...formData, verifyToken: e.target.value })}
                        placeholder="ai_support_hub_verify_token"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>App Secret <span className="text-muted-foreground">(required for webhook security)</span></Label>
                      <Input
                        type="password"
                        value={formData.appSecret}
                        onChange={(e) => setFormData({ ...formData, appSecret: e.target.value })}
                        placeholder="abc123..."
                      />
                      <p className="text-xs text-muted-foreground">Found in your Meta App → Settings → App Secret</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {result && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                'flex items-center gap-2 p-3 rounded-lg',
                result.success ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'
              )}
            >
              {result.success ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-red-600" />}
              <span className={cn('text-sm', result.success ? 'text-emerald-700' : 'text-red-700')}>{result.message}</span>
            </motion.div>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              onClick={handleConnect}
              disabled={isConnecting || !formData.phoneNumberId || !formData.whatsappAccessToken}
              className="flex-1 bg-slate-900 hover:bg-slate-800"
            >
              {isConnecting ? 'Connecting...' : isConnected ? 'Update Connection' : 'Connect WhatsApp'}
            </Button>
            {isConnected && (
              <Button variant="outline" onClick={handleDisconnect} className="text-destructive">
                Disconnect
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ===================== MAIN SETTINGS PAGE =====================

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [channels, setChannels] = useState<ChannelData[]>([])
  const [showFbDialog, setShowFbDialog] = useState(false)
  const [showWaDialog, setShowWaDialog] = useState(false)
  const [webhookUrlCopied, setWebhookUrlCopied] = useState(false)

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

  // AI & RAG form state
  const [aiTemperature, setAiTemperature] = useState(0.7)
  const [aiMaxTokens, setAiMaxTokens] = useState(2048)
  const [ragEnabled, setRagEnabled] = useState(true)
  const [ragMaxDocuments, setRagMaxDocuments] = useState(5)
  const [ragMaxFaqs, setRagMaxFaqs] = useState(10)
  const [aiStats, setAiStats] = useState<{
    documents: { active: number; inactive: number; total: number }
    faqs: { active: number; inactive: number; total: number }
    totalKnowledgeChars: number
    model: string
    provider?: string
    providerName?: string
    usage?: {
      today: {
        totalTokens: number
        promptTokens: number
        completionTokens: number
        totalRequests: number
        estimatedCost: number
        avgResponseTime: number
        byProvider: { provider: string; totalRequests: number; totalTokens: number; estimatedCost: number }[]
        daily: { date: string; totalRequests: number; totalTokens: number; estimatedCost: number }[]
      }
      week: {
        totalTokens: number
        promptTokens: number
        completionTokens: number
        totalRequests: number
        estimatedCost: number
        avgResponseTime: number
        byProvider: { provider: string; totalRequests: number; totalTokens: number; estimatedCost: number }[]
        daily: { date: string; totalRequests: number; totalTokens: number; estimatedCost: number }[]
      }
      month: {
        totalTokens: number
        promptTokens: number
        completionTokens: number
        totalRequests: number
        estimatedCost: number
        avgResponseTime: number
        byProvider: { provider: string; totalRequests: number; totalTokens: number; estimatedCost: number }[]
        daily: { date: string; totalRequests: number; totalTokens: number; estimatedCost: number }[]
      }
    }
    budget?: {
      monthlyBudget: number
      monthlyUsage: number
      remainingBudget: number
      percentageUsed: number
      warningLevel: 'green' | 'yellow' | 'red'
    }
    recentLogs?: {
      id: string
      model: string
      provider: string
      tokens: number
      estimatedCost: number
      responseTime: number
      createdAt: string
    }[]
  } | null>(null)

  // Monthly budget setting
  const [aiMonthlyBudget, setAiMonthlyBudget] = useState('0')

  // AI Provider form state
  const [aiProvider, setAiProvider] = useState<string>('z-ai')
  const [aiProviderApiKey, setAiProviderApiKey] = useState('')
  const [aiProviderModel, setAiProviderModel] = useState('default')
  const [aiProviderBaseUrl, setAiProviderBaseUrl] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [isTestingProvider, setIsTestingProvider] = useState(false)
  const [providerTestResult, setProviderTestResult] = useState<{ success: boolean; message: string; model?: string; responseTime?: number } | null>(null)

  // Available providers config
  const PROVIDERS = [
    {
      id: 'z-ai', name: 'Z-AI (Default)', icon: Sparkles, color: 'slate',
      description: 'Built-in AI. No API key needed.',
      models: [{ id: 'default', name: 'Z-AI Default' }],
      requiresApiKey: false, requiresBaseUrl: false,
    },
    {
      id: 'openai', name: 'OpenAI (ChatGPT)', icon: Bot, color: 'emerald',
      description: 'GPT-4o, GPT-4, GPT-3.5 and more.',
      models: [
        { id: 'gpt-4o', name: 'GPT-4o (Recommended)' },
        { id: 'gpt-4o-mini', name: 'GPT-4o Mini (Faster/Cheaper)' },
        { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
        { id: 'gpt-4', name: 'GPT-4' },
        { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo (Budget)' },
      ],
      requiresApiKey: true, requiresBaseUrl: false,
      apiKeyLabel: 'OpenAI API Key', apiKeyPlaceholder: 'sk-xxxxxxxxxxxxxxxx',
      docsUrl: 'https://platform.openai.com/api-keys',
    },
    {
      id: 'google', name: 'Google Gemini', icon: Globe, color: 'blue',
      description: 'Gemini 1.5/2.0 Flash and Pro models.',
      models: [
        { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash (Fast)' },
        { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro (Advanced)' },
        { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
        { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite' },
      ],
      requiresApiKey: true, requiresBaseUrl: false,
      apiKeyLabel: 'Google AI API Key', apiKeyPlaceholder: 'AIzaSyxxxxxxxxxxxxxxx',
      docsUrl: 'https://aistudio.google.com/apikey',
    },
    {
      id: 'anthropic', name: 'Anthropic (Claude)', icon: Brain, color: 'violet',
      description: 'Claude 3.5 Sonnet, Haiku, and Opus models.',
      models: [
        { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet (Recommended)' },
        { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku (Fast)' },
        { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus (Advanced)' },
      ],
      requiresApiKey: true, requiresBaseUrl: false,
      apiKeyLabel: 'Anthropic API Key', apiKeyPlaceholder: 'sk-ant-xxxxxxxxxxxxxxxx',
      docsUrl: 'https://console.anthropic.com/settings/keys',
    },
    {
      id: 'custom', name: 'Custom Provider', icon: Settings, color: 'orange',
      description: 'Any OpenAI-compatible API (Ollama, LM Studio, Groq, Together, etc.)',
      models: [{ id: 'default', name: 'Default Model' }],
      requiresApiKey: true, requiresBaseUrl: true,
      apiKeyLabel: 'API Key', apiKeyPlaceholder: 'your-api-key',
      docsUrl: '',
    },
  ] as const

  const currentProvider = PROVIDERS.find(p => p.id === aiProvider)

  // AI Test state
  const [testMessage, setTestMessage] = useState('')
  const [testResponse, setTestResponse] = useState('')
  const [testKnowledgeContext, setTestKnowledgeContext] = useState('')
  const [testTokens, setTestTokens] = useState(0)
  const [testResponseTime, setTestResponseTime] = useState(0)
  const [isTestLoading, setIsTestLoading] = useState(false)
  const [showKnowledgeContext, setShowKnowledgeContext] = useState(false)

  useEffect(() => {
    fetchSettings()
    fetchChannels()
    fetchAIStats()
  }, [])

  const fetchSettings = async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/settings')
      if (res.ok) {
        const data = await res.json()
        const settingsList = data.settings || []
        setSettings(settingsList)
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
        setAiTemperature(Number(get('ai_temperature')) || 0.7)
        setAiMaxTokens(Number(get('ai_max_tokens')) || 2048)
        setRagEnabled(get('rag_enabled') !== 'false')
        setRagMaxDocuments(Number(get('rag_max_documents')) || 5)
        setRagMaxFaqs(Number(get('rag_max_faqs')) || 10)
        setAiProvider(get('ai_provider') || 'z-ai')
        setAiProviderApiKey(get('ai_provider_api_key'))
        setAiProviderModel(get('ai_provider_model') || 'default')
        setAiProviderBaseUrl(get('ai_provider_base_url'))
        setAiMonthlyBudget(get('ai_monthly_budget') || '0')
      }
    } catch { /* error */ } finally {
      setIsLoading(false)
    }
  }

  const fetchChannels = async () => {
    try {
      const res = await fetch('/api/channels')
      if (res.ok) {
        const data = await res.json()
        setChannels(data.channels || [])
      }
    } catch { /* error */ }
  }

  const fetchAIStats = async () => {
    try {
      const res = await fetch('/api/ai/stats')
      if (res.ok) {
        const data = await res.json()
        setAiStats(data)
      }
    } catch { /* error */ }
  }

  const saveSettings = async (updates: { key: string; value: string }[]) => {
    setSaving(true)
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: updates }),
      })
    } catch { /* error */ } finally {
      setSaving(false)
    }
  }

  const handleSaveAll = async () => {
    await saveSettings([
      { key: 'company_name', value: companyName },
      { key: 'ai_mode', value: aiMode },
      { key: 'ai_personality', value: aiPersonality },
      { key: 'ai_system_prompt', value: aiSystemPrompt },
      { key: 'ai_temperature', value: String(aiTemperature) },
      { key: 'ai_max_tokens', value: String(aiMaxTokens) },
      { key: 'rag_enabled', value: String(ragEnabled) },
      { key: 'rag_max_documents', value: String(ragMaxDocuments) },
      { key: 'rag_max_faqs', value: String(ragMaxFaqs) },
      { key: 'ai_provider', value: aiProvider },
      { key: 'ai_provider_api_key', value: aiProviderApiKey },
      { key: 'ai_provider_model', value: aiProviderModel },
      { key: 'ai_provider_base_url', value: aiProviderBaseUrl },
      { key: 'ai_monthly_budget', value: aiMonthlyBudget },
      { key: 'widget_primary_color', value: widgetColor },
      { key: 'widget_welcome_message', value: widgetWelcome },
      { key: 'widget_position', value: widgetPosition },
      { key: 'business_hours_enabled', value: String(businessHoursEnabled) },
      { key: 'business_hours_start', value: businessHoursStart },
      { key: 'business_hours_end', value: businessHoursEnd },
      { key: 'auto_close_inactive_hours', value: autoCloseHours },
    ])
  }

  const handleTestAI = async () => {
    if (!testMessage.trim()) return
    setIsTestLoading(true)
    setTestResponse('')
    setTestKnowledgeContext('')
    setTestTokens(0)
    setTestResponseTime(0)
    try {
      const res = await fetch('/api/ai/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: testMessage }),
      })
      if (res.ok) {
        const data = await res.json()
        setTestResponse(data.response)
        setTestKnowledgeContext(data.knowledgeContext)
        setTestTokens(data.tokens)
        setTestResponseTime(data.responseTime)
      } else {
        setTestResponse('Error: Failed to get AI response. Please try again.')
      }
    } catch {
      setTestResponse('Error: Network error. Please try again.')
    } finally {
      setIsTestLoading(false)
    }
  }

  const handleTestProvider = async () => {
    setIsTestingProvider(true)
    setProviderTestResult(null)
    try {
      const res = await fetch('/api/ai/test-provider', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: aiProvider,
          apiKey: aiProviderApiKey,
          model: aiProviderModel,
          baseUrl: aiProviderBaseUrl,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setProviderTestResult(data)
      } else {
        const data = await res.json()
        setProviderTestResult({ success: false, message: data.error || 'Connection test failed.' })
      }
    } catch {
      setProviderTestResult({ success: false, message: 'Network error. Please try again.' })
    } finally {
      setIsTestingProvider(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setWebhookUrlCopied(true)
    setTimeout(() => setWebhookUrlCopied(false), 2000)
  }

  // Format tokens for display (e.g., 1500 -> 1.5k, 1000000 -> 1M)
  const formatTokens = (tokens: number): string => {
    if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`
    if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}k`
    return String(tokens)
  }

  const facebookChannel = channels.find(c => c.type === 'facebook')
  const whatsappChannel = channels.find(c => c.type === 'whatsapp')
  const websiteChannel = channels.find(c => c.type === 'website')

  const isFbConnected = facebookChannel?.isActive && (() => {
    try { return JSON.parse(facebookChannel.config).isConnected } catch { return false }
  })()
  const isWaConnected = whatsappChannel?.isActive && (() => {
    try { return JSON.parse(whatsappChannel.config).isConnected } catch { return false }
  })()

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

        <Tabs defaultValue="channels" className="w-full">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="channels" className="gap-1.5"><MessageCircle className="h-4 w-4" /> Channels</TabsTrigger>
            <TabsTrigger value="general" className="gap-1.5"><Globe className="h-4 w-4" /> General</TabsTrigger>
            <TabsTrigger value="ai" className="gap-1.5"><Bot className="h-4 w-4" /> AI</TabsTrigger>
            <TabsTrigger value="widget" className="gap-1.5"><Palette className="h-4 w-4" /> Widget</TabsTrigger>
          </TabsList>

          {/* ============================================= */}
          {/* CHANNELS TAB - PRIMARY TAB FOR CONNECTING     */}
          {/* ============================================= */}
          <TabsContent value="channels" className="space-y-4 mt-4">
            {/* Facebook Messenger */}
            <Card className={cn('border-0 shadow-sm', isFbConnected && 'ring-1 ring-emerald-200')}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                    <MessageCircle className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold">Facebook Messenger</h3>
                      {isFbConnected ? (
                        <Badge className="text-[10px] bg-emerald-100 text-emerald-700 h-5">
                          <CheckCircle2 className="h-3 w-3 mr-0.5" /> Connected
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] h-5">Not Connected</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {isFbConnected
                        ? (() => { try { return `Connected to: ${JSON.parse(facebookChannel.config).pageName}` } catch { return 'Connected' } })()
                        : 'Receive and reply to Facebook Page messages'}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    className={isFbConnected ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-900 hover:bg-slate-800'}
                    onClick={() => setShowFbDialog(true)}
                  >
                    {isFbConnected ? 'Configure' : 'Connect'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* WhatsApp Business */}
            <Card className={cn('border-0 shadow-sm', isWaConnected && 'ring-1 ring-emerald-200')}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-green-50 flex items-center justify-center shrink-0">
                    <Phone className="h-6 w-6 text-green-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold">WhatsApp Business</h3>
                      {isWaConnected ? (
                        <Badge className="text-[10px] bg-emerald-100 text-emerald-700 h-5">
                          <CheckCircle2 className="h-3 w-3 mr-0.5" /> Connected
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] h-5">Not Connected</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {isWaConnected
                        ? (() => { try { return `Connected to: ${JSON.parse(whatsappChannel.config).businessName || JSON.parse(whatsappChannel.config).whatsappPhoneNumber}` } catch { return 'Connected' } })()
                        : 'Receive and reply to WhatsApp Business messages'}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    className={isWaConnected ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-900 hover:bg-slate-800'}
                    onClick={() => setShowWaDialog(true)}
                  >
                    {isWaConnected ? 'Configure' : 'Connect'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Website Live Chat */}
            <Card className="border-0 shadow-sm ring-1 ring-emerald-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-slate-50 flex items-center justify-center shrink-0">
                    <Globe className="h-6 w-6 text-slate-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold">Website Live Chat</h3>
                      <Badge className="text-[10px] bg-emerald-100 text-emerald-700 h-5">
                        <CheckCircle2 className="h-3 w-3 mr-0.5" /> Active
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">Embed chat widget on your website</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Separator />

            {/* Webhook URLs Reference */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Shield className="h-4 w-4" /> Webhook URLs
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Facebook Webhook URL</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="flex-1 bg-slate-100 px-3 py-2 rounded text-xs font-mono truncate">
                      https://yourdomain.com/api/webhooks/facebook
                    </code>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => copyToClipboard('https://yourdomain.com/api/webhooks/facebook')}>
                      {webhookUrlCopied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">WhatsApp Webhook URL</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="flex-1 bg-slate-100 px-3 py-2 rounded text-xs font-mono truncate">
                      https://yourdomain.com/api/webhooks/whatsapp
                    </code>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => copyToClipboard('https://yourdomain.com/api/webhooks/whatsapp')}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Verify Token (for both)</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="flex-1 bg-slate-100 px-3 py-2 rounded text-xs font-mono">
                      ai_support_hub_verify_token
                    </code>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => copyToClipboard('ai_support_hub_verify_token')}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Website Widget Embed Code */}
            <Card className="border-0 shadow-sm">
              <CardHeader><CardTitle className="text-sm">Website Widget Embed Code</CardTitle></CardHeader>
              <CardContent>
                <div className="bg-slate-900 text-slate-100 rounded-lg p-4 font-mono text-xs overflow-x-auto">
                  <pre>{`<!-- AI Support Hub widget — paste before </body> -->
<script>window.__AI_SUPPORT_HUB__ = "https://YOUR-APP-DOMAIN.com";</script>
<script src="https://YOUR-APP-DOMAIN.com/widget.js" async></script>`}</pre>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Replace <code className="bg-slate-100 px-1 rounded">YOUR-APP-DOMAIN.com</code> with
                  your deployed app URL, then add this code before the closing &lt;/body&gt; tag on your website.
                  The widget color, welcome message, and position are configured below.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  See <code className="bg-slate-100 px-1 rounded">docs/WORDPRESS_WIDGET.md</code> for WordPress setup.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

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
            {/* Card 1: AI Provider Selection */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Cpu className="h-4 w-4" /> AI Provider
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Current Provider Status */}
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-slate-900 flex items-center justify-center">
                      {aiProvider === 'z-ai' && <Sparkles className="h-5 w-5 text-white" />}
                      {aiProvider === 'openai' && <Bot className="h-5 w-5 text-white" />}
                      {aiProvider === 'google' && <Globe className="h-5 w-5 text-white" />}
                      {aiProvider === 'custom' && <Settings className="h-5 w-5 text-white" />}
                      {aiProvider === 'anthropic' && <Brain className="h-5 w-5 text-white" />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{currentProvider?.name || 'Z-AI'}</p>
                      <p className="text-xs text-muted-foreground">Model: {aiProviderModel || aiStats?.model || 'default'}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] h-6">
                    <Plug className="h-3 w-3 mr-1" /> {aiProvider === 'z-ai' ? 'Built-in' : 'External'}
                  </Badge>
                </div>

                {/* Provider Selection Grid */}
                <div className="space-y-2">
                  <Label className="text-sm">Select AI Provider</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {PROVIDERS.map((provider) => {
                      const Icon = provider.icon
                      const isSelected = aiProvider === provider.id
                      return (
                        <button
                          key={provider.id}
                          onClick={() => {
                            setAiProvider(provider.id)
                            setAiProviderModel(provider.models[0].id)
                            setProviderTestResult(null)
                          }}
                          className={cn(
                            'flex items-start gap-3 p-3 rounded-lg border text-left transition-all',
                            isSelected
                              ? 'border-slate-900 bg-slate-50 ring-1 ring-slate-900'
                              : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                          )}
                        >
                          <div className={cn(
                            'h-8 w-8 rounded-lg flex items-center justify-center shrink-0',
                            isSelected ? 'bg-slate-900' : 'bg-slate-100'
                          )}>
                            <Icon className={cn('h-4 w-4', isSelected ? 'text-white' : 'text-slate-600')} />
                          </div>
                          <div className="min-w-0">
                            <p className={cn('text-sm font-medium', isSelected && 'text-slate-900')}>
                              {provider.name}
                            </p>
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {provider.description}
                            </p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Model Selection */}
                {currentProvider && currentProvider.models.length > 1 && (
                  <div className="space-y-2">
                    <Label className="text-sm">Model</Label>
                    <Select value={aiProviderModel} onValueChange={setAiProviderModel}>
                      <SelectTrigger><SelectValue placeholder="Select model" /></SelectTrigger>
                      <SelectContent>
                        {currentProvider.models.map((model) => (
                          <SelectItem key={model.id} value={model.id}>
                            {model.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Custom model input for custom provider */}
                {aiProvider === 'custom' && (
                  <div className="space-y-2">
                    <Label className="text-sm">Custom Model Name</Label>
                    <Input
                      value={aiProviderModel}
                      onChange={(e) => setAiProviderModel(e.target.value)}
                      placeholder="e.g., llama3, mixtral, my-custom-model"
                    />
                    <p className="text-xs text-muted-foreground">
                      Enter the model name used by your custom API endpoint
                    </p>
                  </div>
                )}

                {/* API Key Input */}
                {currentProvider?.requiresApiKey && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm flex items-center gap-1.5">
                        <Key className="h-3.5 w-3.5" /> {currentProvider.apiKeyLabel}
                      </Label>
                      {currentProvider.docsUrl && (
                        <a
                          href={currentProvider.docsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline flex items-center gap-0.5"
                        >
                          Get API Key <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                    <div className="relative">
                      <Input
                        type={showApiKey ? 'text' : 'password'}
                        value={aiProviderApiKey}
                        onChange={(e) => setAiProviderApiKey(e.target.value)}
                        placeholder={currentProvider.apiKeyPlaceholder}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Your API key is stored locally and encrypted. Never shared externally.
                    </p>
                  </div>
                )}

                {/* Base URL for Custom Provider */}
                {currentProvider?.requiresBaseUrl && (
                  <div className="space-y-2">
                    <Label className="text-sm flex items-center gap-1.5">
                      <Globe className="h-3.5 w-3.5" /> API Base URL
                    </Label>
                    <Input
                      value={aiProviderBaseUrl}
                      onChange={(e) => setAiProviderBaseUrl(e.target.value)}
                      placeholder="e.g., http://localhost:11434/v1, https://api.groq.com/openai/v1"
                    />
                    <p className="text-xs text-muted-foreground">
                      OpenAI-compatible API endpoint URL
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {[
                        { label: 'Ollama', url: 'http://localhost:11434/v1' },
                        { label: 'Groq', url: 'https://api.groq.com/openai/v1' },
                        { label: 'Together', url: 'https://api.together.xyz/v1' },
                        { label: 'LM Studio', url: 'http://localhost:1234/v1' },
                      ].map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => setAiProviderBaseUrl(preset.url)}
                          className={cn(
                            'text-xs px-2 py-1 rounded border transition-colors',
                            aiProviderBaseUrl === preset.url
                              ? 'border-slate-900 bg-slate-100'
                              : 'border-slate-200 hover:border-slate-300'
                          )}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Test Connection Button */}
                {aiProvider !== 'z-ai' && (
                  <div className="space-y-3">
                    <Button
                      variant="outline"
                      onClick={handleTestProvider}
                      disabled={isTestingProvider || (currentProvider?.requiresApiKey && !aiProviderApiKey) || (currentProvider?.requiresBaseUrl && !aiProviderBaseUrl)}
                      className="w-full"
                    >
                      {isTestingProvider ? (
                        <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Testing Connection...</>
                      ) : (
                        <><Zap className="h-4 w-4 mr-1.5" /> Test Connection</>
                      )}
                    </Button>

                    {providerTestResult && (
                      <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn(
                          'flex items-start gap-2 p-3 rounded-lg',
                          providerTestResult.success
                            ? 'bg-emerald-50 border border-emerald-200'
                            : 'bg-red-50 border border-red-200'
                        )}
                      >
                        {providerTestResult.success ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                        )}
                        <div className="min-w-0">
                          <p className={cn('text-sm', providerTestResult.success ? 'text-emerald-700' : 'text-red-700')}>
                            {providerTestResult.message}
                          </p>
                          {providerTestResult.success && providerTestResult.model && (
                            <p className="text-xs text-emerald-600 mt-0.5">
                              Model: {providerTestResult.model} | Response time: {providerTestResult.responseTime}ms
                            </p>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </div>
                )}

                {/* Temperature & Max Tokens */}
                <Separator />
                <div className="space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm flex items-center gap-1.5">
                        <Thermometer className="h-3.5 w-3.5" /> Temperature
                      </Label>
                      <span className="text-sm font-mono text-muted-foreground">{aiTemperature.toFixed(1)}</span>
                    </div>
                    <Slider
                      value={[aiTemperature]}
                      onValueChange={(v) => setAiTemperature(v[0])}
                      min={0}
                      max={1}
                      step={0.1}
                    />
                    <p className="text-xs text-muted-foreground">
                      Lower = more focused, Higher = more creative
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm flex items-center gap-1.5">
                      <Zap className="h-3.5 w-3.5" /> Max Tokens
                    </Label>
                    <Input
                      type="number"
                      value={aiMaxTokens}
                      onChange={(e) => setAiMaxTokens(Number(e.target.value) || 2048)}
                      min={256}
                      max={8192}
                      placeholder="2048"
                    />
                    <p className="text-xs text-muted-foreground">
                      Maximum length of AI response (256 - 8192)
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Card 2: Default AI Mode */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <MessageCircle className="h-4 w-4" /> Default AI Mode
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Response Mode</Label>
                  <Select value={aiMode} onValueChange={setAiMode}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">🤖 Auto - AI replies automatically</SelectItem>
                      <SelectItem value="suggest">💡 Suggest - AI drafts, agent approves</SelectItem>
                      <SelectItem value="human">👤 Human - No AI responses</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Controls how AI interacts with customers across all conversations
                  </p>
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
                  <p className="text-xs text-muted-foreground">
                    Sets the tone and style of AI responses
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Card 3: RAG Knowledge Base Configuration */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Database className="h-4 w-4" /> RAG Knowledge Base
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="space-y-0.5">
                    <Label className="text-sm">RAG Enabled</Label>
                    <p className="text-xs text-muted-foreground">
                      Use knowledge base to enhance AI responses
                    </p>
                  </div>
                  <Switch
                    checked={ragEnabled}
                    onCheckedChange={setRagEnabled}
                  />
                </div>

                {ragEnabled && (
                  <>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm flex items-center gap-1.5">
                          <FileText className="h-3.5 w-3.5" /> Max Documents
                        </Label>
                        <span className="text-sm font-mono text-muted-foreground">{ragMaxDocuments}</span>
                      </div>
                      <Slider
                        value={[ragMaxDocuments]}
                        onValueChange={(v) => setRagMaxDocuments(v[0])}
                        min={1}
                        max={20}
                        step={1}
                      />
                      <p className="text-xs text-muted-foreground">
                        Maximum documents included in AI context (1-20)
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm flex items-center gap-1.5">
                          <BookOpen className="h-3.5 w-3.5" /> Max FAQs
                        </Label>
                        <span className="text-sm font-mono text-muted-foreground">{ragMaxFaqs}</span>
                      </div>
                      <Slider
                        value={[ragMaxFaqs]}
                        onValueChange={(v) => setRagMaxFaqs(v[0])}
                        min={1}
                        max={30}
                        step={1}
                      />
                      <p className="text-xs text-muted-foreground">
                        Maximum FAQs included in AI context (1-30)
                      </p>
                    </div>
                  </>
                )}

                {/* Knowledge Base Stats */}
                <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 rounded-lg">
                  <div className="text-center">
                    <p className="text-lg font-bold">{aiStats?.documents?.total ?? '-'}</p>
                    <p className="text-xs text-muted-foreground">Documents</p>
                    {aiStats && (
                      <p className="text-[10px] text-muted-foreground">
                        {aiStats.documents.active} active / {aiStats.documents.inactive} inactive
                      </p>
                    )}
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold">{aiStats?.faqs?.total ?? '-'}</p>
                    <p className="text-xs text-muted-foreground">FAQs</p>
                    {aiStats && (
                      <p className="text-[10px] text-muted-foreground">
                        {aiStats.faqs.active} active / {aiStats.faqs.inactive} inactive
                      </p>
                    )}
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold">
                      {aiStats?.totalKnowledgeChars != null
                        ? aiStats.totalKnowledgeChars > 1000
                          ? `${(aiStats.totalKnowledgeChars / 1000).toFixed(1)}k`
                          : aiStats.totalKnowledgeChars
                        : '-'}
                    </p>
                    <p className="text-xs text-muted-foreground">Total Chars</p>
                    <p className="text-[10px] text-muted-foreground">in active items</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Card 4: Custom System Prompt */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Sparkles className="h-4 w-4" /> Custom System Prompt
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  value={aiSystemPrompt}
                  onChange={(e) => setAiSystemPrompt(e.target.value)}
                  placeholder="Override the default AI system prompt with custom instructions. Leave empty to use the default prompt which includes multilingual support (English, Thai, Lao) and professional customer support guidelines..."
                  className="min-h-[160px] font-mono text-sm"
                />
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {aiSystemPrompt.length > 0
                      ? `${aiSystemPrompt.length} characters`
                      : 'Using default prompt'}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setAiSystemPrompt('')}
                    disabled={aiSystemPrompt.length === 0}
                    className="h-7 text-xs"
                  >
                    <RotateCcw className="h-3 w-3 mr-1" /> Reset to Default
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Card 5: AI Test Panel */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Send className="h-4 w-4" /> AI Test Panel
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm">Test Message</Label>
                  <div className="flex gap-2">
                    <Input
                      value={testMessage}
                      onChange={(e) => setTestMessage(e.target.value)}
                      placeholder="Type a customer message to test AI response..."
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey && testMessage.trim()) {
                          e.preventDefault()
                          handleTestAI()
                        }
                      }}
                    />
                    <Button
                      onClick={handleTestAI}
                      disabled={isTestLoading || !testMessage.trim()}
                      className="bg-slate-900 hover:bg-slate-800 shrink-0"
                    >
                      {isTestLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Test Results */}
                {testResponse && (
                  <div className="space-y-3">
                    <div className="p-4 bg-slate-50 rounded-lg space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">AI Response</p>
                      <p className="text-sm whitespace-pre-wrap">{testResponse}</p>
                    </div>

                    {/* Metrics */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="p-2 bg-slate-50 rounded text-center">
                        <p className="text-xs text-muted-foreground">Tokens</p>
                        <p className="text-sm font-semibold">{testTokens}</p>
                      </div>
                      <div className="p-2 bg-slate-50 rounded text-center">
                        <p className="text-xs text-muted-foreground">Response Time</p>
                        <p className="text-sm font-semibold">{testResponseTime}ms</p>
                      </div>
                      <div className="p-2 bg-slate-50 rounded text-center">
                        <p className="text-xs text-muted-foreground">Context Used</p>
                        <p className="text-sm font-semibold">{testKnowledgeContext ? 'Yes' : 'None'}</p>
                      </div>
                    </div>

                    {/* Knowledge Context (collapsible) */}
                    {testKnowledgeContext && (
                      <div className="border rounded-lg overflow-hidden">
                        <button
                          className="w-full flex items-center justify-between p-3 text-sm hover:bg-slate-50 transition-colors"
                          onClick={() => setShowKnowledgeContext(!showKnowledgeContext)}
                        >
                          <span className="flex items-center gap-1.5 font-medium">
                            <BookOpen className="h-3.5 w-3.5" /> Knowledge Context Used
                          </span>
                          {showKnowledgeContext ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </button>
                        {showKnowledgeContext && (
                          <ScrollArea className="max-h-48 border-t">
                            <div className="p-3">
                              <pre className="text-xs whitespace-pre-wrap text-muted-foreground font-mono">
                                {testKnowledgeContext}
                              </pre>
                            </div>
                          </ScrollArea>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Card 6: Token Usage & Budget Dashboard */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" /> Token Usage & Budget
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Budget Progress Bar */}
                {aiStats?.budget && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Monthly Budget</span>
                      <span className="text-sm text-muted-foreground">
                        {aiStats.budget.monthlyBudget === 0 ? 'Unlimited' : `$${aiStats.budget.monthlyBudget.toFixed(2)}`}
                      </span>
                    </div>
                    {aiStats.budget.monthlyBudget > 0 && (
                      <>
                        <div className="relative h-3 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={cn(
                              'h-full rounded-full transition-all duration-500',
                              aiStats.budget.warningLevel === 'red' ? 'bg-red-500' :
                              aiStats.budget.warningLevel === 'yellow' ? 'bg-amber-500' :
                              'bg-emerald-500'
                            )}
                            style={{ width: `${Math.min(aiStats.budget.percentageUsed, 100)}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className={cn(
                            'font-medium',
                            aiStats.budget.warningLevel === 'red' ? 'text-red-600' :
                            aiStats.budget.warningLevel === 'yellow' ? 'text-amber-600' :
                            'text-emerald-600'
                          )}>
                            ${aiStats.budget.monthlyUsage.toFixed(4)} used ({aiStats.budget.percentageUsed.toFixed(1)}%)
                          </span>
                          <span className="text-muted-foreground">
                            {aiStats.budget.remainingBudget === -1 ? 'Unlimited' : `$${aiStats.budget.remainingBudget.toFixed(2)} remaining`}
                          </span>
                        </div>
                        {aiStats.budget.warningLevel === 'red' && (
                          <div className="flex items-center gap-2 p-2 bg-red-50 rounded-lg border border-red-200">
                            <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
                            <span className="text-xs text-red-700">
                              {aiStats.budget.percentageUsed >= 100
                                ? 'Monthly budget exceeded! AI features may be limited.'
                                : 'Approaching budget limit. Consider increasing your budget.'}
                            </span>
                          </div>
                        )}
                      </>
                    )}
                    <div className="space-y-2">
                      <Label className="text-sm">Monthly Budget (USD)</Label>
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <Input
                          type="number"
                          value={aiMonthlyBudget}
                          onChange={(e) => setAiMonthlyBudget(e.target.value)}
                          placeholder="0 = unlimited"
                          min={0}
                          step={1}
                          className="flex-1"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Set to 0 for unlimited. Budget is tracked monthly and resets automatically.
                      </p>
                    </div>
                  </div>
                )}

                <Separator />

                {/* Usage Stats Cards */}
                <div className="grid grid-cols-3 gap-3">
                  {/* Today */}
                  <div className="p-3 bg-slate-50 rounded-lg space-y-1">
                    <p className="text-xs text-muted-foreground font-medium">Today</p>
                    <p className="text-lg font-bold">{formatTokens(aiStats?.usage?.today?.totalTokens ?? 0)}</p>
                    <p className="text-xs text-muted-foreground">{aiStats?.usage?.today?.totalRequests ?? 0} requests</p>
                    <p className="text-xs font-medium text-emerald-600">${(aiStats?.usage?.today?.estimatedCost ?? 0).toFixed(4)}</p>
                  </div>
                  {/* This Week */}
                  <div className="p-3 bg-slate-50 rounded-lg space-y-1">
                    <p className="text-xs text-muted-foreground font-medium">7 Days</p>
                    <p className="text-lg font-bold">{formatTokens(aiStats?.usage?.week?.totalTokens ?? 0)}</p>
                    <p className="text-xs text-muted-foreground">{aiStats?.usage?.week?.totalRequests ?? 0} requests</p>
                    <p className="text-xs font-medium text-emerald-600">${(aiStats?.usage?.week?.estimatedCost ?? 0).toFixed(4)}</p>
                  </div>
                  {/* This Month */}
                  <div className="p-3 bg-slate-50 rounded-lg space-y-1">
                    <p className="text-xs text-muted-foreground font-medium">30 Days</p>
                    <p className="text-lg font-bold">{formatTokens(aiStats?.usage?.month?.totalTokens ?? 0)}</p>
                    <p className="text-xs text-muted-foreground">{aiStats?.usage?.month?.totalRequests ?? 0} requests</p>
                    <p className="text-xs font-medium text-emerald-600">${(aiStats?.usage?.month?.estimatedCost ?? 0).toFixed(4)}</p>
                  </div>
                </div>

                {/* Token Breakdown */}
                {aiStats?.usage?.month && aiStats.usage.month.totalTokens > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Token Breakdown (30 days)</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg">
                        <div className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                        <div className="flex-1">
                          <p className="text-xs text-muted-foreground">Input (Prompt)</p>
                          <p className="text-sm font-semibold">{formatTokens(aiStats.usage.month.promptTokens)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 p-2 bg-violet-50 rounded-lg">
                        <div className="h-2.5 w-2.5 rounded-full bg-violet-500" />
                        <div className="flex-1">
                          <p className="text-xs text-muted-foreground">Output (Completion)</p>
                          <p className="text-sm font-semibold">{formatTokens(aiStats.usage.month.completionTokens)}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
                      <Activity className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Avg Response Time:</span>
                      <span className="text-sm font-semibold">{aiStats.usage.month.avgResponseTime}ms</span>
                    </div>
                  </div>
                )}

                {/* Usage by Provider */}
                {aiStats?.usage?.month && aiStats.usage.month.byProvider.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Usage by Provider (30 days)</p>
                    <div className="space-y-2">
                      {aiStats.usage.month.byProvider.map((p) => {
                        const providerInfo = PROVIDERS.find(prov => prov.id === p.provider)
                        const Icon = providerInfo?.icon || Settings
                        return (
                          <div key={p.provider} className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg">
                            <div className="h-7 w-7 rounded bg-slate-200 flex items-center justify-center shrink-0">
                              <Icon className="h-3.5 w-3.5 text-slate-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <p className="text-xs font-medium">{providerInfo?.name || p.provider}</p>
                                <p className="text-xs font-semibold">{formatTokens(p.totalTokens)}</p>
                              </div>
                              <div className="flex items-center justify-between mt-0.5">
                                <p className="text-[10px] text-muted-foreground">{p.totalRequests} requests</p>
                                <p className="text-[10px] text-emerald-600">${p.estimatedCost.toFixed(4)}</p>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* 30-Day Usage Chart (Simple bar chart) */}
                {aiStats?.usage?.month && aiStats.usage.month.daily.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium flex items-center gap-1.5">
                      <TrendingUp className="h-3.5 w-3.5" /> 30-Day Usage Trend
                    </p>
                    <div className="bg-slate-50 rounded-lg p-3">
                      <div className="flex items-end gap-[2px] h-24">
                        {aiStats.usage.month.daily.map((day, i) => {
                          const maxTokens = Math.max(...aiStats.usage.month!.daily.map(d => d.totalTokens), 1)
                          const height = maxTokens > 0 ? (day.totalTokens / maxTokens) * 100 : 0
                          return (
                            <div
                              key={day.date}
                              className="flex-1 min-w-[3px] group relative"
                              style={{ height: '100%' }}
                            >
                              <div
                                className={cn(
                                  'w-full rounded-t transition-all duration-200',
                                  i === aiStats.usage.month!.daily.length - 1
                                    ? 'bg-slate-900'
                                    : 'bg-slate-300 hover:bg-slate-400'
                                )}
                                style={{
                                  height: `${Math.max(height, 2)}%`,
                                  marginTop: `${100 - Math.max(height, 2)}%`,
                                }}
                              />
                              {/* Tooltip */}
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-10">
                                <div className="bg-slate-900 text-white text-[10px] px-2 py-1 rounded shadow-lg whitespace-nowrap">
                                  {day.date.slice(5)}: {formatTokens(day.totalTokens)}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                      <div className="flex justify-between mt-1.5 text-[10px] text-muted-foreground">
                        <span>30 days ago</span>
                        <span>Today</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Recent AI Activity */}
                {aiStats?.recentLogs && aiStats.recentLogs.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Recent AI Activity</p>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar">
                      {aiStats.recentLogs.map((log) => (
                        <div key={log.id} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg text-xs">
                          <div className="h-5 w-5 rounded bg-slate-200 flex items-center justify-center shrink-0">
                            <Bot className="h-3 w-3 text-slate-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="font-medium">{log.model}</span>
                            <span className="text-muted-foreground ml-1">({log.provider})</span>
                          </div>
                          <span className="text-muted-foreground shrink-0">{formatTokens(log.tokens)}</span>
                          <span className="text-emerald-600 shrink-0">${log.estimatedCost.toFixed(4)}</span>
                          <span className="text-muted-foreground shrink-0">{log.responseTime}ms</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* No Usage Message */}
                {(!aiStats?.usage?.month || aiStats.usage.month.totalTokens === 0) && (
                  <div className="text-center py-6 text-muted-foreground">
                    <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No AI usage data yet</p>
                    <p className="text-xs mt-1">Usage statistics will appear here once AI responses are generated</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="widget" className="space-y-4 mt-4">
            <Card className="border-0 shadow-sm">
              <CardHeader><CardTitle className="text-sm">Widget Customization</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Primary Color</Label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={widgetColor} onChange={(e) => setWidgetColor(e.target.value)} className="h-9 w-12 rounded border border-border cursor-pointer" />
                    <Input value={widgetColor} onChange={(e) => setWidgetColor(e.target.value)} className="flex-1" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Welcome Message</Label>
                  <Textarea value={widgetWelcome} onChange={(e) => setWidgetWelcome(e.target.value)} placeholder="Hello! How can we help you today?" />
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

            <Card className="border-0 shadow-sm">
              <CardHeader><CardTitle className="text-sm">Widget Preview</CardTitle></CardHeader>
              <CardContent>
                <div className="bg-slate-50 rounded-lg p-6 flex items-end justify-end min-h-[200px]">
                  <div className="text-right">
                    <div className="rounded-t-2xl rounded-bl-sm p-4 text-white text-sm max-w-[240px] shadow-lg" style={{ backgroundColor: widgetColor }}>
                      {widgetWelcome}
                    </div>
                    <div className="h-12 w-12 rounded-full flex items-center justify-center mt-3 ml-auto shadow-lg cursor-pointer" style={{ backgroundColor: widgetColor }}>
                      <MessageCircle className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialogs */}
      <FacebookConnectDialog
        open={showFbDialog}
        onClose={() => setShowFbDialog(false)}
        channel={facebookChannel || null}
        onConnected={fetchChannels}
      />
      <WhatsAppConnectDialog
        open={showWaDialog}
        onClose={() => setShowWaDialog(false)}
        channel={whatsappChannel || null}
        onConnected={fetchChannels}
      />
    </div>
  )
}
