import React from "react"
import type { Metadata, Viewport } from 'next'
import { DM_Sans, Source_Serif_4, JetBrains_Mono } from 'next/font/google'

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: '--font-dm-sans',
  display: 'swap',
});

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: '--font-source-serif',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: '--font-jetbrains-dash',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'IRIS X — Solar Flare Dashboard',
  description: 'Real-time Aditya-L1 solar flare telemetry, metrics, and incident response dashboard.',
}

export const viewport: Viewport = {
  themeColor: '#0D9488',
  width: 'device-width',
  initialScale: 1,
}

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <div
      className={`${dmSans.variable} ${sourceSerif.variable} ${jetbrainsMono.variable} font-sans antialiased`}
    >
      {children}
    </div>
  )
}
