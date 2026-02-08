import { createHashRouter, createBrowserRouter } from "react-router-dom";
import { lazy } from "react";
import { RootLayout } from "./root-layout";
import { isElectron } from "../lib/is-electron";

const EditorPage = lazy(() => import("./pages/editor.page"));
const QuicknotePage = lazy(() => import("./pages/quicknote.page"));
const AboutPage = lazy(() => import("./pages/about.page"));
const ExamplesPage = lazy(() => import("./pages/examples.page"));
const MathExamplePage = lazy(() => import("./pages/examples/math.page"));
const UuidExamplePage = lazy(() => import("./pages/examples/uuid.page"));
const EvalExamplePage = lazy(() => import("./pages/examples/eval.page"));
const LatexExamplePage = lazy(() => import("./pages/examples/latex.page"));
const ExprExamplePage = lazy(() => import("./pages/examples/expr.page"));

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
        path: "quicknote",
        element: <QuicknotePage />,
      },
      {
        path: "about",
        element: <AboutPage />,
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
            path: "latex",
            element: <LatexExamplePage />,
          },
          {
            path: "expr",
            element: <ExprExamplePage />,
          },
        ],
      },
    ],
  },
]);