import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { PwaProvider } from '@/components/pwa/PwaProvider'
import { AppShell } from '@/components/layout/AppShell'
import { ThemeProvider, THEME_STORAGE_KEY } from '@/components/theme/ThemeProvider'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'KodiFlow - Property Management',
  description: 'Modern property management system for residential and commercial properties',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/icons/icon.svg',
    shortcut: '/icons/icon.svg',
    apple: '/icons/icon.svg',
  },
  appleWebApp: {
    capable: true,
    title: 'KodiFlow',
    statusBarStyle: 'default',
  },
}

export const viewport: Viewport = {
  themeColor: '#0f766e',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var storedTheme = localStorage.getItem('${THEME_STORAGE_KEY}');
                var theme = storedTheme === 'dark' || storedTheme === 'light'
                  ? storedTheme
                  : (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
                document.documentElement.classList.toggle('dark', theme === 'dark');
                document.documentElement.style.colorScheme = theme;
              } catch (error) {}
            `,
          }}
        />
        <ThemeProvider />
        <AppShell>{children}</AppShell>
        <PwaProvider />
      </body>
    </html>
  )
}
