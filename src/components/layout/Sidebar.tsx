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
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { useState } from 'react'

interface SidebarProps {
  user: User
}

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Properties', href: '/properties', icon: Building2 },
  { name: 'Sections', href: '/sections', icon: Layers },
  { name: 'Units', href: '/units', icon: DoorOpen },
  { name: 'Tenants', href: '/tenants', icon: Users },
  { name: 'Leases', href: '/leases', icon: FileText },
  { name: 'Invoices', href: '/invoices', icon: Receipt },
  { name: 'Payments', href: '/payments', icon: CreditCard },
  { name: 'Expenses', href: '/expenses', icon: Wallet },
  { name: 'Utilities', href: '/utilities', icon: Gauge },
  { name: 'Documents', href: '/documents', icon: FileStack },
  { name: 'Reports', href: '/reports', icon: BarChart3 },
  { name: 'Tenant Portal', href: '/tenant-portal', icon: UserRound },
  { name: 'Settings', href: '/settings', icon: Settings },
]

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

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
        {navigation.map((item) => {
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
