'use client'

import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()

  const handleJobTypeSelect = (jobType: 'product_texts' | 'ui_strings') => {
    // Navigate to batch-oversattning with job type
    router.push(`/batch-oversattning?jobType=${jobType}`)
  }

  return (
    <div className="start-page">
      <div className="start-content">
        <div className="start-header">
          <h1 className="start-title">Välj jobbtyp</h1>
          <p className="start-subtitle">Välj vilken typ av översättningsjobb du vill starta</p>
        </div>
        
        <div className="job-type-cards">
          <div 
            className="job-type-card"
            onClick={() => handleJobTypeSelect('product_texts')}
          >
            <div className="card-icon">📦</div>
            <h2 className="card-title">Produkttexter</h2>
            <p className="card-description">
              Optimera och översätt produktbeskrivningar från svenska till norska och danska.
              Perfekt för e-handelsprodukter som behöver förbättrade beskrivningar.
            </p>
            <div className="card-features">
              <span className="feature">✓ AI-optimering</span>
              <span className="feature">✓ Norsk översättning</span>
              <span className="feature">✓ Dansk översättning</span>
            </div>
            <button className="card-cta">
              Starta produktöversättning
            </button>
          </div>

          <div 
            className="job-type-card"
            onClick={() => handleJobTypeSelect('ui_strings')}
          >
            <div className="card-icon">🌐</div>
            <h2 className="card-title">UI-element</h2>
            <p className="card-description">
              Översätt webbplatstexter och användargränssnitt från svenska till norska.
              Ideal för knappar, menyer och andra gränssnittselement.
            </p>
            <div className="card-features">
              <span className="feature">✓ Norsk översättning</span>
              <span className="feature">✓ Snabb bearbetning</span>
              <span className="feature">✓ Strukturerad export</span>
            </div>
            <button className="card-cta">
              Starta UI-översättning
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
