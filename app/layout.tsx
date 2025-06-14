import type { Metadata } from 'next'
import { ErrorBoundary } from '@/components/error-boundary'
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
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // 初始化全局错误处理器
              (function() {
                const ignoredSources = [
                  'chrome-extension://',
                  'moz-extension://',
                  'safari-extension://',
                  'edge-extension://',
                  'injectedScript',
                  'contentScript',
                  'not found method',
                  'Cannot set property selectedAddress',
                  'Cannot redefine property: solana',
                  'Cannot assign to read only property',
                  'Failed to inject',
                  'trying to intercept'
                ];
                
                function shouldIgnoreError(source) {
                  if (!source) return false;
                  return ignoredSources.some(ignored => source.includes(ignored));
                }
                
                // 捕获未处理的错误
                window.addEventListener('error', function(event) {
                  if (shouldIgnoreError(event.filename || event.message)) {
                    event.preventDefault();
                    event.stopPropagation();
                    return false;
                  }
                }, true);
                
                // 捕获Promise rejection
                window.addEventListener('unhandledrejection', function(event) {
                  if (shouldIgnoreError(event.reason?.message || String(event.reason))) {
                    event.preventDefault();
                    return false;
                  }
                });
              })();
            `,
          }}
        />
      </head>
      <body>
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </body>
    </html>
  )
}
