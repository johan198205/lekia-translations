'use client'

interface SummaryCardProps {
  title: string
  items: Array<{
    label: string
    value: string | number
  }>
  onDelete?: () => void
  showDelete?: boolean
}

export default function SummaryCard({ title, items, onDelete, showDelete = false }: SummaryCardProps) {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
      <div className="flex justify-between items-start mb-3">
        <h3 className="font-semibold text-blue-900">{title}</h3>
        {showDelete && onDelete && (
          <button
            onClick={onDelete}
            className="text-red-600 hover:text-red-800 text-sm"
            title="Radera"
          >
            🗑️
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        {items.map((item, index) => (
          <div key={index} className="flex justify-between">
            <span className="text-blue-700 font-medium">{item.label}:</span>
            <span className="text-blue-900">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
