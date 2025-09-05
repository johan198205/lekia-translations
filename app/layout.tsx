import './globals.css'
import Sidebar from './components/Sidebar'

export const metadata = {
  title: 'Lekia Produktöversättning',
  description: 'Verktyg för produktöversättning med AI-optimering',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="sv" suppressHydrationWarning>
      <body className="antialiased">
        <div className="app-layout">
          <Sidebar />
          <main className="main-content">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
