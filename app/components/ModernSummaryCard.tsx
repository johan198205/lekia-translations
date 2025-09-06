'use client'

interface ModernSummaryCardProps {
  title: string
  items: Array<{
    label: string
    value: string | number
  }>
  onDelete?: () => void
  showDelete?: boolean
}

export default function ModernSummaryCard({ title, items, onDelete, showDelete = false }: ModernSummaryCardProps) {
  return (
    <div className="modern-summary-card">
      <div className="summary-card-content">
        <div className="summary-card-header">
          <h3 className="summary-card-title">{title}</h3>
          {showDelete && onDelete && (
            <button
              onClick={onDelete}
              className="summary-card-delete"
              title="Radera"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </button>
          )}
        </div>
        <div className="summary-card-grid">
          {items.map((item, index) => (
            <div key={index} className="summary-card-item">
              <div className="summary-card-label">{item.label}</div>
              <div className="summary-card-value">{item.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
