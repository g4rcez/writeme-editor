import Image from "next/image"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { HexagonBackground } from "@/components/ui/hexagon"

const githubUrl = "https://github.com/g4rcez/writeme-editor"
const appUrl = "https://app.writeme.dev"

const features = [
  {
    label: "01",
    title: "Keyboard driven.",
    body: "Move through notes, tabs, search, and actions without leaving the keyboard.",
  },
  {
    label: "02",
    title: "AI assistant.",
    body: "Ask for structure, summaries, or help while staying inside your note.",
  },
  {
    label: "03",
    title: "Personal note taker.",
    body: "Keep daily notes, project ideas, snippets, tasks, and drafts in one place.",
  },
  {
    label: "04",
    title: "Read it later.",
    body: "Save links, turn them into notes, and return when you are ready.",
  },
  {
    label: "05",
    title: "Customization.",
    body: "Adjust themes, templates, panels, folders, shortcuts, and editor size.",
  },
  {
    label: "06",
    title: "Privacy first.",
    body: "Write Me is local-first. Your notes stay in formats you control.",
  },
]

export default function Page() {
  return (
    <main className="min-h-svh bg-background text-foreground">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:text-foreground focus:ring-1 focus:ring-ring"
      >
        Skip to main content
      </a>
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-sm">
        <nav
          className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5 sm:px-8"
          aria-label="Main navigation"
        >
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground"
          >
            <svg
              aria-hidden="true"
              className="h-6 w-auto shrink-0"
              fill="currentColor"
              focusable="false"
              viewBox="522 413 163 210"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="m527.912 458.028 33.346 20.489 -33.346 20.494v39.3l33.346 20.494 -33.346 20.489v39.199l62.897 -35.637v-48.107l-28.394 -16.085 28.394 -16.091v-48.107l-62.897 -35.637zm152.624 41.084v-0.102l-33.346 -20.494 33.346 -20.489v-39.199l-62.897 35.637v48.107l28.394 16.091 -28.394 16.085v48.107l62.897 35.637v-39.199l-33.346 -20.489 33.346 -20.494z" />
            </svg>
            Write Me
          </Link>
          <div className="hidden items-center gap-7 text-sm text-muted-foreground sm:flex">
            <a
              href="#features"
              className="transition-colors hover:text-foreground"
            >
              Features
            </a>
            <a
              href="#privacy"
              className="transition-colors hover:text-foreground"
            >
              Privacy
            </a>
            <a
              href={githubUrl}
              className="transition-colors hover:text-foreground"
            >
              GitHub
            </a>
          </div>
          <Button render={<a href={appUrl} />} nativeButton={false} size="sm">
            Start writing
          </Button>
        </nav>
      </header>

      <section
        id="main-content"
        className="relative isolate overflow-hidden border-b border-border"
      >
        <HexagonBackground
          hexagonSize={40}
          hexagonMargin={3}
          className="absolute inset-0 z-0 bg-background"
          glowColor="var(--primary)"
          borderColor="color-mix(in oklch, var(--primary-subtle) 48%, transparent)"
        />
        <div
          className="pointer-events-none absolute inset-0 z-0 bg-background/72"
          aria-hidden="true"
        />
        <div className="pointer-events-none relative z-10 mx-auto grid min-h-[calc(100svh-4rem)] w-full max-w-6xl items-center gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[0.92fr_1.08fr] lg:py-28">
          <div className="pointer-events-auto max-w-2xl">
            <p className="mb-2 font-mono text-sm text-emphasis">
              A place for your thoughts
            </p>
            <h1 className="text-5xl leading-[1.04] font-bold tracking-[-0.045em] text-balance text-foreground sm:text-6xl lg:text-7xl">
              Just you and your thoughts
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-pretty text-muted-foreground">
              A zero-distraction workspace for your mind. Privacy by design,
              focus by nature, integrated with AI by default.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Button
                size="lg"
                nativeButton={false}
                render={<a href={appUrl} />}
              >
                Start writing
              </Button>
              <Button
                size="lg"
                variant="outline"
                nativeButton={false}
                render={<a href={githubUrl} />}
              >
                View on GitHub
              </Button>
            </div>
          </div>
          <HeroScreenshot />
        </div>
      </section>
      <section
        id="features"
        className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8 lg:py-28"
      >
        <div className="max-w-2xl">
          <p className="font-mono text-xs tracking-[0.18em] text-emphasis uppercase">
            Product
          </p>
          <h2 className="mt-5 text-3xl font-semibold tracking-[-0.03em] text-foreground sm:text-5xl">
            Focused writing with power one gesture away.
          </h2>
        </div>

        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          {features.map((feature) => (
            <article
              key={feature.label}
              className="rounded-xl border border-border bg-card p-6 text-card-foreground"
            >
              <header className="flex items-center gap-2 font-semibold text-primary">
                <p className="font-bold">{feature.label}.</p>
                <h3 className="tracking-[-0.02em]">{feature.title}</h3>
              </header>
              <p className="mt-4 leading-7 text-muted-foreground">
                {feature.body}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-muted/45">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-20 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:py-28">
          <div>
            <p className="font-mono text-xs tracking-[0.18em] text-emphasis uppercase">
              Workflow
            </p>
            <h2 className="mt-5 text-3xl font-semibold tracking-[-0.03em] text-foreground sm:text-5xl">
              There is no blank page.
            </h2>
          </div>
          <div className="space-y-6 text-lg leading-8 text-muted-foreground">
            <p>
              Every thought you sit down to write already exists somewhere in
              your head. The editor&apos;s job is to get out of the way while
              you retrieve it.
            </p>
            <p>
              No toolbar competing for your attention. No sidebar unless you
              want one. Just a clean writing column, with structure and tools
              waiting exactly where you expect them.
            </p>
          </div>
        </div>
      </section>

      <section
        id="privacy"
        className="mx-auto grid w-full max-w-6xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[1fr_1fr] lg:py-28"
      >
        <div className="rounded-xl border border-border bg-card p-6 sm:p-8">
          <p className="font-mono text-xs tracking-[0.18em] text-emphasis uppercase">
            Privacy
          </p>
          <h2 className="mt-5 text-3xl font-semibold tracking-[-0.03em] text-card-foreground sm:text-5xl">
            Your data never leaves.
          </h2>
        </div>
        <div className="self-end text-lg leading-8 text-muted-foreground">
          <p>
            Write Me keeps ownership boring in the best way. Local-first notes,
            open formats, and a workspace designed so your private thinking can
            stay private.
          </p>
          <Button
            render={<a href={githubUrl} />}
            nativeButton={false}
            variant="outline"
            className="mt-8"
          >
            Star on GitHub
          </Button>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-5 pb-20 sm:px-8 lg:pb-28">
        <div className="rounded-2xl border border-border bg-card p-8 text-card-foreground sm:p-12 lg:p-16">
          <p className="font-mono text-xs tracking-[0.18em] text-emphasis uppercase">
            Start writing today
          </p>
          <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <h2 className="max-w-2xl text-3xl font-semibold tracking-[-0.03em] sm:text-5xl">
                Step into a zero-distraction environment.
              </h2>
              <p className="mt-5 max-w-xl text-lg leading-8 text-muted-foreground">
                Launch the web workspace now, or follow the native desktop app
                as it takes shape in the open.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <Button
                render={<a href={appUrl} />}
                nativeButton={false}
                size="lg"
              >
                Web app
              </Button>
              <Button
                render={<a href={githubUrl} />}
                nativeButton={false}
                variant="secondary"
                size="lg"
              >
                Desktop soon
              </Button>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>Write Me, the open-source editor for focus and privacy.</p>
          <div className="flex gap-5">
            <a
              href={githubUrl}
              className="transition-colors hover:text-foreground"
            >
              GitHub
            </a>
            <a
              href={appUrl}
              className="transition-colors hover:text-foreground"
            >
              Web app
            </a>
          </div>
        </div>
      </footer>
    </main>
  )
}

function HeroScreenshot() {
  return (
    <figure className="pointer-events-none overflow-hidden border border-border bg-card/80 p-1 shadow-[0_24px_90px_-48px_var(--primary-subtle)] ring-1 ring-primary/15 lg:translate-x-8 lg:scale-110">
      <Image
        priority
        width={3220}
        height={2108}
        src="/writeme-hero.png"
        sizes="(min-width: 1024px) 54vw, 100vw"
        className="aspect-video w-full object-cover object-top-left"
        alt="Write Me dashboard showing quick settings, recent documents, and favorite notes in a dark workspace."
      />
    </figure>
  )
}
