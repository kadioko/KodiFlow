'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { User } from '@supabase/supabase-js'
import { BrandLogo } from '@/components/brand/BrandLogo'
import {
  LayoutDashboard,
  Building2,
  Layers,
  DoorOpen,
  Users,
  FileText,
  Receipt,
  CreditCard,
  Wallet,
  Gauge,
  FileStack,
  BarChart3,
  UserRound,
  Settings,
  Shield,
  Wrench,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react'
import { useState } from 'react'

interface SidebarProps {
  user: User
  adminRole: 'none' | 'admin' | 'super_admin'
}

export const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Properties', href: '/properties', icon: Building2 },
  { name: 'Sections', href: '/sections', icon: Layers },
  { name: 'Units', href: '/units', icon: DoorOpen },
  { name: 'Tenants', href: '/tenants', icon: Users },
  { name: 'Leases', href: '/leases', icon: FileText },
  { name: 'Invoices', href: '/invoices', icon: Receipt },
  { name: 'Payments', href: '/payments', icon: CreditCard },
  { name: 'Expenses', href: '/expenses', icon: Wallet },
  { name: 'Maintenance', href: '/maintenance', icon: Wrench },
  { name: 'Utilities', href: '/utilities', icon: Gauge },
  { name: 'Documents', href: '/documents', icon: FileStack },
  { name: 'Reports', href: '/reports', icon: BarChart3 },
  { name: 'Tenant Portal', href: '/tenant-portal', icon: UserRound },
  { name: 'Settings', href: '/settings', icon: Settings },
]

const adminNavigation = [
  { name: 'Admin', href: '/admin', icon: Shield },
]

export function Sidebar({ user, adminRole }: SidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const visibleNavigation = adminRole === 'none' ? navigation : [...navigation, ...adminNavigation]

  return (
    <div className={`${collapsed ? 'w-16' : 'w-64'} hidden flex-shrink-0 bg-slate-950 text-white shadow-2xl shadow-slate-950/20 transition-all duration-300 lg:flex lg:flex-col`}>
      <div className={`relative flex h-16 items-center border-b border-white/10 ${collapsed ? 'justify-center px-2' : 'justify-between px-4'}`}>
        {!collapsed && (
          <BrandLogo href="/dashboard" size="sm" tone="light" priorityLabel="KodiFlow dashboard" />
        )}
        {collapsed && (
          <BrandLogo href="/dashboard" size="sm" variant="mark" tone="light" priorityLabel="KodiFlow dashboard" />
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={`${collapsed ? 'absolute left-12' : ''} rounded-lg p-1 text-white/70 hover:bg-white/10 hover:text-white`}
          aria-label={collapsed ? 'Expand dashboard navigation' : 'Collapse dashboard navigation'}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {visibleNavigation.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`${
                isActive
                  ? 'sidebar-link-active'
                  : 'sidebar-link-inactive'
              } ${collapsed ? 'justify-center' : ''}`}
              title={collapsed ? item.name : undefined}
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              {!collapsed && <span className="ml-3">{item.name}</span>}
            </Link>
          )
        })}
      </nav>

      {!collapsed && (
        <div className="border-t border-white/10 p-4">
          <div className="flex items-center">
            <div className="h-9 w-9 rounded-full bg-white/10 ring-1 ring-white/10 flex items-center justify-center">
              <span className="text-white font-bold text-sm">
                {user.email?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="ml-3">
              <p className="text-sm font-semibold text-white truncate max-w-[140px]">
                {user.email}
              </p>
              <p className="text-xs text-white/50">Property Manager</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface MobileSidebarProps {
  user: User
  adminRole: 'none' | 'admin' | 'super_admin'
  open: boolean
  onClose: () => void
}

export function MobileSidebar({ user, adminRole, open, onClose }: MobileSidebarProps) {
  const pathname = usePathname()
  const visibleNavigation = adminRole === 'none' ? navigation : [...navigation, ...adminNavigation]

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close navigation menu"
      />
      <aside className="safe-area-top safe-area-bottom relative flex h-full w-[min(20rem,85vw)] flex-col bg-slate-950 text-white shadow-2xl">
        <div className="flex h-16 items-center justify-between border-b border-white/10 px-4">
          <BrandLogo href="/dashboard" size="sm" tone="light" priorityLabel="KodiFlow dashboard" />
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-white/75 transition hover:bg-white/10 hover:text-white"
            aria-label="Close navigation menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {visibleNavigation.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={onClose}
                className={isActive ? 'sidebar-link-active' : 'sidebar-link-inactive'}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                <span className="ml-3">{item.name}</span>
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-white/10 p-4">
          <div className="flex items-center">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/10">
              <span className="text-sm font-bold text-white">
                {user.email?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="ml-3 min-w-0">
              <p className="truncate text-sm font-semibold text-white">{user.email}</p>
              <p className="text-xs text-white/50">Property Manager</p>
            </div>
          </div>
        </div>
      </aside>
    </div>
  )
}
