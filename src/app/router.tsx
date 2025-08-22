import { createRouterMap, lazyRoute } from "brouther";

export const router = createRouterMap({
  root: lazyRoute("/", () => import("./pages/editor.page"), {}),
  about: lazyRoute("/about", () => import("./pages/about.page"), {}),
  examples: lazyRoute("/examples", () => import("./pages/examples.page"), {}),
  mathExample: lazyRoute(
    "/examples/math",
    () => import("./pages/examples/math.page"),
    {},
  ),
  uuidExample: lazyRoute(
    "/examples/uuid",
    () => import("./pages/examples/uuid.page"),
    {},
  ),
  evalExample: lazyRoute(
    "/examples/eval",
    () => import("./pages/examples/eval.page"),
    {},
  ),
  latexExample: lazyRoute(
    "/examples/latex",
    () => import("./pages/examples/latex.page"),
    {},
  ),
  exprExample: lazyRoute(
    "/examples/expr",
    () => import("./pages/examples/expr.page"),
    {},
  ),
});

export const links = router.links;
