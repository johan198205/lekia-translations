'use client'

import { ReactNode } from 'react'

interface RadioCardProps {
  id: string
  name: string
  value: string
  checked: boolean
  onChange: (value: string) => void
  title: string
  description: string
  icon?: string
  children?: ReactNode
}

export default function RadioCard({ 
  id, 
  name, 
  value, 
  checked, 
  onChange, 
  title, 
  description, 
  icon,
  children 
}: RadioCardProps) {
  return (
    <div 
      className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
        checked 
          ? 'border-blue-500 bg-blue-50' 
          : 'border-gray-200 hover:border-gray-300'
      }`}
      onClick={() => onChange(value)}
    >
      <div className="flex items-start gap-3">
        <input
          type="radio"
          id={id}
          name={name}
          value={value}
          checked={checked}
          onChange={() => onChange(value)}
          className="mt-1"
        />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            {icon && <span className="text-lg">{icon}</span>}
            <label htmlFor={id} className="font-semibold text-gray-900 cursor-pointer">
              {title}
            </label>
          </div>
          <p className="text-sm text-gray-600 mb-3">{description}</p>
          {children}
        </div>
      </div>
    </div>
  )
}
