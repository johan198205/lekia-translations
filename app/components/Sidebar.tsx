'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function Sidebar() {
  const pathname = usePathname()

  const navItems = [
    { href: '/', label: 'Start', icon: '🏠' },
    { href: '/batch-oversattning', label: 'Optimering & översättning', icon: '⚙️' },
    { href: '/fardiga-batchar', label: 'Färdiga uploads', icon: '📋' },
    { href: '/installningar', label: 'Inställningar', icon: '⚙️' }
  ]

  return (
    <div className="sidebar">
      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-link ${pathname === item.href ? 'active' : ''}`}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  )
}
