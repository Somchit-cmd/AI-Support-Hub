'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useAppStore, useAuthStore, useConversationStore, useNotificationStore, AppPage } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import {
  MessageSquare,
  BarChart3,
  Users,
  BookOpen,
  UserCog,
  Zap,
  Settings,
  LogOut,
  PanelLeftClose,
  PanelLeft,
  Menu,
  Bell,
  Sun,
  Moon,
  Sparkles,
  ChevronDown,
} from 'lucide-react'
import InboxPage from '@/components/pages/InboxPage'
import DashboardPage from '@/components/pages/DashboardPage'
import CustomersPage from '@/components/pages/CustomersPage'
import KnowledgePage from '@/components/pages/KnowledgePage'
import StaffPage from '@/components/pages/StaffPage'
import AutomationPage from '@/components/pages/AutomationPage'
import SettingsPage from '@/components/pages/SettingsPage'

const navItems: { page: AppPage; label: string; icon: React.ElementType }[] = [
  { page: 'inbox', label: 'Inbox', icon: MessageSquare },
  { page: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { page: 'customers', label: 'Customers', icon: Users },
  { page: 'knowledge', label: 'Knowledge', icon: BookOpen },
  { page: 'staff', label: 'Staff', icon: UserCog },
  { page: 'automation', label: 'Automation', icon: Zap },
  { page: 'settings', label: 'Settings', icon: Settings },
]

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
}

function SidebarNav({ collapsed, onNavigate }: { collapsed: boolean; onNavigate: () => void }) {
  const { currentPage, setCurrentPage } = useAppStore()
  // Live unread badge — derived from the conversation store (kept fresh by the
  // InboxPage SSE stream). Was a hardcoded `6` before.
  const conversations = useConversationStore((s) => s.conversations)
  const unreadCount = conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0)

  return (
    <TooltipProvider delayDuration={0}>
      <nav className="flex flex-col gap-1 px-2 py-2">
        {navItems.map((item) => {
          const isActive = currentPage === item.page
          const Icon = item.icon
          const button = (
            <button
              key={item.page}
              onClick={() => {
                setCurrentPage(item.page)
                onNavigate()
              }}
              className={cn(
                'w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-slate-900 text-white shadow-md shadow-slate-900/20'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              )}
            >
              <Icon className={cn('h-5 w-5 shrink-0', isActive ? 'text-white' : 'text-slate-400')} />
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  className="overflow-hidden whitespace-nowrap"
                >
                  {item.label}
                </motion.span>
              )}
              {!collapsed && item.page === 'inbox' && unreadCount > 0 && (
                <Badge className="ml-auto bg-emerald-500 text-white text-[10px] h-5 min-w-5 flex items-center justify-center px-1.5">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Badge>
              )}
            </button>
          )
          if (collapsed) {
            return (
              <Tooltip key={item.page}>
                <TooltipTrigger asChild>{button}</TooltipTrigger>
                <TooltipContent side="right" className="font-medium">
                  {item.label}
                </TooltipContent>
              </Tooltip>
            )
          }
          return <div key={item.page}>{button}</div>
        })}
      </nav>
    </TooltipProvider>
  )
}

export default function AppShell() {
  const { sidebarCollapsed, toggleSidebar, currentPage, theme, setTheme } = useAppStore()
  const { user, logout } = useAuthStore()
  // Real unread count derived from the conversation store (kept in sync by the
  // InboxPage via the SSE stream). Was a hardcoded `3` / sidebar `6` before.
  const conversations = useConversationStore((s) => s.conversations)
  const fetchConversations = useConversationStore((s) => s.fetchConversations)
  const unreadCount = conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0)

  const { notifications, unreadCount: notifUnread, fetchNotifications } = useNotificationStore()
  const [showNotifications, setShowNotifications] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  // Load conversations + notifications once on mount so the badges are live.
  useEffect(() => {
    fetchConversations()
    fetchNotifications()
  }, [fetchConversations, fetchNotifications])

  // Refresh on focus so a tab left open catches up.
  useEffect(() => {
    const onFocus = () => { fetchConversations(); fetchNotifications() }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [fetchConversations, fetchNotifications])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  const renderPage = () => {
    switch (currentPage) {
      case 'inbox': return <InboxPage />
      case 'dashboard': return <DashboardPage />
      case 'customers': return <CustomersPage />
      case 'knowledge': return <KnowledgePage />
      case 'staff': return <StaffPage />
      case 'automation': return <AutomationPage />
      case 'settings': return <SettingsPage />
      default: return <InboxPage />
    }
  }

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          'hidden lg:flex flex-col border-r border-border bg-card transition-all duration-300 shrink-0',
          sidebarCollapsed ? 'w-[68px]' : 'w-[240px]'
        )}
      >
        {/* Sidebar Header */}
        <div className={cn('flex items-center h-16 px-4 border-b border-border', sidebarCollapsed ? 'justify-center' : 'gap-3')}>
          <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center shrink-0">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          {!sidebarCollapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="overflow-hidden"
            >
              <h1 className="text-base font-bold tracking-tight truncate">AI Support Hub</h1>
              <p className="text-[10px] text-muted-foreground leading-none">Omnichannel Platform</p>
            </motion.div>
          )}
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 py-2">
          <SidebarNav collapsed={sidebarCollapsed} onNavigate={() => {}} />
        </ScrollArea>

        {/* Sidebar Footer */}
        <div className="border-t border-border p-3">
          {!sidebarCollapsed && (
            <div className="flex items-center gap-3 mb-2 px-1">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-slate-200 text-slate-700 text-xs font-semibold">
                  {user?.name?.charAt(0)?.toUpperCase() || 'A'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user?.name || 'Admin'}</p>
                <p className="text-[11px] text-muted-foreground capitalize">{user?.role || 'super_admin'}</p>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={logout}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleSidebar}
            className={cn('w-full text-muted-foreground', sidebarCollapsed && 'px-0 justify-center')}
          >
            {sidebarCollapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            {!sidebarCollapsed && <span className="ml-2">Collapse</span>}
          </Button>
        </div>
      </aside>

      {/* Mobile Sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[280px] p-0">
          <div className="flex items-center h-16 px-4 gap-3 border-b">
            <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight">AI Support Hub</h1>
              <p className="text-[10px] text-muted-foreground">Omnichannel Platform</p>
            </div>
          </div>
          <ScrollArea className="flex-1">
            <SidebarNav collapsed={false} onNavigate={() => setMobileOpen(false)} />
          </ScrollArea>
          <div className="border-t p-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-slate-200 text-slate-700 text-xs">
                  {user?.name?.charAt(0)?.toUpperCase() || 'A'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user?.name || 'Admin'}</p>
                <p className="text-[11px] text-muted-foreground capitalize">{user?.role || 'super_admin'}</p>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={logout}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Bar */}
        <header className="h-14 border-b border-border bg-card/80 backdrop-blur-sm flex items-center px-4 gap-3 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden h-9 w-9"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="flex-1" />

          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 relative"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          <DropdownMenu open={showNotifications} onOpenChange={setShowNotifications}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 relative">
                <Bell className="h-4 w-4" />
                {notifUnread > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-destructive text-[10px] text-white flex items-center justify-center font-bold">
                    {notifUnread > 99 ? '99+' : notifUnread}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <div className="flex items-center justify-between px-2 py-1.5">
                <span className="text-sm font-semibold">Notifications</span>
                {notifUnread > 0 && (
                  <button
                    className="text-xs text-primary hover:underline"
                    onClick={() => useNotificationStore.getState().markAllRead()}
                  >
                    Mark all read
                  </button>
                )}
              </div>
              <DropdownMenuSeparator />
              {notifications.length === 0 ? (
                <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                  No notifications
                </div>
              ) : (
                notifications.slice(0, 8).map((n) => (
                  <DropdownMenuItem key={n.id} className="flex-col items-start py-2" onClick={() => useNotificationStore.getState().markRead(n.id)}>
                    <div className="flex items-center gap-2 w-full">
                      {!n.isRead && <span className="h-2 w-2 rounded-full bg-primary shrink-0" />}
                      <span className="text-sm font-medium truncate">{n.title}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <Separator orientation="vertical" className="h-6" />

          <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-slate-200 text-slate-700 text-xs font-semibold">
                {user?.name?.charAt(0)?.toUpperCase() || 'A'}
              </AvatarFallback>
            </Avatar>
            <div className="hidden sm:block">
              <p className="text-sm font-medium leading-none">{user?.name || 'Admin'}</p>
              <p className="text-[11px] text-muted-foreground capitalize">{user?.role || 'super_admin'}</p>
            </div>
            <ChevronDown className="h-3 w-3 text-muted-foreground hidden sm:block" />
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentPage}
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              {renderPage()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}
