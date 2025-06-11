import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Binance Alpha Tool - 空投历史与收益计算器',
  description: 'Binance Alpha 空投历史记录、收益计算器、积分规则详解工具',
  icons: {
    icon: [
      {
        url: '/favicon-16x16.svg',
        sizes: '16x16',
        type: 'image/svg+xml',
      },
      {
        url: '/favicon.svg',
        sizes: '32x32',
        type: 'image/svg+xml',
      },
      {
        url: '/favicon.ico',
        sizes: '48x48',
        type: 'image/x-icon',
      },
    ],
    shortcut: '/favicon-16x16.svg',
    apple: '/favicon.svg',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon-16x16.svg" type="image/svg+xml" sizes="16x16" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" sizes="32x32" />
        <link rel="shortcut icon" href="/favicon-16x16.svg" />
      </head>
      <body>{children}</body>
    </html>
  )
}
