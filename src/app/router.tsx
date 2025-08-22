import { createRouterMap, lazyRoute } from "brouther";

export const router = createRouterMap({
  root: lazyRoute("/", () => import("./pages/editor.page"), {}),
  about: lazyRoute("/about", () => import("./pages/about.page"), {}),
  examples: lazyRoute("/examples", () => import("./pages/examples.page"), {}),
  mathExample: lazyRoute("/examples/math", () => import("./pages/examples/math.page"), {}),
});

export const links = router.links;
