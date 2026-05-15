'use client'

import { useEffect } from 'react'
import { useAuthStore, useConversationStore } from '@/lib/store'
import AppShell from '@/components/layout/AppShell'
import LoginPage from '@/components/auth/LoginPage'
import { Loader2 } from 'lucide-react'

export default function Home() {
  const { isAuthenticated, isLoading, checkAuth } = useAuthStore()
  const fetchConversations = useConversationStore((s) => s.fetchConversations)

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  useEffect(() => {
    if (isAuthenticated) {
      fetchConversations()
    }
  }, [isAuthenticated, fetchConversations])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <LoginPage />
  }

  return <AppShell />
}
