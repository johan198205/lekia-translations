'use client'

import { ReactNode } from 'react'

interface StepCardProps {
  title: string
  children: ReactNode
  isActive?: boolean
  className?: string
}

export default function StepCard({ title, children, isActive = true, className = '' }: StepCardProps) {
  return (
    <div className={`bg-white rounded-lg shadow-md p-6 mb-6 ${!isActive ? 'opacity-50' : ''} ${className}`}>
      <h2 className="text-xl font-semibold mb-4">{title}</h2>
      {children}
    </div>
  )
}
