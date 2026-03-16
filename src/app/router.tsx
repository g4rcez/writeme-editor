import { createHashRouter, createBrowserRouter } from "react-router-dom";
import { lazy } from "react";
import { RootLayout } from "./root-layout";
import { isElectron } from "../lib/is-electron";

const DashboardPage = lazy(() => import("./pages/dashboard.page"));
const NotePage = lazy(() => import("./pages/note.page"));
const QuicknotePage = lazy(() => import("./pages/quicknote.page"));
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
const SettingsPage = lazy(() => import("./pages/settings.page"));
const TemplatePage = lazy(() => import("./pages/template.page"));
const MigratePage = lazy(() => import("./pages/migrate.page"));
const GroupsListPage = lazy(() => import("./pages/groups-list.page"));
const GroupDetailPage = lazy(() => import("./pages/group-detail.page"));
const CalendarPage = lazy(() => import("./pages/calendar.page"));
const OAuthCallbackPage = lazy(() => import("./pages/oauth-callback.page"));

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
        element: <SettingsPage />,
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
      {
        path: "oauth/callback",
        element: <OAuthCallbackPage />,
      },
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
