## [1.0.5](https://github.com/g4rcez/writeme-editor/compare/v1.0.4...v1.0.5) (2026-05-20)


### Bug Fixes

* remove import-codesign-certs step; Electron Forge skips signing when CSC_LINK is absent

## [1.0.4](https://github.com/g4rcez/writeme-editor/compare/v1.0.3...v1.0.4) (2026-05-20)


### Bug Fixes

* make code-signing step conditional on CSC_LINK secret being present

## [1.0.3](https://github.com/g4rcez/writeme-editor/compare/v1.0.2...v1.0.3) (2026-05-20)


### Bug Fixes

* fix release pipeline by updating import-codesign-certs action parameter name ([release.yml](https://github.com/g4rcez/writeme-editor/blob/main/.github/workflows/release.yml))
* use native fetch instead of proxyFetch in read-it-later dialog

## [1.0.2](https://github.com/g4rcez/writeme-editor/compare/v1.0.1...v1.0.2) (2026-05-18)


### Features

* enhance note organization and editor statistics ([74bcc64](https://github.com/g4rcez/writeme-editor/commit/74bcc6402df1d74a7ad2b46e07b3e8b93aee7b9e))
## [1.0.1](https://github.com/g4rcez/writeme-editor/compare/v0.0.6...v1.0.1) (2026-05-18)


### Bug Fixes

* add error handling, webworker types, and guard onmessage in markdown worker ([66879cb](https://github.com/g4rcez/writeme-editor/commit/66879cb74610b4bc51138c6619fc41c04e81e2c7))
* add superseded-gen check in worker handler and isDestroyed guard in recover ([c646144](https://github.com/g4rcez/writeme-editor/commit/c6461442880aa9db8d610f6b55e1c81eb26f74b0))
* **callout:** add serialize tests and document state.closed usage ([c2c87a1](https://github.com/g4rcez/writeme-editor/commit/c2c87a1e9510ece885b5e0f9354177234eb52e92))
* **callout:** guard unclosed admonitions and empty content nodes ([248e688](https://github.com/g4rcez/writeme-editor/commit/248e68845d0c515144c5afc31ca6b29f53673b68))
* **callout:** prevent blank line before closing ::: fence ([b195609](https://github.com/g4rcez/writeme-editor/commit/b1956091730a9142f8cc43bb8c9b85d2ee0552ef))
* clear parsingContent on unmount, remove stale handlers, invalidate gen on watchdog ([7cd5f8e](https://github.com/g4rcez/writeme-editor/commit/7cd5f8eb59f9e20009e33bacc1870f6a7a9bf3d8))
* **dates:** map European TZ abbreviations to fixed-offset zones ([c6f612c](https://github.com/g4rcez/writeme-editor/commit/c6f612cc13f467793c5e50e6038a7e6dd04a3826))
* define color-scheme for light and dark modes in CSS ([#6](https://github.com/g4rcez/writeme-editor/issues/6)) ([d954a42](https://github.com/g4rcez/writeme-editor/commit/d954a423c415b4d517112252409707596a7846fb))
* legible native select dropdown ([#8](https://github.com/g4rcez/writeme-editor/issues/8)) ([f47b02b](https://github.com/g4rcez/writeme-editor/commit/f47b02b5b56a858773016f83e5b0b492afd31654))
* **types:** resolve 221 TypeScript errors and strict-null clusters ([4172284](https://github.com/g4rcez/writeme-editor/commit/417228411ab045c71e98f8468ae91d9c3e1fbbb0))
* **ui:** center-align task card header elements ([35d3237](https://github.com/g4rcez/writeme-editor/commit/35d32379d5a16aa496b2ee2e4f381729ea3a91cb))
* use gen-echo and addEventListener to fix Worker stale-result race ([5d6949a](https://github.com/g4rcez/writeme-editor/commit/5d6949ae0f4354c40764486f0aca75278d953c1c))


### Features

* add code block titles, select-all shortcut, and fix math rounding with units ([b84b5e6](https://github.com/g4rcez/writeme-editor/commit/b84b5e631bef652462974c811a7d2670eab7beee))
* add lazy Worker singleton and LARGE_MARKDOWN_THRESHOLD constant ([fbc632c](https://github.com/g4rcez/writeme-editor/commit/fbc632c00bb89c6c7c2bd975e60137c2a3f5465e))
* add markdown worker with processMarkdown core logic ([14ce3b6](https://github.com/g4rcez/writeme-editor/commit/14ce3b6e8e39f9fd4c9b82a0f1fc059aec067b63))
* add parsingContent flag to UIStore ([051037f](https://github.com/g4rcez/writeme-editor/commit/051037f5c9de1f67446338db267e2fb3b1e12f97))
* **callout:** add React NodeView using Alert component ([543b0b0](https://github.com/g4rcez/writeme-editor/commit/543b0b05a94320a2f14d99e7984aadc45e7603e5))
* **callout:** export ADMONITION_MAP and AdmonitionType ([5ad4f52](https://github.com/g4rcez/writeme-editor/commit/5ad4f525683aaf1de675e13b1cfae2cfd02b5811))
* **callout:** extract and test parseDocusaurusAdmonitions ([e517076](https://github.com/g4rcez/writeme-editor/commit/e5170768f16b0196b6ddb5fb289c9c47b8b8622e))
* **callout:** wire Docusaurus parser and :::type serializer ([7fa9856](https://github.com/g4rcez/writeme-editor/commit/7fa985664040c1b803b05eacfc2e07d4ff7339fd))
* **dates:** expand cityMap with ~150 additional cities and aliases ([31a180f](https://github.com/g4rcez/writeme-editor/commit/31a180fdd82f75148efd64ae3d5ab66258220ae5))
* **dates:** replace hand-crafted cityMap with Raycast/SoulverCore dataset ([f0d11d9](https://github.com/g4rcez/writeme-editor/commit/f0d11d9f76420cec201c909248aef1d399ca5f1a))
* **dates:** resolve city names and 'in' conjunction in evaluateTimezone ([915c9ee](https://github.com/g4rcez/writeme-editor/commit/915c9ee90c2dd11e7e4cd210d9d6d04b42c766a8))
* **dates:** switch evaluateTimezone output to 24-hour format ([75a504a](https://github.com/g4rcez/writeme-editor/commit/75a504a3494a63ec09ead4efe683f96cdf6c3b8c))
* **design:** implement "The Patient Workshop" system and refine UI/UX ([85c346f](https://github.com/g4rcez/writeme-editor/commit/85c346f4d7ff69937620ea661d9a552f52cf31a7))
* **editor:** add rule of three proportionality solver ([482c5f9](https://github.com/g4rcez/writeme-editor/commit/482c5f9d77ab6573566a65ae0ab03e4cc3755f3e))
* **editor:** allow forcing Shiki decoration updates in code blocks ([02dde2d](https://github.com/g4rcez/writeme-editor/commit/02dde2d93432e02c542103adbb4ae83257154361))
* extract dedent into shared markdown-worker util ([9e988da](https://github.com/g4rcez/writeme-editor/commit/9e988da285774cf1e61e7dda2768ca0d891f66b3))
* **git:** add shared types for git ipc results ([#9](https://github.com/g4rcez/writeme-editor/issues/9)) ([bd59c3a](https://github.com/g4rcez/writeme-editor/commit/bd59c3af84466b67771918be4fefd0fd0bbf2178))
* implement typed Bun CLI, folder workspaces, and math engine refactor ([1fa51cb](https://github.com/g4rcez/writeme-editor/commit/1fa51cb26d43934847ab428ce5ebed0508969f54))
* intercept large paste via Worker with loading overlay ([f52d7b0](https://github.com/g4rcez/writeme-editor/commit/f52d7b0d0491b9373175cd573cf549ab72a8113d))
* **macOS:** add DMG installer support ([e278a72](https://github.com/g4rcez/writeme-editor/commit/e278a72ffffdb05c433a60d2d03f996f0b2c8fe3))
* **math-block:** add Unix epoch converter ([6fa4a5b](https://github.com/g4rcez/writeme-editor/commit/6fa4a5b9ebf09ab7306c9e83c64be5227b92e5e0))
* new layout rebrand + landingpage ([#7](https://github.com/g4rcez/writeme-editor/issues/7)) ([3591459](https://github.com/g4rcez/writeme-editor/commit/3591459b24c9f9f607dc8b19dda58e378a30a296)), closes [hi#contrast](https://github.com/hi/issues/contrast)
* offload large content-load parse to Worker ([70d3bf7](https://github.com/g4rcez/writeme-editor/commit/70d3bf717f1f99d5aea3f526704a8bac83a75f55))
* **pwa:** enhance favicon system and manifest configuration ([c50b556](https://github.com/g4rcez/writeme-editor/commit/c50b55694f12be83d9eba99fdac78f0484c4ed6e)), closes [hi#fidelity](https://github.com/hi/issues/fidelity)
* **release:** automate release workflow and enhance installation documentation ([c651b0e](https://github.com/g4rcez/writeme-editor/commit/c651b0e56e386bde4df198ae8e285d823a9acf3b))
* trash / soft-delete for notes ([#5](https://github.com/g4rcez/writeme-editor/issues/5)) ([27b8d9f](https://github.com/g4rcez/writeme-editor/commit/27b8d9fc54cc7c554be6eea0f93b17e127f828dc))
* **ui:** enhance navigation and file explorer interactions ([d5a8bdb](https://github.com/g4rcez/writeme-editor/commit/d5a8bdbae78241f756880939545864384b814859))


### Performance Improvements

* **editor:** optimize giant markdown file imports and rendering ([15cbca3](https://github.com/g4rcez/writeme-editor/commit/15cbca3d4ac667b17e10ca1fe1af9cc55a11b3c6))
* **read-it-later:** optimize browser lifecycle and chrome discovery ([4243deb](https://github.com/g4rcez/writeme-editor/commit/4243debca8dec32959d9e69429891629bcf96479))

## [0.0.6](https://github.com/g4rcez/writeme-editor/compare/v0.0.5...v0.0.6) (2026-04-07)


### Features

* **ai:** implement comprehensive AI assistant with OAuth support and CORS proxy ([9d30654](https://github.com/g4rcez/writeme-editor/commit/9d306540be2ac8bb2214fc90c74277be225fb4d8))

## [0.0.5](https://github.com/g4rcez/writeme-editor/compare/v0.0.4...v0.0.5) (2026-04-06)


### Bug Fixes

* **editor:** improve text wrapping and layout width consistency ([524ff22](https://github.com/g4rcez/writeme-editor/commit/524ff223d924e3ed4267dff602a8b451591b3b6d))


### Features

* add CLI editor integration and `$EDITOR` support ([341cf2a](https://github.com/g4rcez/writeme-editor/commit/341cf2a53783a8b0385fb0f48a41a213bacc94f2))
* **editor:** support pasting markdown with YAML frontmatter ([0de2593](https://github.com/g4rcez/writeme-editor/commit/0de2593fb348914c1d8991f028f73f7b2da1e88b))
* extend color decorators ([6583016](https://github.com/g4rcez/writeme-editor/commit/658301643d322abb657eebf501051d2ae02a75c8))
* **views:** implement multi-entity JOINs and query-driven note views ([7e23324](https://github.com/g4rcez/writeme-editor/commit/7e233241087b0fb42addc38988e1823bf3151813))

## [0.0.4](https://github.com/g4rcez/writeme-editor/compare/v0.0.3...v0.0.4) (2026-03-25)


### Bug Fixes

* **editor:** refine emoji suggestion trigger logic ([097d92b](https://github.com/g4rcez/writeme-editor/commit/097d92b9a2feea0f0401d2cbf16e2a11dcdbf050))


### Features

* **editor:** add emoji picker and expand slash commands ([5ff076a](https://github.com/g4rcez/writeme-editor/commit/5ff076a36baae5478a7d8a43a846048b4577b85a))
* implement automatic asset cleanup and explorer deletion ([933de01](https://github.com/g4rcez/writeme-editor/commit/933de01a7518e84ace23d783f413df20d0b02e14))

## [0.0.3](https://github.com/g4rcez/writeme-editor/compare/v0.0.2...v0.0.3) (2026-03-19)


### Features

* add note deletion and file explorer context menu ([1a77417](https://github.com/g4rcez/writeme-editor/commit/1a77417385304aec2be102f3c7a460242bc28aed))
* **editor:** add DomainLink extension and enhance link detection logic ([fd6704a](https://github.com/g4rcez/writeme-editor/commit/fd6704a4a1cad4004210859963a86143453cb51c))
* **tabs:** improve scrollbar behavior and styling ([54719fe](https://github.com/g4rcez/writeme-editor/commit/54719fecb49fe628f5344d4834f82643125cf14e))

## [0.0.2](https://github.com/g4rcez/writeme-editor/compare/v0.0.1...v0.0.2) (2026-03-17)


### Bug Fixes

* **editor:** prevent auto-save trigger during programmatic content updates ([2bd78d5](https://github.com/g4rcez/writeme-editor/commit/2bd78d593418e30c1c1e63c79bd31025802e5ba6))


### Build System

* **deps:** upgrade dependencies and update tailwind configuration ([6f1b4ca](https://github.com/g4rcez/writeme-editor/commit/6f1b4cab88f5a16fd692dd01432f8bb161896b20))


### Features

* **ai:** add provider-agnostic AI adapter system (UI hidden) ([8e135c1](https://github.com/g4rcez/writeme-editor/commit/8e135c18cb05ae84d4ef08de913064614d0ba85e))
* **components:** automatically fill empty JSON editor from clipboard ([3f392b5](https://github.com/g4rcez/writeme-editor/commit/3f392b5a10078b8e48af7b8785c38ff5999c615a))
* introduce calendar view for managing notes and events ([4020423](https://github.com/g4rcez/writeme-editor/commit/40204231878edab5aaddea1df71a64252ec4a4e5))
* introduce note grouping and organization ([dc556d0](https://github.com/g4rcez/writeme-editor/commit/dc556d05a4dfea51d399e771a6c58d4cf4f19bf7))
* **sidebar:** add database notes tree view ([ec6afc6](https://github.com/g4rcez/writeme-editor/commit/ec6afc64b29c42e70bff1d5b0d699391cc08df6a))


### BREAKING CHANGES

* **deps:** upgraded core dependencies to new major versions including @g4rcez/components v3, Vite 8, and Electron 41, which may require manual migration of components and build configurations.

2026-03-15T19:36:04 TZ-03(Sun, 074)

## [0.0.1](https://github.com/g4rcez/writeme-editor/compare/94abb2d5ad36dcd3d7d1d02108a2b7cec7d2e510...v0.0.1) (2026-03-12)


* feat(core)!: remove project concept and introduce quick notes ([8250dd1](https://github.com/g4rcez/writeme-editor/commit/8250dd1bbefa4b5b888075c4d86549c0670995f1))


### Bug Fixes

* **editor:** respect start attribute in ordered list rendering ([b34923e](https://github.com/g4rcez/writeme-editor/commit/b34923edeaf2e4558caf569873ebe8f8e4f7d8c0))
* empty space ([7e36b74](https://github.com/g4rcez/writeme-editor/commit/7e36b7496418dab2a48ce0edce7fe5f12e0f8894))
* improve code block parsing and resolve shortcut test dependencies ([514ecde](https://github.com/g4rcez/writeme-editor/commit/514ecde932a1012ebba7966297c5456a75229c6a))
* increment value of workbox ([9a3fd6c](https://github.com/g4rcez/writeme-editor/commit/9a3fd6cc4cf987589cc3846b474676edaa8f016d))
* properly render frontmatter token to HTML for Tiptap parsing ([0ab57dd](https://github.com/g4rcez/writeme-editor/commit/0ab57ddfd5aaf1ed5281e2c78f2f663e6d7008dc))
* **read-it-later:** improve code block normalization ([39a43fa](https://github.com/g4rcez/writeme-editor/commit/39a43fa1da79ead143363d9cb36c29467961132a))
* remove dist changes ([a726d92](https://github.com/g4rcez/writeme-editor/commit/a726d92c39cc70b145d649ff3114a518bdb66449))
* styles ([0506005](https://github.com/g4rcez/writeme-editor/commit/0506005efddad1554a8b4d9a02b30f28f6b19148))
* **tasks-dialog:** fix task reordering within the same column ([609b313](https://github.com/g4rcez/writeme-editor/commit/609b31356a87f4feec975dedcdb7c1da4e3f5879))
* **ui:** improve layout consistency and update documentation ([d380bb8](https://github.com/g4rcez/writeme-editor/commit/d380bb859727e7b535d426c1ca695ef129bf1583))


### Features

* add code-block formatter using prettier ([46068dc](https://github.com/g4rcez/writeme-editor/commit/46068dc3cff7028732cbff25c8cc77fd5fd839c9))
* add Inter+FiraCode fonts ([8fc68e1](https://github.com/g4rcez/writeme-editor/commit/8fc68e13ea4ece99be286541075299379f492de9))
* add mention and commands from `@` or `/` ([0a1f47c](https://github.com/g4rcez/writeme-editor/commit/0a1f47cad1e595850655b771639ec8a49604df8f))
* add note backlinks and mention support in tags graph ([9a237f4](https://github.com/g4rcez/writeme-editor/commit/9a237f4a6100dd1923acbdeafb5bdf690b5b6a9f))
* add support for markdown frontmatter and note metadata ([ba7ef33](https://github.com/g4rcez/writeme-editor/commit/ba7ef339f351b2c9540ae3ce5c9da8c018318abb))
* add table support and enhance editor with comprehensive examples and theme system ([f1e3551](https://github.com/g4rcez/writeme-editor/commit/f1e35514537123f44da0af33917bbf6a09bf8538))
* add vercel.json to redirect properly ([d237d3f](https://github.com/g4rcez/writeme-editor/commit/d237d3f28e17e8a49df2917f65f8aecbfdf688de))
* **ai:** integrate CLI-based AI assistant with chat and diff capabilities ([dd26325](https://github.com/g4rcez/writeme-editor/commit/dd263257bcc8afa26a7bc0697ac397f2f22ed43e))
* **app:** add note sharing functionality via URL ([85d0e6f](https://github.com/g4rcez/writeme-editor/commit/85d0e6fe26f8eda0f6226e3f8372c23a0e2d4b17))
* **app:** Add Quick Note to Commander and wire IPC ([85b7aff](https://github.com/g4rcez/writeme-editor/commit/85b7affccf1793c16bd201f3f71aa2534cb9b33c))
* **app:** add shortcuts modal and refactor build scripts ([8ab85ee](https://github.com/g4rcez/writeme-editor/commit/8ab85ee8a0aef90c78f687be71acab1818ab020b))
* **app:** Implement Quick Note dedicated window ([ae9ff9f](https://github.com/g4rcez/writeme-editor/commit/ae9ff9f62f065f220295f67642d9d101f70dddcb))
* **assets:** update favicon and apple touch icon ([c574d8a](https://github.com/g4rcez/writeme-editor/commit/c574d8ac98a90b5e9ce18fdb785408b4cbf7e3cf))
* **code-block:** upgrade components and switch to Select ([f84ca32](https://github.com/g4rcez/writeme-editor/commit/f84ca322fbeab19daad4862f18d22b80aab6862e))
* codeblock line numbers ([3688d90](https://github.com/g4rcez/writeme-editor/commit/3688d90bf74c1b59b18f1d4b37e8eba07b6cf32a))
* **conductor:** Add track for file referencing feature ([888f15a](https://github.com/g4rcez/writeme-editor/commit/888f15a785517debe4365ccbaf0c70f77f8dadf1))
* **conductor:** Add track for Quick Note dedicated window ([11c7f60](https://github.com/g4rcez/writeme-editor/commit/11c7f609a1860313dad275e38b511e45dd0879da))
* **conductor:** Add track for Quick Note window controls ([b58b7c9](https://github.com/g4rcez/writeme-editor/commit/b58b7c9b037ae2080d395c610c2a29d0d7880898))
* **core:** implement directory-aware storage mode and robust workspace switching ([4876501](https://github.com/g4rcez/writeme-editor/commit/48765014f06f4c1981b0e5dcfc1584909523fd1a))
* **core:** implement SQLite storage and refactor repository architecture ([bb10473](https://github.com/g4rcez/writeme-editor/commit/bb104738f22301440db07732684ee8f8fa8901a1))
* create PDF from print ([bc88de3](https://github.com/g4rcez/writeme-editor/commit/bc88de35d5dcdcdaeb44b13200cb8c0bee822ff3))
* delete tab when note is deleted ([485bc41](https://github.com/g4rcez/writeme-editor/commit/485bc41b79cb4fb223159d500cbf8495aa8a59a2))
* **editor:** add a[href] styles ([97eccc0](https://github.com/g4rcez/writeme-editor/commit/97eccc039490585d5d727d3433101c28afb76ebb))
* **editor:** add Excalidraw integration and date parsing support ([174f0c0](https://github.com/g4rcez/writeme-editor/commit/174f0c0c9bde7893101a9e9a39ed8e7c97253640))
* **editor:** add find and replace functionality ([9a4c21f](https://github.com/g4rcez/writeme-editor/commit/9a4c21f6672baa23e6e643d42b6fc824600262cd))
* **editor:** add freehand drawing support ([9bc3057](https://github.com/g4rcez/writeme-editor/commit/9bc3057127dcd799fb9342556fc6ae7a4999b8d7))
* **editor:** add global drag handle extension ([93dcea6](https://github.com/g4rcez/writeme-editor/commit/93dcea60ce2b3251db36d947ca929d2a7a32df24))
* **editor:** add GUI builder and text conversion for frontmatter ([96db2bc](https://github.com/g4rcez/writeme-editor/commit/96db2bce466221d49c6fff2632bf90ad1235bdad))
* **editor:** add mathematical expressions, PWA support, and accessibility improvements ([80c1a24](https://github.com/g4rcez/writeme-editor/commit/80c1a249d69302f001e345c3894f5576262c164c))
* **editor:** add note management and math evaluation features ([5f6aab4](https://github.com/g4rcez/writeme-editor/commit/5f6aab400222275d2d2ce4722def9e6a7103abea))
* **editor:** add support for video and pdf preview with lightbox ([68916d1](https://github.com/g4rcez/writeme-editor/commit/68916d1bc0c4f3eccc2b409dcbc3052806b9c34f))
* **editor:** add YouTube video embed support ([a56cdff](https://github.com/g4rcez/writeme-editor/commit/a56cdff761987d927a144c83c542407286345184))
* **editor:** Enable Excalidraw integration in editor blocks ([00d8306](https://github.com/g4rcez/writeme-editor/commit/00d83069ebf01c226854ed9ddc4c2995fa8e5325))
* **editor:** enhance code block paste behavior and mermaid diagram updates ([d5439dd](https://github.com/g4rcez/writeme-editor/commit/d5439dd06c38db8a531ff0d1a05c9b94dde375f8))
* **editor:** enhance code block with language selector and improved UI ([5d8f8d8](https://github.com/g4rcez/writeme-editor/commit/5d8f8d8346345ffd8e9583972d227643ffb58abb))
* **editor:** enhance Graphviz component with themed output and zoom/pan functionality ([241e2f5](https://github.com/g4rcez/writeme-editor/commit/241e2f5c61171bc84fb7c0dbcc862a1beaad653b))
* **editor:** enhance image handling, mentions, and tag exploration ([a1fa290](https://github.com/g4rcez/writeme-editor/commit/a1fa290cd17768bd7217e88a0c8623f083678e5b))
* **editor:** enhance replacer commands and Excalidraw functionality ([28cec79](https://github.com/g4rcez/writeme-editor/commit/28cec795f9b5979d899d2d96e46127f4ecda395b))
* **editor:** implement automatic link conversion and relative link navigation ([5dd2e0e](https://github.com/g4rcez/writeme-editor/commit/5dd2e0eec47fb0fb4e77c22fbddb6e39d1aeeda6))
* **editor:** Implement file referencing with @ mention syntax ([9c4d0af](https://github.com/g4rcez/writeme-editor/commit/9c4d0af676f3c9426e145712a4edaf2c085adfb3))
* **editor:** improve slash command menu behavior and add GitHub CLI skills ([5d3cfcf](https://github.com/g4rcez/writeme-editor/commit/5d3cfcf561ffef54cddd3d348265390f3dc5c539))
* **editor:** improve theme handling and text transformation ([ae908af](https://github.com/g4rcez/writeme-editor/commit/ae908af48489bb05a3b7d1c5d4957c17e7865e6e))
* **editor:** integrate task list extensions and refactor editor logic ([68bd0fc](https://github.com/g4rcez/writeme-editor/commit/68bd0fcddbff042fcc6e3034ce344a3ee1be7f81))
* **editor:** persist and restore cursor and scroll positions ([c917477](https://github.com/g4rcez/writeme-editor/commit/c91747729c25c03381e9c3587e28e4c439be1874))
* **editor:** upgrade tiptap-markdown and improve editor UX ([4dfcc20](https://github.com/g4rcez/writeme-editor/commit/4dfcc2006cac8a665790cf14fcb04c9864d04174))
* **electron:** implement local image paste and improved asset rendering ([3d2fdd9](https://github.com/g4rcez/writeme-editor/commit/3d2fdd934e108800e1f31bbc0ca588baf1d7a710))
* **electron:** implement real-time file system synchronization ([8639ff6](https://github.com/g4rcez/writeme-editor/commit/8639ff6b7e44e9d3321f09bdf8c51480b0567ba8))
* **elements:** add flowchart.js integration for diagram rendering ([e01bee6](https://github.com/g4rcez/writeme-editor/commit/e01bee6351a82fd4c1a99217d23fbedc26ba39b7))
* **elements:** add LaTeX rendering support using MathJax ([b450f47](https://github.com/g4rcez/writeme-editor/commit/b450f477c74e2de7699fea4368c0fc40853f5f65))
* **encoding:** add robust utf-8 base64 encoding utilities ([ffb396e](https://github.com/g4rcez/writeme-editor/commit/ffb396ea9a004a85afb54d77c39bcb88a6d6dd71))
* enhance directory browser, quicknotes, and math evaluation ([c0faded](https://github.com/g4rcez/writeme-editor/commit/c0faded408a19a9fe480e7f0877cfb3599f7a427))
* enhance editor paste handling, dashboard layout, and graph visualization ([80673c6](https://github.com/g4rcez/writeme-editor/commit/80673c65840a0f9c51863f4428fd9199c7485627))
* enhance editor, read-it-later notes, and about page ([15414da](https://github.com/g4rcez/writeme-editor/commit/15414da2e04b0d05be5997460e7967715a8633d8))
* enhance JSON inspection and quick notes management ([8dc9d93](https://github.com/g4rcez/writeme-editor/commit/8dc9d9387d1dd52d166f07afdbd9ec8fdc0f6e2a))
* enhance note navigation and project path visualization ([e97c337](https://github.com/g4rcez/writeme-editor/commit/e97c3370840d578847c5d2091030ab219fffcdd5))
* enhance note navigation and theme management ([7dc125a](https://github.com/g4rcez/writeme-editor/commit/7dc125a5e87959db51ccc25320f2a92366593961)), closes [hi#quality](https://github.com/hi/issues/quality)
* enhance UI components and implement batch note deletion ([137241c](https://github.com/g4rcez/writeme-editor/commit/137241ce3342e0d38becda9eb6318d1fdcfc8589))
* enhance UI with new themes, refactored sidebar, and updated dependencies ([d55cc91](https://github.com/g4rcez/writeme-editor/commit/d55cc91071ad5110b43a03e19bfa550e8476539a))
* enhance UI with table of contents and theme updates ([6f681ed](https://github.com/g4rcez/writeme-editor/commit/6f681edfbae012baba682448e7a029a0922ee821))
* implement code runner and enhance editor UI ([d628296](https://github.com/g4rcez/writeme-editor/commit/d6282963f0d5659831480fe1d64a11b6b4d7bd76))
* implement currency converter to codeBlock ([686f4b7](https://github.com/g4rcez/writeme-editor/commit/686f4b73213cc2f12626df8220c0d61d27b8a972))
* implement dashboard, new note dialog, and landing page overhaul ([44959ec](https://github.com/g4rcez/writeme-editor/commit/44959ecd83c7b4ea0c63e5adab634ac3fade2851))
* implement frontmatter support using markdown-it-front-matter ([78655e6](https://github.com/g4rcez/writeme-editor/commit/78655e632c5d5acfea868e2746eb58d16ecce974))
* implement hashtag support, graph view, and route-based navigation ([38e21cf](https://github.com/g4rcez/writeme-editor/commit/38e21cf0a9e88a3779ce86b1780bc451934e19a3))
* implement hybrid storage system and project management UI ([e9ebbc9](https://github.com/g4rcez/writeme-editor/commit/e9ebbc98a836ae0ae724951711df45a1b0b6aaad))
* implement Read It Later feature and enhance note metadata ([e77c1bb](https://github.com/g4rcez/writeme-editor/commit/e77c1bb302ae7e3760e33c2200b36f0285161ebe))
* implement read-it-later type notes ([c4102a6](https://github.com/g4rcez/writeme-editor/commit/c4102a6dc6b9aa79939f79c74cdfbd8ab038d21c))
* implement tasks from notes ([492494a](https://github.com/g4rcez/writeme-editor/commit/492494ab18e7baba04df08ef1dff764e8af0786b))
* implement templates system and custom variables with accessible UI dialogs ([9be0e0b](https://github.com/g4rcez/writeme-editor/commit/9be0e0b7a1282fdaaf68f467ec9ba0b0e218c824))
* implementa PWA ([6fe5f4b](https://github.com/g4rcez/writeme-editor/commit/6fe5f4b9cd2603bec1fd88e9f9bc079b0a15ce28))
* implementa PWA ([ad60153](https://github.com/g4rcez/writeme-editor/commit/ad601531fa183c0ba4a4b3ff11442b8fa82d5b12))
* improve note creation uniqueness and data consistency ([f30d951](https://github.com/g4rcez/writeme-editor/commit/f30d951ea8e27456a0d7440ede79909ab91bd6d8))
* integrate React Compiler and enhance markdown processing ([712fb09](https://github.com/g4rcez/writeme-editor/commit/712fb09833644df269cac16c22e8880e41d31339))
* **integration:** Integrate TabsBar and implement session restoration ([10989c3](https://github.com/g4rcez/writeme-editor/commit/10989c3f182284e9b3fee622d4fb3f3b230a667d))
* json inspector ([8b673ce](https://github.com/g4rcez/writeme-editor/commit/8b673ce5cbc3f1ee94b53fcc3835828d44c0686e))
* **json:** introduce CodeMirror editor and dual-view for JSON visualization ([e07358a](https://github.com/g4rcez/writeme-editor/commit/e07358a30421cdb31cd628b0cace214995b2ffd4))
* landing page best layout ([2051e38](https://github.com/g4rcez/writeme-editor/commit/2051e38ca85aefa4506b6214ca969a44d0f7ab1b))
* landing page v1 ([cf1933d](https://github.com/g4rcez/writeme-editor/commit/cf1933d433e6f083d67f5dcce403a4fc090c01b3))
* layout improvements ([356825f](https://github.com/g4rcez/writeme-editor/commit/356825f5b9eb494b20e58047ab9fad9180ee40df))
* **markdown-parser:** enhance mention parsing with support for markdown links and wikilinks ([7d5b3e5](https://github.com/g4rcez/writeme-editor/commit/7d5b3e55e1ca65bd7305a4459586477e8f889180))
* **markdown:** improve parser logic and add typescript support ([fb48c30](https://github.com/g4rcez/writeme-editor/commit/fb48c30c1a4c09a6fb79726961aab4b61d758f1f))
* mermaid colors + math blocks ([fe1d093](https://github.com/g4rcez/writeme-editor/commit/fe1d093e723a88b07812f0285626302cde5088d2))
* migrate from tauri ([94abb2d](https://github.com/g4rcez/writeme-editor/commit/94abb2d5ad36dcd3d7d1d02108a2b7cec7d2e510))
* **migration:** implement domain data transfer and upgrade node to 24.14.0 ([dd14778](https://github.com/g4rcez/writeme-editor/commit/dd147789fc214f23b548dff26fb53c2571acf72d))
* **notes:** improve note management and update documentation ([1689090](https://github.com/g4rcez/writeme-editor/commit/1689090be1d1c62cab6e05e358622ac7517c3de2))
* overhaul UI/UX design and theme implementation ([377308c](https://github.com/g4rcez/writeme-editor/commit/377308ceaa0e3ab0f9ffcfa4ee1c37bc6c559ea5))
* **persistence:** Implement tabs data model, repository, and global store actions ([a61b5cd](https://github.com/g4rcez/writeme-editor/commit/a61b5cd63303d2e5951684ab88be5fce15c3e2c3))
* **pwa:** add Progressive Web App support with comprehensive configuration ([0e16a80](https://github.com/g4rcez/writeme-editor/commit/0e16a8015e8d1ca933f80d7bf3318f471d146e66))
* **pwa:** enhance PWA support and improve editor functionality ([676b28a](https://github.com/g4rcez/writeme-editor/commit/676b28af4b09121b1b0a56f7c47e712f4a7760a5))
* **quicknote:** Enable native window controls ([a8a62bc](https://github.com/g4rcez/writeme-editor/commit/a8a62bcecd7270a7f2029abb222942221fe35ece))
* **quicknote:** improve daily quick note workflow and window management ([f07efa1](https://github.com/g4rcez/writeme-editor/commit/f07efa19d82256f5a03c89fae5aac2ae052143b9))
* refactor navigation and enhance terminal integration ([508e489](https://github.com/g4rcez/writeme-editor/commit/508e489ec6d4d6a9abda3a35b208488ce8965a88))
* **shortcuts:** Add Open Recent shortcut (Mod+E) ([6423e85](https://github.com/g4rcez/writeme-editor/commit/6423e85c42ce9d5902ac1c46386dc7fa52ad22ba))
* **sidebar:** add sorting functionality and enhance note list UI ([35ced55](https://github.com/g4rcez/writeme-editor/commit/35ced55c53ce09267657580d00a82ae3440c5808))
* **sidebar:** enhance note sorting UI with tooltips and icons ([af0f368](https://github.com/g4rcez/writeme-editor/commit/af0f368f39aecc2847c6ef866b3361bb8a17a9a2))
* **styling:** implement semantic typography color namespace ([635a82b](https://github.com/g4rcez/writeme-editor/commit/635a82b0fd1afaae18fd11973f43e481128acbc7))
* **suggestions:** improve the floating actions ([544acd2](https://github.com/g4rcez/writeme-editor/commit/544acd2b52843f11d19a0956f2f16ccf3c47e97d))
* table of contents ([a6182da](https://github.com/g4rcez/writeme-editor/commit/a6182da59566bb69c8bb7b23548647a0241a23ac))
* **ui:** Add Recent notes to Commander ([d3a8916](https://github.com/g4rcez/writeme-editor/commit/d3a89167815d25f9a143dd81355a0233d5835458))
* **ui:** implement 3-pane layout and sidebar navigation system ([57668ab](https://github.com/g4rcez/writeme-editor/commit/57668ab7d7f0bf7bf499b56b405b8da97667cee9))
* **ui:** Implement TabsBar component and tab interactions ([a577a36](https://github.com/g4rcez/writeme-editor/commit/a577a3601a615ab7283760df08cb9eda4757b73d))
* **ui:** integrate JSON inspector into sidebar activity bar ([c7ef584](https://github.com/g4rcez/writeme-editor/commit/c7ef584df6b899bdb76779fefdf88e36e5ac8ff4))
* **ui:** introduce interactive JSON inspector panel ([7fcddb8](https://github.com/g4rcez/writeme-editor/commit/7fcddb83f5b0306c92457b62a8626230d67b65ef))
* **ui:** Mount RecentNotesDialog in App ([2bc0623](https://github.com/g4rcez/writeme-editor/commit/2bc0623894c184bbf9a100e78edeacba529f676f))
* **ui:** upgrade component library and replace native confirm dialogs ([b7118b9](https://github.com/g4rcez/writeme-editor/commit/b7118b9a5c7b1fde9bd9abab9f0d85fd9645ed39))
* upgrade dependencies and enhance template variable management ([c5f4028](https://github.com/g4rcez/writeme-editor/commit/c5f40287b05eea1766372b7ea71867860ecc2f45))


### BREAKING CHANGES

* **core:** The storage architecture has been overhauled. Internal repository APIs and the `SettingsRepository` are now asynchronous. Existing desktop installations will undergo a one-time data migration from IndexedDB to the new SQLite database on startup.

2026-02-16T23:42:30 TZ-03(Mon, 047)
* The `Repository.getOne` method signature was corrected to return `Promise<T | null>` instead of `Promise<T[]>`. This aligns the interface with its actual implementation, requiring callers to handle a single object or null instead of an array.

2026-02-15T22:05:25 TZ-03(Sun, 046)
* The "Project" organizational layer has been completely removed. All notes are now managed in a single flat namespace within the selected storage directory. Database schemas and file path generation logic no longer support project IDs or project-specific subdirectories.

2026-02-06T14:19:57 TZ-03(Fri, 037)
