import Image from "next/image"
import Link from "next/link"
import { AppleLogoIcon } from "@phosphor-icons/react/dist/ssr/AppleLogo"
import { LinuxLogoIcon } from "@phosphor-icons/react/dist/ssr/LinuxLogo"
import { WindowsLogoIcon } from "@phosphor-icons/react/dist/ssr/WindowsLogo"
import { Button, buttonVariants } from "@/components/ui/button"
import { HexagonBackground } from "@/components/ui/hexagon"

const githubUrl = "https://github.com/g4rcez/writeme-editor"
const appUrl = "https://app.writeme.dev"
const releaseVersion = "1.1.0"
const releaseAssetsUrl = `${githubUrl}/releases/download/v${releaseVersion}`
const releaseNotesUrl = `${githubUrl}/blob/v${releaseVersion}/CHANGELOG.md`
const releasePageUrl = `${githubUrl}/releases/tag/v${releaseVersion}`

const platformDownloads = [
    {
        name: "Windows",
        icon: WindowsLogoIcon,
        details: "Windows · x64",
        files: [
            {
                label: "Download Windows .exe",
                href: `${releaseAssetsUrl}/writeme-${releaseVersion}-setup.exe`,
            },
        ],
    },
    {
        name: "macOS",
        icon: AppleLogoIcon,
        details: "Apple Silicon · ARM64",
        files: [
            {
                label: "Download macOS .dmg",
                href: `${releaseAssetsUrl}/writeme-${releaseVersion}-arm64-unsigned.dmg`,
            },
        ],
    },
    {
        name: "Linux",
        icon: LinuxLogoIcon,
        details: "Linux · x64",
        files: [
            {
                label: "Download Linux .deb",
                href: `${releaseAssetsUrl}/writeme-${releaseVersion}-amd64.deb`,
            },
            {
                label: "Download Linux .rpm",
                href: `${releaseAssetsUrl}/writeme-${releaseVersion}-x86_64.rpm`,
            },
        ],
    },
]

const features = [
    {
        title: "Keep your hands on the keyboard.",
        body: "Move between notes, tabs, search, and actions without reaching for the mouse.",
    },
    {
        title: "Get help in the same note.",
        body: "Ask the AI assistant for structure, a summary, or a way forward without switching away.",
    },
    {
        title: "Give each thought a place.",
        body: "Keep daily notes, project ideas, snippets, tasks, and drafts together.",
    },
    {
        title: "Save the useful links.",
        body: "Turn an article into a clean note and pick it up when you have the time.",
    },
    {
        title: "Set up the space your way.",
        body: "Adjust themes, templates, panels, folders, shortcuts, and editor size.",
    },
    {
        title: "Keep your notes in your hands.",
        body: "Choose filesystem or database storage, and keep your writing in formats you control.",
    },
]

export default function Page() {
    return (
        <main className="min-h-svh bg-background text-foreground">
            <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-3 focus:text-sm focus:font-medium focus:text-foreground focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
            >
                Skip to main content
            </a>
            <header className="sticky top-0 z-40 border-b border-border/80 bg-background/90 backdrop-blur-md">
                <nav
                    className="mx-auto flex h-[4.5rem] w-full max-w-[88rem] items-center justify-between px-5 sm:px-8 lg:px-12"
                    aria-label="Main navigation"
                >
                    <Link
                        href="/"
                        className="flex items-center gap-2.5 text-sm font-semibold tracking-[-0.02em] text-foreground"
                    >
                        <svg
                            aria-hidden="true"
                            className="h-7 w-auto shrink-0 text-primary"
                            fill="currentColor"
                            focusable="false"
                            viewBox="522 413 163 210"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <path d="m527.912 458.028 33.346 20.489 -33.346 20.494v39.3l33.346 20.494 -33.346 20.489v39.199l62.897 -35.637v-48.107l-28.394 -16.085 28.394 -16.091v-48.107l-62.897 -35.637zm152.624 41.084v-0.102l-33.346 -20.494 33.346 -20.489v-39.199l-62.897 35.637v48.107l28.394 16.091 -28.394 16.085v48.107l62.897 35.637v-39.199l-33.346 -20.489 33.346 -20.494z" />
                        </svg>
                        <span>Write Me</span>
                    </Link>

                    <div className="hidden items-center gap-8 text-base text-muted-foreground sm:flex">
                        <a href="#features" className="transition-colors hover:text-primary">
                            Features
                        </a>
                        <a href="#privacy" className="transition-colors hover:text-primary">
                            Privacy
                        </a>
                        <a href="#downloads" className="transition-colors hover:text-primary">
                            Downloads
                        </a>
                        <a href={githubUrl} className="transition-colors hover:text-primary">
                            GitHub
                        </a>
                    </div>

                    <Button
                        size="sm"
                        nativeButton={false}
                        render={<a href={appUrl} />}
                        className="h-10 rounded-full px-4 text-sm"
                    >
                        Start writing
                    </Button>
                </nav>
            </header>

            <section
                id="main-content"
                aria-labelledby="hero-title"
                className="hero-field relative isolate overflow-hidden border-b border-border"
            >
                <HexagonBackground
                    hexagonSize={72}
                    hexagonMargin={4}
                    className="absolute inset-0 z-0 bg-background"
                    glowColor="color-mix(in oklch, var(--emphasis) 100%, transparent)"
                    borderColor="color-mix(in oklch, var(--emphasis) 2%, transparent)"
                />
                <div className="hero-wash pointer-events-none absolute inset-0 z-0" aria-hidden="true" />

                <div className="pointer-events-none relative z-10 mx-auto grid min-h-[calc(100svh-4.5rem)] w-full max-w-[88rem] items-center gap-12 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[0.82fr_1.18fr] lg:gap-14 lg:px-12 lg:py-16">
                    <div className="pointer-events-auto max-w-[34rem]">
                        <h1
                            id="hero-title"
                            className="text-[clamp(3.5rem,7.1vw,7rem)] leading-[0.94] font-semibold tracking-[-0.04em] text-balance text-foreground"
                        >
                            <span className="block">Make space</span>
                            <span className="block text-primary">to think.</span>
                        </h1>
                        <p className="mt-7 max-w-[34rem] text-base leading-7 text-pretty text-muted-foreground sm:text-lg sm:leading-8">
                            Keep notes, drafts, and passing ideas in one workspace. Search,
                            shortcuts, and an AI assistant are there when you need them.
                        </p>
                        <div className="mt-8 flex flex-col gap-3 min-[420px]:flex-row">
                            <Button
                                render={<a href={appUrl} />}
                                nativeButton={false}
                                size="lg"
                                className="h-12 rounded-full px-6 text-sm font-semibold"
                            >
                                Start writing
                                <ArrowUpRight />
                            </Button>
                            <a
                                href="#downloads"
                                className="inline-flex min-h-12 items-center justify-center rounded-full border border-border px-6 py-3 text-sm font-medium text-foreground transition-[background-color,color] duration-200 ease-out hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
                            >
                                Download desktop
                            </a>
                        </div>
                        <p className="mt-7 text-sm text-muted-foreground">
                            Local-first notes <span aria-hidden="true">·</span> Markdown
                            <span aria-hidden="true">·</span> Web and desktop
                        </p>
                    </div>

                    <HeroScreenshot />
                </div>
            </section>
            <section
                id="features"
                aria-labelledby="features-title"
                className="mx-auto w-full max-w-[88rem] px-5 py-20 sm:px-8 sm:py-28 lg:px-12 lg:py-36"
            >
                <div className="grid gap-6 pb-10 md:grid-cols-[0.92fr_1.08fr] md:items-end md:gap-12">
                    <h2
                        id="features-title"
                        className="max-w-2xl text-4xl leading-[1.02] font-semibold tracking-[-0.035em] text-balance sm:text-5xl lg:text-6xl"
                    >
                        The useful things are close. The rest can wait.
                    </h2>
                    <p className="max-w-xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
                        Some thoughts arrive finished. Most don&apos;t. Write Me gives your
                        notes, drafts, links, and tasks room to stay together.
                    </p>
                </div>

                <div className="mt-4 border-t border-border">
                    {features.map((feature) => (
                        <article
                            key={feature.title}
                            className="grid gap-x-10 gap-y-2 border-b border-border py-6 sm:py-7 md:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] md:items-baseline"
                        >
                            <h3 className="text-lg font-medium tracking-[-0.02em] text-foreground sm:text-xl">
                                {feature.title}
                            </h3>
                            <p className="max-w-2xl leading-7 text-muted-foreground">
                                {feature.body}
                            </p>
                        </article>
                    ))}
                </div>
            </section>

            <section className="border-y border-border bg-muted/55">
                <div className="mx-auto grid w-full max-w-[88rem] gap-8 px-5 py-20 sm:px-8 sm:py-28 md:grid-cols-[0.92fr_1.08fr] md:gap-16 lg:px-12 lg:py-32">
                    <h2 className="max-w-xl text-4xl leading-[1.02] font-semibold tracking-[-0.035em] text-balance sm:text-5xl lg:text-6xl">
                        Start with the thought. Find the shape later.
                    </h2>
                    <div className="max-w-2xl self-end space-y-5 text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
                        <p>
                            A quick note doesn&apos;t need a perfect outline. Write it down,
                            leave it where you can find it, and come back when it asks for
                            more.
                        </p>
                        <p>
                            When you need a hand, ask the assistant for a structure or a
                            summary from inside the note. The writing stays yours; the next
                            step stays close.
                        </p>
                    </div>
                </div>
            </section>

            <section
                id="privacy"
                aria-labelledby="privacy-title"
                className="mx-auto grid w-full max-w-[88rem] gap-8 px-5 py-20 sm:px-8 sm:py-28 md:grid-cols-[0.92fr_1.08fr] md:gap-16 lg:px-12 lg:py-32"
            >
                <div>
                    <h2
                        id="privacy-title"
                        className="max-w-xl text-4xl leading-[1.02] font-semibold tracking-[-0.035em] text-balance sm:text-5xl lg:text-6xl"
                    >
                        Your notes stay yours.
                    </h2>
                </div>
                <div className="max-w-2xl self-end text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
                    <p>
                        Write Me is local-first, with filesystem and database-backed storage
                        and notes in formats you can control. When you use the AI assistant,
                        requests go to the provider you&apos;ve configured.
                    </p>
                    <a
                        href={githubUrl}
                        className="mt-7 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-foreground underline decoration-border underline-offset-4 transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
                    >
                        Read the source on GitHub
                        <ArrowUpRight />
                    </a>
                </div>
            </section>

            <section
                id="downloads"
                aria-label="Desktop downloads"
                className="mx-auto w-full max-w-[88rem] px-5 pb-20 sm:px-8 sm:pb-28 lg:px-12 lg:pb-36"
            >
                <div className="grid gap-6 border-b border-border pb-10 md:grid-cols-[0.92fr_1.08fr] md:items-end md:gap-12">
                    <div>
                        <h2 className="max-w-xl text-4xl leading-[1.02] font-semibold tracking-[-0.035em] text-balance sm:text-5xl lg:text-6xl">
                            Use Write Me on the web or desktop.
                        </h2>
                        <p className="mt-4 font-mono text-xs text-muted-foreground">
                            Desktop installers · v{releaseVersion}
                        </p>
                    </div>
                    <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:justify-between">
                        <p className="max-w-md leading-7 text-muted-foreground">
                            Open the web app now, or choose a desktop build for your system.
                        </p>
                        <a
                            href={appUrl}
                            className={buttonVariants({
                                size: "lg",
                                className: "h-12 rounded-full px-6 text-base font-semibold",
                            })}
                        >
                            Open web app
                            <ArrowUpRight />
                        </a>
                    </div>
                </div>

                <div className="border-b border-border">
                    {platformDownloads.map((platform) => (
                        <article
                            key={platform.name}
                            className="grid gap-5 border-t border-border py-7 sm:py-8 md:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)] md:items-center md:gap-10"
                        >
                            <div className="flex min-w-0 items-center gap-4 sm:gap-5">
                                <platform.icon
                                    aria-hidden="true"
                                    className="shrink-0 text-primary"
                                    size={48}
                                    weight="fill"
                                />
                                <div className="min-w-0">
                                    <h3 className="text-xl font-medium tracking-[-0.02em] text-foreground">
                                        {platform.name}
                                    </h3>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                        {platform.details}
                                    </p>
                                </div>
                            </div>
                            <div
                                className={
                                    platform.files.length === 1
                                        ? "grid gap-3 sm:max-w-sm sm:grid-cols-1"
                                        : "grid gap-3 sm:max-w-xl sm:grid-cols-2"
                                }
                            >
                                {platform.files.map((file) => (
                                    <a
                                        key={file.label}
                                        href={file.href}
                                        className={buttonVariants({
                                            size: "lg",
                                            className:
                                                "h-12 w-full justify-center rounded-full px-4 text-center text-base font-bold",
                                        })}
                                    >
                                        {file.label}
                                    </a>
                                ))}
                            </div>
                        </article>
                    ))}
                </div>

                <p className="mt-6 max-w-3xl text-sm leading-6 text-muted-foreground">
                    The macOS build is Apple Silicon only and unsigned. Read the{" "}
                    <a
                        href={releaseNotesUrl}
                        className="font-medium text-foreground underline decoration-border underline-offset-4 transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
                    >
                        v{releaseVersion} changelog
                    </a>{" "}
                    for this version&apos;s changes, or visit the{" "}
                    <a
                        href={releasePageUrl}
                        className="font-medium text-foreground underline decoration-border underline-offset-4 transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
                    >
                        release page
                    </a>{" "}
                    for first-launch instructions and desktop assets.
                </p>
            </section>

            <footer className="border-t border-border">
                <div className="mx-auto flex w-full max-w-[88rem] flex-col gap-5 px-5 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
                    <p>Write Me is open source under the MIT License.</p>
                    <div className="flex gap-6">
                        <a href={githubUrl} className="transition-colors hover:text-foreground">
                            GitHub
                        </a>
                        <a href={appUrl} className="transition-colors hover:text-foreground">
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
        <figure className="hero-screenshot pointer-events-none min-w-0 overflow-hidden rounded-2xl bg-card shadow-[0_34px_90px_-46px_color-mix(in_oklch,var(--emphasis)_42%,transparent)]">
            <Image
                priority
                width={2912}
                height={1800}
                src="/writeme-home-hero.png"
                sizes="(min-width: 1280px) 56vw, (min-width: 768px) 58vw, 100vw"
                className="block aspect-[1.617] w-full object-cover object-top-left"
                alt="Write Me's workspace home with quick actions, recently changed notes, and starred notes."
            />
        </figure>
    )
}

function ArrowUpRight() {
    return (
        <svg
            aria-hidden="true"
            className="size-4 shrink-0"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.75"
            viewBox="0 0 20 20"
            focusable="false"
        >
            <path d="M5.5 14.5 14.25 5.75" />
            <path d="M7 5.75h7.25V13" />
        </svg>
    )
}
