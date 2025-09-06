'use client'

import { ReactNode } from 'react'

interface ModernRadioCardProps {
  id: string
  name: string
  value: string
  checked: boolean
  onChange: (value: string) => void
  title: string
  description: string
  icon: string
  children?: ReactNode
}

export default function ModernRadioCard({ 
  id, 
  name, 
  value, 
  checked, 
  onChange, 
  title, 
  description, 
  icon,
  children 
}: ModernRadioCardProps) {
  return (
    <div 
      className={`modern-radio-card ${checked ? 'selected' : ''}`}
      onClick={() => onChange(value)}
    >
      <div className="radio-card-content">
        <input
          type="radio"
          id={id}
          name={name}
          value={value}
          checked={checked}
          onChange={() => onChange(value)}
          className="sr-only"
        />
        <div className="radio-card-icon">{icon}</div>
        <div className="radio-card-info">
          <h3 className="radio-card-title">{title}</h3>
          <p className="radio-card-description">{description}</p>
          {children}
        </div>
      </div>
    </div>
  )
}
