'use client'

import { ReactNode, useState, useRef, useEffect } from 'react'
import Sidebar from './Sidebar'
import Breadcrumbs from './Breadcrumbs'

interface AppShellProps {
  children: ReactNode
}

export default function AppShell({ children }: AppShellProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleUserMenuClick = () => {
    setIsDropdownOpen(!isDropdownOpen)
  }

  const handleEditAccount = () => {
    setIsDropdownOpen(false)
    // TODO: Implement edit account functionality
    console.log('Redigera konto clicked')
  }

  const handleLogout = () => {
    setIsDropdownOpen(false)
    // TODO: Implement logout functionality
    console.log('Logga ut clicked')
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-content">
        <header className="app-header">
          <div className="header-content">
            <Breadcrumbs />
            <div className="header-actions">
              <div className="user-menu" ref={dropdownRef}>
                <button 
                  className="user-menu-button"
                  onClick={handleUserMenuClick}
                  aria-label="Användarmeny"
                >
                  <svg className="user-icon" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                  </svg>
                </button>
                
                {isDropdownOpen && (
                  <div className="user-dropdown">
                    <button 
                      className="dropdown-item"
                      onClick={handleEditAccount}
                    >
                      <svg className="dropdown-icon" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                      </svg>
                      Redigera konto
                    </button>
                    <button 
                      className="dropdown-item"
                      onClick={handleLogout}
                    >
                      <svg className="dropdown-icon" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
                      </svg>
                      Logga ut
                    </button>
                  </div>
                )}
              </div>
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
