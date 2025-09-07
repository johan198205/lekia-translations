'use client'

interface StepperProps {
  currentStep: number
  steps: Array<{
    key: string
    label: string
  }>
}

export default function Stepper({ currentStep, steps }: StepperProps) {
  return (
    <div className="stepper-container">
      <nav role="list" aria-label="Steg för översättningsprocessen" className="stepper-nav">
        {steps.map((step, index) => {
          const stepNumber = index + 1
          const isCompleted = stepNumber < currentStep
          const isCurrent = stepNumber === currentStep
          const isUpcoming = stepNumber > currentStep
          
          return (
            <div
              key={step.key}
              role="listitem"
              className={`stepper-step ${isCompleted ? 'completed' : isCurrent ? 'current' : 'upcoming'}`}
              aria-current={isCurrent ? 'step' : undefined}
            >
              <div className="stepper-step-content">
                <div className="stepper-step-number">
                  {isCompleted ? (
                    <svg className="stepper-check-icon" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <span className="stepper-step-number-text">{stepNumber}</span>
                  )}
                </div>
                <span className="stepper-step-label">{step.label}</span>
              </div>
              {index < steps.length - 1 && (
                <div className="stepper-connector" />
              )}
            </div>
          )
        })}
      </nav>
    </div>
  )
}
