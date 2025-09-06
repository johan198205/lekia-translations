'use client'

import { ReactNode } from 'react'

interface WizardProps {
  children: ReactNode
  title: string
  currentStep: number
  totalSteps: number
  steps: Array<{
    number: number
    label: string
    isActive: boolean
    isCompleted: boolean
  }>
}

export default function Wizard({ children, title, currentStep, totalSteps, steps }: WizardProps) {
  return (
    <div className="wizard-container">
      <div className="wizard-header">
        <h1 className="wizard-title">{title}</h1>
        <div className="wizard-steps">
          {steps.map((step) => (
            <div 
              key={step.number} 
              className={`step ${step.isActive ? 'active' : step.isCompleted ? 'completed' : ''}`}
            >
              <span className="step-number">{step.number}</span>
              <span className="step-label">{step.label}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="wizard-content">
        {children}
      </div>
    </div>
  )
}
