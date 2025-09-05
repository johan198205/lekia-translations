'use client'

import { ReactNode } from 'react'
import Sidebar from './Sidebar'

interface AppShellProps {
  children: ReactNode
}

export default function AppShell({ children }: AppShellProps) {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-content">
        <header className="app-header">
          <div className="header-content">
            <h1 className="app-title">Lekia Produktöversättning</h1>
            <div className="header-actions">
              {/* Future: Add secondary actions here */}
            </div>
          </div>
        </header>
        <main className="app-main">
          {children}
        </main>
      </div>
    </div>
  )
}
