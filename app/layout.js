import './globals.css';

export const metadata = {
  title: 'KimiTV Beta — Download for Windows & Linux',
  description: 'Download the latest KimiTV Beta desktop app. Fast, clean media player built for binge watching. Available for Windows and Linux.',
  keywords: 'KimiTV, desktop app, media player, Windows, Linux, download, beta',
  openGraph: {
    title: 'KimiTV Beta — Download for Desktop',
    description: 'Fast. Clean. Built for binge watching. Download KimiTV Beta for Windows and Linux.',
    type: 'website',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
