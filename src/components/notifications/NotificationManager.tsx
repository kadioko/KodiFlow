'use client'

import { Bell } from 'lucide-react'
import { useState } from 'react'

export function NotificationManager() {
  const [status, setStatus] = useState(typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default')

  const enableNotifications = async () => {
    if (!('Notification' in window)) return

    const permission = await Notification.requestPermission()
    setStatus(permission)

    if (permission === 'granted') {
      new Notification('KodiFlow notifications enabled', {
        body: 'You can receive overdue invoice and lease event alerts on this device.',
        icon: '/icons/icon.svg',
      })
    }
  }

  const sendSampleAlert = () => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return

    new Notification('KodiFlow Alert', {
      body: 'Sample alert: overdue invoices and lease events will appear here.',
      icon: '/icons/icon.svg',
    })
  }

  return (
    <button
      onClick={status === 'granted' ? sendSampleAlert : enableNotifications}
      className="p-2 rounded-lg text-gray-400 hover:text-gray-500 hover:bg-gray-100 relative"
      title={status === 'granted' ? 'Send sample notification' : 'Enable notifications'}
    >
      <Bell className="h-6 w-6" />
      <span className={`absolute top-1 right-1 h-2 w-2 rounded-full ${status === 'granted' ? 'bg-success-500' : 'bg-danger-500'}`}></span>
    </button>
  )
}
