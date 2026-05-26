const CACHE_NAME = 'kodiflow-v2'
const OFFLINE_URLS = ['/', '/auth/login', '/manifest.webmanifest', '/icons/icon.svg']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(OFFLINE_URLS)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return

  const url = new URL(event.request.url)
  const isNavigation = event.request.mode === 'navigate'
  const canCache = url.origin === self.location.origin && (
    url.pathname === '/'
    || url.pathname.startsWith('/auth/')
    || url.pathname === '/manifest.webmanifest'
    || url.pathname.startsWith('/icons/')
    || url.pathname.startsWith('/_next/static/')
  )

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (canCache && response.ok) {
          const copy = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy))
        }
        return response
      })
      .catch(async () => {
        if (canCache) {
          const cached = await caches.match(event.request)
          if (cached) return cached
        }
        if (isNavigation) return caches.match('/auth/login')
        return Response.error()
      })
  )
})

self.addEventListener('push', (event) => {
  const data = event.data?.json() || {}
  event.waitUntil(
    self.registration.showNotification(data.title || 'KodiFlow Alert', {
      body: data.body || 'You have a new property management alert.',
      icon: '/icons/icon.svg',
      badge: '/icons/icon.svg',
      data: { url: data.url || '/dashboard' },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/dashboard'
  event.waitUntil(clients.openWindow(url))
})
