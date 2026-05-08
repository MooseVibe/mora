import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Мора',
  description: 'Ежедневный таро-ритуал',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ru">
      <head>
        <link rel="preload" as="image" href="/assets/cards/moose.webp" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&family=Neucha&family=Raleway:wght@200;300;400&display=swap"
          rel="stylesheet"
        />
        <link rel="stylesheet" href="/assets/styles.css" />
      </head>
      <body className="app-is-loading" suppressHydrationWarning>
        {children}
      </body>
    </html>
  )
}
