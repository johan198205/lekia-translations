'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()
  
  useEffect(() => {
    // Omdirigera till batch-översättning som standard
    router.push('/batch-oversattning')
  }, [router])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Omdirigerar till batch-översättning...
        </h1>
        <p className="text-gray-600">
          Om du inte omdirigeras automatiskt, 
          <a href="/batch-oversattning" className="text-blue-600 hover:underline ml-1">
            klicka här
          </a>
        </p>
      </div>
    </div>
  )
}
