'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { User } from '@supabase/supabase-js'
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
  { name: 'Documents', href: '/documents', icon: FileStack },
  { name: 'Reports', href: '/reports', icon: BarChart3 },
  { name: 'Tenant Portal', href: '/tenant-portal', icon: UserRound },
  { name: 'Settings', href: '/settings', icon: Settings },
]

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className={`${collapsed ? 'w-16' : 'w-64'} flex-shrink-0 bg-white border-r border-gray-200 transition-all duration-300 flex flex-col`}>
      <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
        {!collapsed && (
          <Link href="/dashboard" className="flex items-center space-x-2">
            <div className="h-8 w-8 bg-primary-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-lg font-bold">K</span>
            </div>
            <span className="text-xl font-bold text-gray-900">KodiFlow</span>
          </Link>
        )}
        {collapsed && (
          <div className="h-8 w-8 bg-primary-600 rounded-lg flex items-center justify-center mx-auto">
            <span className="text-white text-lg font-bold">K</span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded-lg hover:bg-gray-100"
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
        <div className="border-t border-gray-200 p-4">
          <div className="flex items-center">
            <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center">
              <span className="text-primary-700 font-medium text-sm">
                {user.email?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-900 truncate max-w-[140px]">
                {user.email}
              </p>
              <p className="text-xs text-gray-500">Property Manager</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
