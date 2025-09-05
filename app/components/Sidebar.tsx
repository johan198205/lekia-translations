'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function Sidebar() {
  const pathname = usePathname()

  const navItems = [
    { href: '/batch-oversattning', label: 'Batch-översättning' },
    { href: '/fardiga-batchar', label: 'Färdiga batchar' },
    { href: '/installningar', label: 'Inställningar' }
  ]

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="logo">
          {/* TODO: Replace with actual logo asset */}
          <div className="logo-placeholder">LEKIA</div>
        </div>
      </div>
      
      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-link ${pathname === item.href ? 'active' : ''}`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  )
}
