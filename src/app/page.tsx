'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Building2, CheckCircle, Globe2, Receipt, TrendingUp, Users } from 'lucide-react'
import { BrandLogo } from '@/components/brand/BrandLogo'
import { normalizeLanguage, type LanguageCode } from '@/utils/i18n'
import { getLanguagePreference, storeLanguagePreference } from '@/utils/language-preference'

const pageCopy = {
  en: {
    language: 'Language', signIn: 'Sign in', getStarted: 'Get started', heroTitle: 'Property Management', heroAccent: 'Made Simple',
    heroDescription: 'Manage residential and commercial properties with ease. Track rent, leases, tenants, and finances all in one place.',
    startTrial: 'Start free trial', featuresHeading: 'Everything you need to manage properties',
    features: [
      ['Property Management', 'Manage residential, commercial, and mixed-use properties. Organize by sections and units.'],
      ['Tenant Management', 'Track individual and business tenants. Store contact info, IDs, and lease details.'],
      ['Invoices & Payments', 'Generate invoices. Record payments and track outstanding balances.'],
      ['Financial Reports', 'View collection rates, outstanding balances, and property performance metrics.'],
      ['Lease Tracking', 'Monitor lease terms, expiry dates, and rent escalation schedules.'],
      ['Easy to Use', 'A clear, modern interface that works on desktop and mobile devices.'],
    ],
    ctaTitle: 'Ready to streamline your property management?', ctaDescription: 'Join property managers who use KodiFlow to manage their rentals.',
    getStartedFree: 'Get started for free', rights: 'All rights reserved.',
  },
  sw: {
    language: 'Lugha', signIn: 'Ingia', getStarted: 'Anza kutumia', heroTitle: 'Usimamizi wa Majengo', heroAccent: 'Kwa Urahisi',
    heroDescription: 'Simamia makazi na majengo ya biashara kwa urahisi. Fuatilia kodi, mikataba, wapangaji na fedha sehemu moja.',
    startTrial: 'Anza kipindi cha majaribio', featuresHeading: 'Kila unachohitaji kusimamia majengo',
    features: [
      ['Usimamizi wa Majengo', 'Simamia makazi, biashara na majengo mchanganyiko. Panga kwa sehemu na vyumba.'],
      ['Usimamizi wa Wapangaji', 'Fuatilia wapangaji binafsi na wa biashara. Hifadhi mawasiliano na taarifa za mikataba.'],
      ['Ankara na Malipo', 'Tengeneza ankara, rekodi malipo na fuatilia madeni yaliyobaki.'],
      ['Ripoti za Fedha', 'Angalia makusanyo, madeni yaliyobaki na mwenendo wa majengo.'],
      ['Ufuatiliaji wa Mikataba', 'Fuatilia masharti ya mikataba, tarehe za mwisho na mabadiliko ya kodi.'],
      ['Rahisi Kutumia', 'Muonekano ulio wazi na wa kisasa unaofanya kazi kwenye simu na kompyuta.'],
    ],
    ctaTitle: 'Uko tayari kurahisisha usimamizi wa majengo?', ctaDescription: 'Jiunge na wasimamizi wanaotumia KodiFlow kusimamia nyumba zao za kupangisha.',
    getStartedFree: 'Anza bila malipo', rights: 'Haki zote zimehifadhiwa.',
  },
} as const

const featureIcons = [Building2, Users, Receipt, TrendingUp, CheckCircle, ArrowRight]

export default function LandingPage() {
  const currentYear = new Date().getFullYear()
  const [language, setLanguage] = useState<LanguageCode>('en')
  const [hasLanguagePreference, setHasLanguagePreference] = useState(false)
  const copy = pageCopy[language]

  useEffect(() => {
    const preferredLanguage = getLanguagePreference()
    if (preferredLanguage) {
      setLanguage(preferredLanguage)
      setHasLanguagePreference(true)
    }
  }, [])

  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  const chooseLanguage = (nextLanguage: LanguageCode) => {
    setLanguage(nextLanguage)
    setHasLanguagePreference(true)
    storeLanguagePreference(nextLanguage)
  }
  const loginHref = hasLanguagePreference ? `/auth/login?lang=${language}` : '/auth/login'
  const registerHref = hasLanguagePreference ? `/auth/register?lang=${language}` : '/auth/register'

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex min-h-16 flex-wrap items-center justify-between gap-2 py-2 sm:h-16 sm:py-0">
            <BrandLogo href="/" size="sm" tone="dark" />
            <div className="flex items-center gap-2 sm:gap-4">
              <label htmlFor="landing-language" className="sr-only">{copy.language}</label>
              <span className="flex items-center gap-1.5 text-gray-500" aria-hidden="true"><Globe2 className="h-4 w-4" /><span className="sr-only">{copy.language}</span></span>
              <select id="landing-language" className="min-h-10 max-w-28 rounded-md border border-gray-300 bg-white px-2 text-sm text-gray-800" value={language} onChange={(event) => chooseLanguage(normalizeLanguage(event.target.value))}>
                <option value="en">English</option>
                <option value="sw">Kiswahili</option>
              </select>
              <Link href={loginHref} className="whitespace-nowrap text-sm text-gray-600 hover:text-gray-900">
                {copy.signIn}
              </Link>
              <Link href={registerHref} className="btn-primary whitespace-nowrap px-3 py-2 text-sm">
                {copy.getStarted}
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-24">
          <div className="text-center">
            <h1 className="text-4xl tracking-tight font-extrabold text-gray-900 sm:text-5xl md:text-6xl">
              <span className="block">{copy.heroTitle}</span>
              <span className="block text-primary-600">{copy.heroAccent}</span>
            </h1>
            <p className="mt-3 max-w-md mx-auto text-base text-gray-500 sm:text-lg md:mt-5 md:text-xl md:max-w-3xl">
              {copy.heroDescription}
            </p>
            <div className="mt-5 max-w-md mx-auto sm:flex sm:justify-center md:mt-8">
              <Link href={registerHref} className="btn-primary text-lg px-8 py-3">
                {copy.startTrial}
              </Link>
              <Link href={loginHref} className="mt-3 sm:mt-0 sm:ml-3 btn-secondary text-lg px-8 py-3">
                {copy.signIn}
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="bg-gray-50 py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-extrabold text-gray-900">
              {copy.featuresHeading}
            </h2>
          </div>

          <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {copy.features.map(([title, description], index) => {
              const Icon = featureIcons[index]
              const iconTones = ['text-primary-600 bg-primary-100', 'text-success-600 bg-success-100', 'text-warning-600 bg-warning-100', 'text-purple-600 bg-purple-100', 'text-danger-600 bg-danger-100', 'text-blue-600 bg-blue-100']
              return <div key={title} className="rounded-lg bg-white p-6 shadow-sm">
                <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${iconTones[index]}`}><Icon className="h-6 w-6" /></div>
                <h3 className="mt-4 text-lg font-medium text-gray-900">{title}</h3>
                <p className="mt-2 text-gray-500">{description}</p>
              </div>
            })}
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-primary-600 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-extrabold text-white">
            {copy.ctaTitle}
          </h2>
          <p className="mt-4 text-xl text-primary-100">
            {copy.ctaDescription}
          </p>
          <div className="mt-8">
            <Link href={registerHref} className="inline-flex items-center rounded-lg border border-transparent bg-white px-8 py-3 text-base font-medium text-primary-600 hover:bg-primary-50">
              {copy.getStartedFree}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <BrandLogo href="/" size="sm" tone="light" />
            <p className="text-gray-400 text-sm">
              &copy; {currentYear} KodiFlow. {copy.rights}
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
