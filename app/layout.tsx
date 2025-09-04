import './globals.css'

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
      <body className="antialiased">{children}</body>
    </html>
  )
}
