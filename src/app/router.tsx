import { createHashRouter, createBrowserRouter } from "react-router-dom";
import { lazy } from "react";
import { RootLayout } from "./root-layout";
import { isElectron } from "../lib/is-electron";

const EditorPage = lazy(() => import("./pages/editor.page"));
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
const TagsPage = lazy(() => import("./pages/tags.page"));
const NotesListPage = lazy(() => import("./pages/notes-list.page"));
const SharePage = lazy(() => import("./pages/share.page"));
const ReadItLaterPage = lazy(() => import("./pages/read-it-later.page"));

const createRouter = isElectron() ? createHashRouter : createBrowserRouter;

export const router = createRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      {
        index: true,
        element: <EditorPage />,
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
        ],
      },
    ],
  },
]);
