import { Tag } from "@g4rcez/components";
import { ArrowRightIcon } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { FilePlusIcon } from "@phosphor-icons/react/dist/csr/FilePlus";
import { FileTextIcon } from "@phosphor-icons/react/dist/csr/FileText";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { RobotIcon } from "@phosphor-icons/react/dist/csr/Robot";
import { StarIcon } from "@phosphor-icons/react/dist/csr/Star";
import { TagIcon } from "@phosphor-icons/react/dist/csr/Tag";
import { type ComponentType, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Dates } from "@/lib/dates";
import { tildaDir } from "@/lib/file-utils";
import { CommanderType, useGlobalStore } from "@/store/global.store";
import type { Note } from "@/store/note";

type DashboardIcon = ComponentType<{
	size?: number;
	className?: string;
	strokeWidth?: number;
}>;

type ActionCardProps = {
	icon: DashboardIcon;
	title: string;
	description: string;
	shortcut: string;
	onClick: () => void;
	className?: string;
};

function SectionHeading({
	title,
	description,
}: {
	title: string;
	description?: string;
}) {
	return (
		<div className="space-y-1">
			<h2 className="text-base font-semibold text-foreground">{title}</h2>
			{description ? (
				<p className="max-w-2xl text-sm leading-6 text-muted-foreground">
					{description}
				</p>
			) : null}
		</div>
	);
}

function ActionCard({
	title,
	description,
	icon: Icon,
	onClick,
	shortcut,
	className,
}: ActionCardProps) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={`group flex min-h-28 items-start gap-4 rounded-xl border border-border/40 bg-card-background p-4 text-left transition-colors hover:border-primary/30 hover:bg-muted/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${className ?? ""}`}
		>
			<span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
				<Icon size={20} strokeWidth={1.6} />
			</span>
			<span className="flex min-w-0 flex-1 flex-col gap-2">
				<span>
					<span className="block text-sm font-semibold text-foreground group-hover:text-primary">
						{title}
					</span>
					<span className="mt-1 block text-sm leading-5 text-muted-foreground">
						{description}
					</span>
				</span>
				<kbd className="mt-auto w-fit rounded bg-muted px-2 py-1 font-mono text-[11px] text-muted-foreground">
					{shortcut}
				</kbd>
			</span>
		</button>
	);
}

function RecentNoteCard({ note }: { note: Note }) {
	return (
		<li>
			<Link
				to={`/note/${note.id}`}
				className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
			>
				<span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted/40 text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
					<FileTextIcon size={18} />
				</span>
				<span className="min-w-0 flex-1">
					<span className="block truncate text-sm font-medium text-foreground group-hover:text-primary">
						{note.title || "Untitled"}
					</span>
					<span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
						<time dateTime={new Date(note.updatedAt).toISOString()}>
							{Dates.yearMonthDay(new Date(note.updatedAt))}
						</time>
						{note.tags.length > 0 ? (
							<span className="flex min-w-0 items-center gap-1">
								<TagIcon size={12} />
								<span className="truncate">{note.tags[0]}</span>
							</span>
						) : null}
					</span>
				</span>
				<ArrowRightIcon
					size={14}
					className="shrink-0 text-muted-foreground opacity-0 transition-[opacity,transform] group-hover:translate-x-0.5 group-hover:opacity-100"
				/>
			</Link>
		</li>
	);
}

export default function DashboardPage() {
	const [state, dispatch] = useGlobalStore();
	const navigate = useNavigate();
	const [cwd, setCwd] = useState<string | null>(null);
	const [greeting, setGreeting] = useState("");

	useEffect(() => {
		if (state.directory) {
			window.electronAPI.env.getHome().then((home) => {
				setCwd(tildaDir(home, state.directory ?? home));
			});
		} else if (window.electronAPI) {
			window.electronAPI.env.getHome().then(setCwd);
		}

		const hour = new Date().getHours();
		if (hour < 12) setGreeting("Good morning");
		else if (hour < 18) setGreeting("Good afternoon");
		else setGreeting("Good evening");
	}, [state.directory]);

	const onSearch = () => dispatch.commander(true, CommanderType.Notes);

	const createNewNote = () =>
		dispatch.setCreateNoteDialog({ isOpen: true, type: "note" });

	const openAiAssistant = () => navigate("/chat");

	const favorites = state.notes
		.filter((note: Note) => note.favorite)
		.slice(0, 4);
	const recent = state.notes.slice(0, 6);

	return (
		<div className="min-h-full bg-background selection:bg-primary/20">
			<main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-10 lg:px-8">
				<header className="flex flex-col gap-5 border-b border-border/30 pb-8 lg:flex-row lg:items-end lg:justify-between">
					<div className="max-w-2xl">
						<p className="mb-2 font-mono text-sm text-primary">
							{greeting} · a place for your thoughts
						</p>
						<h1 className="text-4xl font-bold tracking-tight text-foreground">
							Just you and your thoughts.
						</h1>
						<p className="mt-3 max-w-xl text-base leading-7 text-muted-foreground">
							A zero-distraction workspace for your mind. Privacy by design,
							focus by nature, integrated with AI by default.
						</p>
					</div>
					{cwd ? (
						<div className="rounded-xl border border-border/40 bg-card-background px-3 py-2 lg:max-w-xs">
							<p className="text-xs font-medium text-muted-foreground">
								Local-first workspace
							</p>
							<p className="mt-1 truncate text-sm text-foreground" title={cwd}>
								{cwd}
							</p>
						</div>
					) : null}
				</header>

				<div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
					<div className="space-y-10">
						<section className="space-y-4">
							<SectionHeading
								title="Focused writing with power one gesture away."
								description="Start writing, search the workspace, or ask for structure without leaving the flow."
							/>
							<div className="grid gap-3 sm:grid-cols-2">
								<ActionCard
									title="Start writing"
									description="There is no blank page. Open a clean writing column."
									icon={FilePlusIcon}
									shortcut="⌘ N"
									onClick={createNewNote}
								/>
								<ActionCard
									title="Keyboard driven"
									description="Move through notes, tabs, search, and actions without leaving the keyboard."
									icon={MagnifyingGlassIcon}
									shortcut="⌘ K"
									onClick={onSearch}
								/>
								<ActionCard
									title="AI assistant"
									description="Ask for structure, summaries, or help while staying inside your note."
									icon={RobotIcon}
									shortcut="AI"
									className="sm:col-span-2"
									onClick={openAiAssistant}
								/>
							</div>
						</section>

						<section className="space-y-4">
							<div className="flex flex-wrap items-end justify-between gap-3">
								<SectionHeading
									title="Personal note taker"
									description="Daily notes, project ideas, snippets, tasks, and drafts in one place."
								/>
								<Link
									to="/notes"
									className="group flex items-center gap-1 text-sm font-medium text-primary hover:underline"
								>
									View all
									<ArrowRightIcon
										size={13}
										className="transition-transform group-hover:translate-x-0.5"
									/>
								</Link>
							</div>
							<div className="overflow-hidden rounded-xl border border-border/40 bg-card-background">
								{recent.length > 0 ? (
									<ul className="divide-y divide-border/30">
										{recent.map((note: Note) => (
											<RecentNoteCard key={note.id} note={note} />
										))}
									</ul>
								) : (
									<div className="flex min-h-36 flex-col items-center justify-center gap-2 px-6 py-10 text-center">
										<FileTextIcon
											size={24}
											className="text-muted-foreground/60"
										/>
										<p className="text-sm font-medium text-foreground">
											There is no blank page.
										</p>
										<p className="max-w-sm text-sm leading-6 text-muted-foreground">
											Every thought you sit down to write already exists
											somewhere in your head.
										</p>
									</div>
								)}
							</div>
						</section>
					</div>

					<aside className="space-y-4 lg:sticky lg:top-8 lg:self-start">
						<section className="rounded-xl border border-border/40 bg-card-background p-4">
							<div className="mb-4 flex items-center gap-2">
								<StarIcon size={16} className="fill-current text-warn" />
								<h2 className="text-sm font-semibold text-foreground">
									Power one gesture away
								</h2>
							</div>
							{favorites.length > 0 ? (
								<div className="space-y-1">
									{favorites.map((note: Note) => (
										<Link
											key={note.id}
											to={`/note/${note.id}`}
											className="block rounded-lg px-2 py-2 transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
										>
											<h3 className="truncate text-sm font-medium text-foreground">
												{note.title || "Untitled"}
											</h3>
											<p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
												{note.content.substring(0, 90).replace(/[#*`]/g, "") ||
													"No content"}
											</p>
										</Link>
									))}
								</div>
							) : (
								<p className="py-4 text-sm leading-6 text-muted-foreground">
									Star notes you return to often and keep them exactly where you
									expect them.
								</p>
							)}
						</section>

						<section className="rounded-xl border border-primary/20 bg-primary/10 p-4">
							<h2 className="text-sm font-semibold text-foreground">
								Privacy first
							</h2>
							<p className="mt-2 text-sm leading-6 text-muted-foreground">
								Write Me is local-first. Your notes stay in formats you control.
							</p>
							<div className="mt-4 flex items-center justify-between gap-3">
								<span className="text-xs text-muted-foreground">
									Workspace notes
								</span>
								<Tag size="small" theme="primary">
									{state.notes.length}
								</Tag>
							</div>
						</section>
					</aside>
				</div>
			</main>
		</div>
	);
}
