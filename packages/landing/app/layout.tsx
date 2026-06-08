import type { Metadata } from "next"
import { IBM_Plex_Sans, JetBrains_Mono } from "next/font/google"
import { cn } from "@/lib/utils"
import "./globals.css"

const fontSans = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
})

const fontMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "700"],
})

export const metadata: Metadata = {
  title: "WriteMe: Just you and your thoughts",
  description:
    "A zero-distraction workspace for your mind. Privacy by design, focus by nature. Local-first, lightning-fast.",
  openGraph: {
    title: "WriteMe: Just you and your thoughts",
    description:
      "A zero-distraction workspace for your mind. Privacy by design, focus by nature. Local-first, lightning-fast.",
    type: "website",
    url: "https://app.writeme.dev",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased", fontSans.variable, fontMono.variable)}
    >
      <body>{children}</body>
    </html>
  )
}
