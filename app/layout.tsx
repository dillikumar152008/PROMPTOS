import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';

export const metadata: Metadata = {
  title: 'PromptOS — Turn Plain English into Single-Purpose AI Mini-Apps',
  description: 'High-end engineering platform where creators deploy AI micro-utilities from plain English, and users run them in restricted, zero-distraction runtimes.',
  icons: {
    icon: '/favicon.svg',
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`dark ${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-screen bg-[#09090b] text-[#fafafa] font-sans antialiased selection:bg-zinc-800 selection:text-white">
        {children}
      </body>
    </html>
  );
}
