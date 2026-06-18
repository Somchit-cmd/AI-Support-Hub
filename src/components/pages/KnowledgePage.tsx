'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  BookOpen, Upload, FileText, Plus, Trash2, HelpCircle, Edit,
  File, Search, Tag
} from 'lucide-react'

interface DocumentData {
  id: string
  name: string
  type: string
  content: string
  summary: string | null
  isActive: boolean
  createdAt: string
}

interface FaqData {
  id: string
  question: string
  answer: string
  category: string
  isActive: boolean
  createdAt: string
}

export default function KnowledgePage() {
  const [documents, setDocuments] = useState<DocumentData[]>([])
  const [faqs, setFaqs] = useState<FaqData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAddFaq, setShowAddFaq] = useState(false)
  const [showAddDoc, setShowAddDoc] = useState(false)
  const [newFaq, setNewFaq] = useState({ question: '', answer: '', category: 'general' })
  const [newDoc, setNewDoc] = useState({ name: '', type: 'txt', content: '' })
  const [faqSearch, setFaqSearch] = useState('')

  useEffect(() => {
    fetchKnowledge()
  }, [])

  const fetchKnowledge = async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/knowledge')
      if (res.ok) {
        const data = await res.json()
        setDocuments(data.documents || [])
        setFaqs(data.faqs || [])
      }
    } catch {
      // error
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddFaq = async () => {
    if (!newFaq.question.trim() || !newFaq.answer.trim()) return
    try {
      const res = await fetch('/api/faqs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newFaq),
      })
      if (res.ok) {
        setShowAddFaq(false)
        setNewFaq({ question: '', answer: '', category: 'general' })
        fetchKnowledge()
      }
    } catch {
      // error
    }
  }

  const handleAddDocument = async () => {
    if (!newDoc.name.trim() || !newDoc.content.trim()) return
    try {
      const res = await fetch('/api/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newDoc),
      })
      if (res.ok) {
        setShowAddDoc(false)
        setNewDoc({ name: '', type: 'txt', content: '' })
        fetchKnowledge()
      }
    } catch {
      // error
    }
  }

  // Real file upload: PDF / DOCX / TXT are parsed server-side.
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const handleFileUpload = async () => {
    if (!uploadedFile) return
    setIsUploading(true)
    setUploadError(null)
    try {
      const form = new FormData()
      form.append('file', uploadedFile)
      form.append('name', uploadedFile.name.replace(/\.[^.]+$/, ''))
      const res = await fetch('/api/knowledge', { method: 'POST', body: form })
      if (res.ok) {
        setShowAddDoc(false)
        setUploadedFile(null)
        fetchKnowledge()
      } else {
        const data = await res.json().catch(() => ({}))
        setUploadError(data.error || 'Upload failed')
      }
    } catch {
      setUploadError('Network error during upload')
    } finally {
      setIsUploading(false)
    }
  }

  const handleDeleteDocument = async (id: string) => {
    try {
      await fetch(`/api/knowledge/documents/${id}`, { method: 'DELETE' })
      fetchKnowledge()
    } catch {
      // error
    }
  }

  const filteredFaqs = faqs.filter(f =>
    f.question.toLowerCase().includes(faqSearch.toLowerCase()) ||
    f.answer.toLowerCase().includes(faqSearch.toLowerCase())
  )

  const categories = [...new Set(faqs.map(f => f.category))]

  return (
    <div className="h-full overflow-y-auto custom-scrollbar">
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Knowledge Base</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage documents and FAQs for AI-powered responses</p>
        </div>

        <Tabs defaultValue="faqs" className="w-full">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="faqs" className="gap-1.5">
              <HelpCircle className="h-4 w-4" /> FAQs ({faqs.length})
            </TabsTrigger>
            <TabsTrigger value="documents" className="gap-1.5">
              <FileText className="h-4 w-4" /> Documents ({documents.length})
            </TabsTrigger>
          </TabsList>

          {/* FAQs Tab */}
          <TabsContent value="faqs" className="space-y-4 mt-4">
            <div className="flex items-center justify-between gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search FAQs..."
                  className="pl-9 h-9"
                  value={faqSearch}
                  onChange={(e) => setFaqSearch(e.target.value)}
                />
              </div>
              <Dialog open={showAddFaq} onOpenChange={setShowAddFaq}>
                <DialogTrigger asChild>
                  <Button size="sm" className="bg-slate-900 hover:bg-slate-800">
                    <Plus className="h-4 w-4 mr-1" /> Add FAQ
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New FAQ</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label>Question</Label>
                      <Input value={newFaq.question} onChange={(e) => setNewFaq({ ...newFaq, question: e.target.value })} placeholder="Customer question..." />
                    </div>
                    <div className="space-y-2">
                      <Label>Answer</Label>
                      <Textarea value={newFaq.answer} onChange={(e) => setNewFaq({ ...newFaq, answer: e.target.value })} placeholder="Answer to the question..." className="min-h-[100px]" />
                    </div>
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <Select value={newFaq.category} onValueChange={(v) => setNewFaq({ ...newFaq, category: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="general">General</SelectItem>
                          <SelectItem value="billing">Billing</SelectItem>
                          <SelectItem value="technical">Technical</SelectItem>
                          <SelectItem value="shipping">Shipping</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={handleAddFaq} className="w-full bg-slate-900 hover:bg-slate-800">Add FAQ</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}
              </div>
            ) : filteredFaqs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <HelpCircle className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p>No FAQs found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredFaqs.map((faq) => (
                  <motion.div
                    key={faq.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-sm font-semibold">{faq.question}</h3>
                              <Badge variant="outline" className="text-[10px] h-5">{faq.category}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{faq.answer}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Documents Tab */}
          <TabsContent value="documents" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Upload documents to power AI responses</p>
              <Dialog open={showAddDoc} onOpenChange={setShowAddDoc}>
                <DialogTrigger asChild>
                  <Button size="sm" className="bg-slate-900 hover:bg-slate-800">
                    <Upload className="h-4 w-4 mr-1" /> Upload
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Upload Document</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label>Document Name</Label>
                      <Input value={newDoc.name} onChange={(e) => setNewDoc({ ...newDoc, name: e.target.value })} placeholder="e.g. Company Policies" />
                    </div>
                    {/* Real file upload: parsed server-side */}
                    <div className="space-y-2">
                      <Label>Upload a file (PDF / DOCX / TXT)</Label>
                      <Input
                        type="file"
                        accept=".pdf,.docx,.doc,.txt,.md,.html"
                        onChange={(e) => setUploadedFile(e.target.files?.[0] || null)}
                      />
                      {uploadedFile && (
                        <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted">
                          <span className="text-xs truncate flex-1">{uploadedFile.name} ({Math.round(uploadedFile.size / 1024)} KB)</span>
                          <Button size="sm" onClick={handleFileUpload} disabled={isUploading} className="bg-slate-900 hover:bg-slate-800">
                            {isUploading ? 'Parsing...' : 'Parse & Save'}
                          </Button>
                        </div>
                      )}
                      {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}
                    </div>
                    <div className="relative py-1">
                      <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
                      <span className="relative bg-background px-2 text-[10px] uppercase text-muted-foreground mx-auto">or paste text / URL</span>
                    </div>
                    <div className="space-y-2">
                      <Label>Type</Label>
                      <Select value={newDoc.type} onValueChange={(v) => setNewDoc({ ...newDoc, type: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="txt">Text (.txt)</SelectItem>
                          <SelectItem value="pdf">PDF</SelectItem>
                          <SelectItem value="docx">Word (.docx)</SelectItem>
                          <SelectItem value="url">Website URL</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Content</Label>
                      <Textarea
                        value={newDoc.content}
                        onChange={(e) => setNewDoc({ ...newDoc, content: e.target.value })}
                        placeholder="Paste document content or URL here..."
                        className="min-h-[150px]"
                      />
                    </div>
                    <Button onClick={handleAddDocument} className="w-full bg-slate-900 hover:bg-slate-800">Upload Document</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
              </div>
            ) : documents.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground border-2 border-dashed border-border rounded-xl">
                <FileText className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p>No documents uploaded yet</p>
                <p className="text-xs mt-1">Upload PDFs, documents, or text files</p>
              </div>
            ) : (
              <div className="space-y-2">
                {documents.map((doc) => (
                  <motion.div
                    key={doc.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-muted/50 transition-colors"
                  >
                    <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                      <File className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{doc.name}</p>
                      <p className="text-xs text-muted-foreground">{doc.type.toUpperCase()} • {doc.content.length} chars</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] h-5">
                      {doc.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteDocument(doc.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </motion.div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
