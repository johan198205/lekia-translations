'use client'

interface ProgressBarProps {
  percent: number
  done?: number
  total?: number
  counts?: {
    pending: number
    optimizing: number
    optimized: number
    translating: number
    completed: number
    error: number
  }
  startTime?: number | null
  jobType: 'product_texts' | 'ui_strings'
  phase: 'optimizing' | 'translating'
}

export default function ProgressBar({ 
  percent, 
  done = 0, 
  total = 0, 
  counts, 
  startTime, 
  jobType, 
  phase 
}: ProgressBarProps) {
  const getElapsedTime = () => {
    if (!startTime) return ''
    const elapsed = Math.floor((Date.now() - startTime) / 1000)
    const minutes = Math.floor(elapsed / 60)
    const seconds = elapsed % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const getProgressColor = () => {
    return phase === 'optimizing' ? 'bg-purple-600' : 'bg-blue-600'
  }

  const getPhaseLabel = () => {
    if (phase === 'optimizing') {
      return jobType === 'product_texts' ? 'Optimerar' : 'Bearbetar'
    } else {
      return jobType === 'product_texts' ? 'Översätter' : 'Bearbetar'
    }
  }

  const getItemLabel = () => {
    return jobType === 'product_texts' ? 'produkter' : 'UI-element'
  }

  return (
    <div className="progress-container">
      <div className="progress-bar">
        <div 
          className={`progress-fill ${getProgressColor()}`}
          style={{ width: `${percent}%` }}
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
      
      <div className="progress-info">
        <span className="progress-text">
          {percent}% klart ({done}/{total} {getItemLabel()})
        </span>
        {startTime && (
          <span className="progress-timer">
            Tid: {getElapsedTime()}
          </span>
        )}
      </div>
      
      {counts && (
        <div className="progress-counts">
          <div>Väntar: {counts.pending}</div>
          <div>{getPhaseLabel()}: {phase === 'optimizing' ? counts.optimizing : counts.translating}</div>
          <div>Klar: {phase === 'optimizing' ? counts.optimized : counts.completed}</div>
        </div>
      )}
    </div>
  )
}
