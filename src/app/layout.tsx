import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { PwaProvider } from '@/components/pwa/PwaProvider'
import { AppShell } from '@/components/layout/AppShell'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'KodiFlow - Property Management',
  description: 'Modern property management system for residential and commercial properties',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'KodiFlow',
    statusBarStyle: 'default',
  },
}

export const viewport: Viewport = {
  themeColor: '#2563eb',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AppShell>{children}</AppShell>
        <PwaProvider />
      </body>
    </html>
  )
}
