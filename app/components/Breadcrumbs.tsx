'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const labelMap: Record<string, string> = {
  '/batch-oversattning': 'Optimering & översättning',
  '/fardiga-batchar': 'Färdiga uploads',
  '/installningar': 'Inställningar',
  '/': 'Start',
}

interface BreadcrumbsProps {
  currentPageTitle?: string
}

export default function Breadcrumbs({ currentPageTitle }: BreadcrumbsProps) {
  const pathname = usePathname()
  
  // Get the current page label from mapping or use provided title
  const currentLabel = currentPageTitle || labelMap[pathname] || 'Sida'
  
  // If we're on the start page, don't show breadcrumbs
  if (pathname === '/') {
    return null
  }
  
  // If the current route is not in our mapping, show TODO
  if (!labelMap[pathname] && !currentPageTitle) {
    console.warn(`TODO: Add route label for pathname: ${pathname}`)
  }

  return (
    <nav aria-label="Brödsmulor" className="breadcrumbs">
      <ol role="list" className="breadcrumbs-list">
        <li className="breadcrumbs-item">
          <Link href="/" className="breadcrumbs-link">
            Start
          </Link>
        </li>
        <li className="breadcrumbs-item breadcrumbs-current">
          <span aria-current="page" className="breadcrumbs-current-text">
            {currentLabel}
          </span>
        </li>
      </ol>
    </nav>
  )
}
