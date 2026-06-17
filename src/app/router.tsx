import {
	createHashRouter,
	createBrowserRouter,
	Navigate,
} from "react-router-dom";
import { lazy } from "react";
import { RootLayout } from "./root-layout";
import { isElectron } from "../lib/is-electron";

const DashboardPage = lazy(() => import("./pages/dashboard.page"));
const NotePage = lazy(() => import("./pages/note.page"));
const QuicknotePage = lazy(() => import("./pages/quicknote.page"));
const MathnotePage = lazy(() => import("./pages/mathnote.page"));
const AboutPage = lazy(() => import("./pages/about.page"));
const ExamplesPage = lazy(() => import("./pages/examples.page"));
const MathExamplePage = lazy(() => import("./pages/examples/math.page"));
const UuidExamplePage = lazy(() => import("./pages/examples/uuid.page"));
const EvalExamplePage = lazy(() => import("./pages/examples/eval.page"));
const ExprExamplePage = lazy(() => import("./pages/examples/expr.page"));
const MoneyExamplePage = lazy(() => import("./pages/examples/money.page"));
const TableExamplePage = lazy(() => import("./pages/examples/table.page"));
const CopyExamplePage = lazy(() => import("./pages/examples/copy.page"));
const CodeRunExamplePage = lazy(() => import("./pages/examples/code-run.page"));
const TagsPage = lazy(() => import("./pages/tags.page"));
const TagPage = lazy(() => import("./pages/tag.page"));
const NotesListPage = lazy(() => import("./pages/notes-list.page"));
const SharePage = lazy(() => import("./pages/share.page"));
const ReadItLaterPage = lazy(() => import("./pages/read-it-later.page"));
const SettingsQuickPage = lazy(
	() => import("./pages/settings/settings-quick.page"),
);
const SettingsAppearancePage = lazy(
	() => import("./pages/settings/settings-appearance.page"),
);
const SettingsEditorPage = lazy(
	() => import("./pages/settings/settings-editor.page"),
);
const SettingsShortcutsPage = lazy(
	() => import("./pages/settings/settings-shortcuts.page"),
);
const SettingsTrashPage = lazy(
	() => import("./pages/settings/settings-trash.page"),
);
const SettingsAIPage = lazy(() => import("./pages/settings/settings-ai.page"));
const SettingsWorkspacePage = lazy(
	() => import("./pages/settings/settings-workspace.page"),
);
const SettingsTemplatesPage = lazy(
	() => import("./pages/settings/settings-templates.page"),
);
const SettingsVariablesPage = lazy(
	() => import("./pages/settings/settings-variables.page"),
);
const SettingsMigrationPage = lazy(
	() => import("./pages/settings/settings-migration.page"),
);
const SettingsNotFoundPage = lazy(
	() => import("./pages/settings/settings-not-found.page"),
);
const TemplatePage = lazy(() => import("./pages/template.page"));
const MigratePage = lazy(() => import("./pages/migrate.page"));
const GroupsListPage = lazy(() => import("./pages/groups-list.page"));
const GroupDetailPage = lazy(() => import("./pages/group-detail.page"));
const CalendarPage = lazy(() => import("./pages/calendar.page"));
const ViewsListPage = lazy(() => import("./pages/views-list.page"));
const ViewDetailPage = lazy(() => import("./pages/view-detail.page"));
const ChatPage = lazy(() => import("./pages/chat.page"));
const TerminalPage = lazy(() => import("./pages/terminal.page"));
const OAuthCallbackPage = lazy(() => import("./pages/oauth-callback.page"));
const FolderWorkspacePage = lazy(() => import("./pages/folder-workspace.page"));
const SettingsPlatformGate = lazy(() =>
	import("./pages/settings/settings-platform-gate").then((module) => ({
		default: module.SettingsPlatformGate,
	})),
);

const createRouter = isElectron() ? createHashRouter : createBrowserRouter;

export const router = createRouter([
	{
		path: "/",
		element: <RootLayout />,
		children: [
			{
				index: true,
				element: <DashboardPage />,
			},
			{
				path: "note/:noteId",
				element: <NotePage />,
			},
			{
				path: "share",
				element: <SharePage />,
			},
			{
				path: "notes",
				element: <NotesListPage />,
			},
			{
				path: "read-it-later",
				element: <ReadItLaterPage />,
			},
			{
				path: "quicknote",
				element: <QuicknotePage />,
			},
			{
				path: "mathnote",
				element: <MathnotePage />,
			},
			{
				path: "quicknote/:noteId",
				element: <NotePage />,
			},
			{
				path: "about",
				element: <AboutPage />,
			},
			{
				path: "tags",
				element: <TagsPage />,
			},
			{
				path: "tags/:id",
				element: <TagPage />,
			},
			{
				path: "settings",
				children: [
					{
						index: true,
						element: <Navigate to="quick" replace />,
					},
					{
						path: "quick",
						element: <SettingsQuickPage />,
					},
					{
						path: "appearance",
						element: <SettingsAppearancePage />,
					},
					{
						path: "editor",
						element: <SettingsEditorPage />,
					},
					{
						path: "shortcuts",
						element: (
							<SettingsPlatformGate sectionId="shortcuts">
								<SettingsShortcutsPage />
							</SettingsPlatformGate>
						),
					},
					{
						path: "trash",
						element: <SettingsTrashPage />,
					},
					{
						path: "ai",
						element: <SettingsAIPage />,
					},
					{
						path: "workspace",
						element: (
							<SettingsPlatformGate sectionId="workspace">
								<SettingsWorkspacePage />
							</SettingsPlatformGate>
						),
					},
					{
						path: "templates",
						element: <SettingsTemplatesPage />,
					},
					{
						path: "variables",
						element: <SettingsVariablesPage />,
					},
					{
						path: "migration",
						element: (
							<SettingsPlatformGate sectionId="migration">
								<SettingsMigrationPage />
							</SettingsPlatformGate>
						),
					},
					{
						path: "*",
						element: <SettingsNotFoundPage />,
					},
				],
			},
			{
				path: "templates/:templateId",
				element: <TemplatePage />,
			},
			{
				path: "migrate",
				element: <MigratePage />,
			},
			{
				path: "groups",
				element: <GroupsListPage />,
			},
			{
				path: "groups/:groupId",
				element: <GroupDetailPage />,
			},
			{
				path: "calendar",
				element: <CalendarPage />,
			},
			{ path: "views", element: <ViewsListPage /> },
			{ path: "views/:viewId", element: <ViewDetailPage /> },
			{ path: "oauth/callback", element: <OAuthCallbackPage /> },
			{ path: "chat", element: <ChatPage /> },
			{ path: "terminal/:sessionId", element: <TerminalPage /> },
			{ path: "folder", element: <FolderWorkspacePage /> },
			{
				path: "examples",
				children: [
					{
						index: true,
						element: <ExamplesPage />,
					},
					{
						path: "math",
						element: <MathExamplePage />,
					},
					{
						path: "uuid",
						element: <UuidExamplePage />,
					},
					{
						path: "eval",
						element: <EvalExamplePage />,
					},
					{
						path: "expr",
						element: <ExprExamplePage />,
					},
					{
						path: "money",
						element: <MoneyExamplePage />,
					},
					{
						path: "table",
						element: <TableExamplePage />,
					},
					{
						path: "copy",
						element: <CopyExamplePage />,
					},
					{
						path: "code-run",
						element: <CodeRunExamplePage />,
					},
				],
			},
		],
	},
]);
