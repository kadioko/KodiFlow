import Link from 'next/link'
import { Building2, Users, Receipt, TrendingUp, CheckCircle, ArrowRight } from 'lucide-react'
import { BrandLogo } from '@/components/brand/BrandLogo'

export default function LandingPage() {
  const currentYear = new Date().getFullYear()

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <BrandLogo href="/" size="sm" tone="dark" />
            <div className="flex items-center space-x-4">
              <Link href="/auth/login" className="text-gray-600 hover:text-gray-900">
                Sign in
              </Link>
              <Link href="/auth/register" className="btn-primary">
                Get started
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
              <span className="block">Property Management</span>
              <span className="block text-primary-600">Made Simple</span>
            </h1>
            <p className="mt-3 max-w-md mx-auto text-base text-gray-500 sm:text-lg md:mt-5 md:text-xl md:max-w-3xl">
              Manage residential and commercial properties with ease. Track rent, leases, tenants, and finances all in one place.
            </p>
            <div className="mt-5 max-w-md mx-auto sm:flex sm:justify-center md:mt-8">
              <Link href="/auth/register" className="btn-primary text-lg px-8 py-3">
                Start free trial
              </Link>
              <Link href="/auth/login" className="mt-3 sm:mt-0 sm:ml-3 btn-secondary text-lg px-8 py-3">
                Sign in
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
              Everything you need to manage properties
            </h2>
          </div>

          <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {/* Feature 1 */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="h-12 w-12 bg-primary-100 rounded-lg flex items-center justify-center">
                <Building2 className="h-6 w-6 text-primary-600" />
              </div>
              <h3 className="mt-4 text-lg font-medium text-gray-900">Property Management</h3>
              <p className="mt-2 text-gray-500">
                Manage residential, commercial, and mixed-use properties. Organize by sections and units.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="h-12 w-12 bg-success-100 rounded-lg flex items-center justify-center">
                <Users className="h-6 w-6 text-success-600" />
              </div>
              <h3 className="mt-4 text-lg font-medium text-gray-900">Tenant Management</h3>
              <p className="mt-2 text-gray-500">
                Track individual and business tenants. Store contact info, IDs, and lease details.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="h-12 w-12 bg-warning-100 rounded-lg flex items-center justify-center">
                <Receipt className="h-6 w-6 text-warning-600" />
              </div>
              <h3 className="mt-4 text-lg font-medium text-gray-900">Invoice & Payments</h3>
              <p className="mt-2 text-gray-500">
                Generate invoices automatically. Record payments and track outstanding balances.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-purple-600" />
              </div>
              <h3 className="mt-4 text-lg font-medium text-gray-900">Financial Reports</h3>
              <p className="mt-2 text-gray-500">
                View collection rates, outstanding balances, and property performance metrics.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="h-12 w-12 bg-danger-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-danger-600" />
              </div>
              <h3 className="mt-4 text-lg font-medium text-gray-900">Lease Tracking</h3>
              <p className="mt-2 text-gray-500">
                Monitor lease terms, expiry dates, and rent escalation schedules.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <ArrowRight className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="mt-4 text-lg font-medium text-gray-900">Easy to Use</h3>
              <p className="mt-2 text-gray-500">
                Clean, modern interface that works on desktop and mobile devices.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-primary-600 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-extrabold text-white">
            Ready to streamline your property management?
          </h2>
          <p className="mt-4 text-xl text-primary-100">
            Join property managers who use KodiFlow to manage their rentals.
          </p>
          <div className="mt-8">
            <Link href="/auth/register" className="inline-flex items-center px-8 py-3 border border-transparent text-base font-medium rounded-lg text-primary-600 bg-white hover:bg-primary-50">
              Get started for free
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
              &copy; {currentYear} KodiFlow. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
