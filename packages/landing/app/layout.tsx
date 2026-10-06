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
  title: "Write Me — a space to think",
  description:
    "A local-first writing app for notes, drafts, and ideas, with Markdown, search, keyboard shortcuts, and AI assistance on web and desktop.",
  openGraph: {
    title: "Write Me — a space to think",
    description:
      "A local-first writing app for notes, drafts, and ideas, with Markdown, search, keyboard shortcuts, and AI assistance on web and desktop.",
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
      className={cn("antialiased", fontSans.variable, fontMono.variable)}
    >
      <body>{children}</body>
    </html>
  )
}
