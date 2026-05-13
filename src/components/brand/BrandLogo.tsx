import Link from 'next/link'

type BrandLogoSize = 'sm' | 'md' | 'lg'
type BrandLogoVariant = 'lockup' | 'mark'
type BrandLogoTone = 'light' | 'dark'

interface BrandLogoProps {
  href?: string
  size?: BrandLogoSize
  variant?: BrandLogoVariant
  tone?: BrandLogoTone
  className?: string
  priorityLabel?: string
}

const sizeStyles = {
  sm: {
    mark: 'h-8 w-8',
    word: 'text-lg',
    gap: 'gap-2',
  },
  md: {
    mark: 'h-10 w-10',
    word: 'text-xl',
    gap: 'gap-2.5',
  },
  lg: {
    mark: 'h-14 w-14',
    word: 'text-3xl',
    gap: 'gap-3',
  },
}

const toneStyles = {
  light: {
    word: 'text-white',
    tagline: 'text-white/58',
  },
  dark: {
    word: 'text-slate-950',
    tagline: 'text-slate-500',
  },
}

export function BrandLogo({
  href,
  size = 'md',
  variant = 'lockup',
  tone = 'dark',
  className = '',
  priorityLabel,
}: BrandLogoProps) {
  const styles = sizeStyles[size]
  const tones = toneStyles[tone]
  const label = priorityLabel ?? 'KodiFlow'

  const logo = (
    <span className={`inline-flex min-w-0 items-center ${styles.gap} ${className}`} aria-label={label}>
      <BrandMark className={styles.mark} />
      {variant === 'lockup' && (
        <span className="min-w-0 leading-none">
          <span className={`block font-black ${styles.word} ${tones.word}`}>KodiFlow</span>
          {size !== 'sm' && (
            <span className={`mt-1 block text-[0.68rem] font-bold uppercase ${tones.tagline}`}>
              Property command
            </span>
          )}
        </span>
      )}
    </span>
  )

  if (!href) {
    return logo
  }

  return (
    <Link href={href} className="inline-flex min-w-0 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary-200">
      {logo}
    </Link>
  )
}

function BrandMark({ className }: { className?: string }) {
  return (
    <span className={`relative inline-flex shrink-0 ${className}`}>
      <svg viewBox="0 0 64 64" role="img" aria-hidden="true" className="h-full w-full drop-shadow-sm">
        <defs>
          <linearGradient id="kodiflow-mark-gradient" x1="12" x2="54" y1="8" y2="58" gradientUnits="userSpaceOnUse">
            <stop stopColor="#14b8a6" />
            <stop offset="0.52" stopColor="#2563eb" />
            <stop offset="1" stopColor="#0f172a" />
          </linearGradient>
          <linearGradient id="kodiflow-flow-gradient" x1="17" x2="49" y1="44" y2="20" gradientUnits="userSpaceOnUse">
            <stop stopColor="#facc15" />
            <stop offset="1" stopColor="#ffffff" />
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx="16" fill="url(#kodiflow-mark-gradient)" />
        <path
          d="M17 43.5c8.2 2 14.3.1 18.7-5.7l2.1-2.8c3.3-4.4 6.2-6.8 11.2-6.8"
          fill="none"
          stroke="url(#kodiflow-flow-gradient)"
          strokeLinecap="round"
          strokeWidth="5"
        />
        <path d="M19 44V20h6v9.7L35 20h7.7L31.4 31l12.2 13H36l-9.1-10.2L25 35.6V44h-6Z" fill="#fff" />
        <path d="M42 44V20h7v24h-7Z" fill="#dbeafe" opacity="0.92" />
      </svg>
    </span>
  )
}
