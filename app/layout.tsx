import './globals.css'
import AppShell from './components/AppShell'

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
        <AppShell>
          {children}
        </AppShell>
      </body>
    </html>
  )
}
