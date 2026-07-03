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
        <link rel="preload" as="font" href="/assets/fonts/spectral-sc-300.ttf" type="font/ttf" crossOrigin="anonymous" />
        <link rel="preload" as="font" href="/assets/fonts/spectral-sc-400.ttf" type="font/ttf" crossOrigin="anonymous" />
        <link rel="preload" as="font" href="/assets/fonts/roboto-condensed-300.ttf" type="font/ttf" crossOrigin="anonymous" />
        <link rel="preload" as="font" href="/assets/fonts/roboto-condensed-400.ttf" type="font/ttf" crossOrigin="anonymous" />
        <link rel="preload" as="font" href="/assets/fonts/roboto-condensed-600.ttf" type="font/ttf" crossOrigin="anonymous" />
        <link rel="stylesheet" href="/assets/fonts.css" />
        <link rel="stylesheet" href="/assets/styles.css" />
      </head>
      <body className="app-is-loading" suppressHydrationWarning>
        {children}
      </body>
    </html>
  )
}
