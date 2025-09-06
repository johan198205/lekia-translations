'use client'

import { ReactNode } from 'react'

interface ModernStepCardProps {
  stepNumber: number
  title: string
  description: string
  icon: string
  children: ReactNode
  isActive?: boolean
  isCompleted?: boolean
  ctaText?: string
  onCtaClick?: () => void
  ctaDisabled?: boolean
  className?: string
}

export default function ModernStepCard({ 
  stepNumber,
  title, 
  description,
  icon,
  children, 
  isActive = false,
  isCompleted = false,
  ctaText,
  onCtaClick,
  ctaDisabled = false,
  className = '' 
}: ModernStepCardProps) {
  return (
    <div className={`modern-step-card ${isActive ? 'active' : isCompleted ? 'completed' : 'inactive'} ${className}`}>
      <div className="step-header">
        <div className="step-icon">
          <span className="step-number">{stepNumber}</span>
          <span className="step-emoji">{icon}</span>
        </div>
        <div className="step-info">
          <h2 className="step-title">{title}</h2>
          <p className="step-description">{description}</p>
        </div>
      </div>
      
      <div className="step-content">
        {children}
      </div>
      
      {ctaText && onCtaClick && (
        <div className="step-footer">
          <button
            onClick={onCtaClick}
            disabled={ctaDisabled}
            className="step-cta"
          >
            {ctaText}
          </button>
        </div>
      )}
    </div>
  )
}
