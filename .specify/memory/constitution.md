<!--
Sync Impact Report:
Version change: [NEW] → 1.0.0
Modified principles: N/A (initial constitution)
Added sections:
  - Core Principles (5 principles)
  - Technology Standards
  - AI Integration Standards
  - Governance
Templates requiring updates:
  ✅ spec-template.md - reviewed, no updates needed (technology-agnostic by design)
  ✅ plan-template.md - reviewed, constitution check section already generic
  ✅ tasks-template.md - reviewed, no updates needed (architecture-agnostic)
Follow-up TODOs: None
-->

# Writeme Editor Constitution

## Core Principles

### I. Technology Stack Adherence (NON-NEGOTIABLE)

**All features MUST be built using the established technology stack:**

- **Frontend Framework**: React 19+ with TypeScript 5.8+
- **Desktop Runtime**: Electron 37+ following main/renderer/preload architecture
- **Styling**: Tailwind CSS 3.4+ for all UI styling
- **Component Library**: @g4rcez/components (https://github.com/g4rcez/components) as the primary design system
- **Editor Foundation**: Tiptap 3+ for all rich text editing features

**Rationale**: Consistency in technology choices prevents fragmentation, reduces maintenance burden, and ensures all team members can contribute effectively. The stack is optimized for building a performant desktop text editor with modern web technologies.

**Violations require explicit architectural review and must document:**
- Why the existing stack is insufficient
- Migration/integration costs
- Long-term maintenance implications

### II. AI-First Command Design

**The editor MUST prioritize command-oriented workflows using the `>>` notation system for user efficiency:**

- Commands starting with `>>` trigger AI-powered actions and shortcuts
- Every repetitive editing task SHOULD have a corresponding `>>` command
- Commands MUST be discoverable, documented, and provide immediate feedback
- Natural language processing should interpret command intent when possible
- Command execution MUST feel instantaneous (< 200ms feedback)

**Rationale**: The core value proposition is saving users time through AI integration. Command-oriented design reduces cognitive load and enables power users to work faster than traditional GUI-only workflows.

**Examples**:
- `>>summarize` - AI summarizes selected text
- `>>format code` - Auto-formats code blocks
- `>>date tomorrow` - Inserts "2025-12-22" using chrono-node parsing

### III. Component Library First

**UI components MUST use @g4rcez/components before creating custom implementations:**

- Check @g4rcez/components documentation before building new UI elements
- Only create custom components when library components cannot satisfy requirements
- Custom components MUST follow the design system's theming patterns
- Contribute reusable components back to @g4rcez/components when appropriate

**Rationale**: Leveraging an established component library ensures UI consistency, accessibility, and reduces development time. Custom components create maintenance debt and visual inconsistencies.

**Exceptions**:
- Editor-specific components (Tiptap extensions)
- Specialized visualizations (Excalidraw, Mermaid)
- Performance-critical custom implementations (must be benchmarked)

### IV. Offline-First Data Persistence

**All user data MUST be stored locally first using Dexie/IndexedDB:**

- Notes and projects MUST be accessible offline
- Cloud sync is supplementary, not primary
- Data models MUST include created/updated timestamps
- Database migrations MUST be versioned and tested
- No data loss scenarios allowed - all operations MUST be transactional

**Rationale**: Users expect their notes to be available regardless of network connectivity. Local-first architecture provides reliability, speed, and user data ownership.

**Requirements**:
- Write operations: < 50ms p95
- Read operations: < 20ms p95
- Support for 10,000+ notes per project
- Automatic conflict resolution for sync scenarios

### V. Progressive Enhancement for AI Features

**AI integrations MUST gracefully degrade when unavailable:**

- Core editing functionality works without AI services
- AI features provide clear loading/error states
- Fallback behaviors for API failures
- Local processing preferred when feasible (e.g., date parsing with chrono-node)
- User MUST be able to edit, save, and retrieve notes without internet

**Rationale**: AI services have latency and availability constraints. The editor must remain functional and reliable even when AI features fail.

**Implementation Pattern**:
```typescript
// Good: Graceful degradation
const aiResult = await tryAIFeature().catch(() => fallbackBehavior())

// Bad: Blocking on AI
const aiResult = await callAI() // throws if unavailable
```

## Technology Standards

### Architecture Constraints

**Electron Process Architecture MUST be maintained:**

- **Main Process** (`src/main.ts`): Window management, IPC handlers, file system access
- **Renderer Process** (`src/app/**`): React UI, editor logic, user interactions
- **Preload Scripts** (`src/preload.ts`): Secure IPC bridge, context isolation enabled

**Security Requirements:**
- Context isolation MUST be enabled
- Node integration MUST be disabled in renderer
- All main-renderer communication via IPC only
- Content Security Policy enforced

### State Management

**Use use-typed-reducer for global application state:**

- Theme preferences
- Current note/project context
- User settings and configurations
- UI state (sidebar visibility, modals, etc.)

**Rationale**: Existing architecture uses `use-typed-reducer` in `src/store/global.store.ts`. Introducing additional state management libraries creates unnecessary complexity.

### Styling Standards

**Tailwind CSS usage:**

- Use Tailwind utility classes for all styling
- Custom CSS only for complex animations or Tiptap editor customizations
- Theme tokens defined in `tailwind.config.ts`
- Support light/dark themes via CSS class switching
- Use `tw-merge` and `clsx` for conditional class composition

## AI Integration Standards

### Command Notation Protocol

**The `>>` notation system:**

1. **Detection**: Listen for `>>` prefix in editor content
2. **Parsing**: Extract command name and arguments
3. **Execution**: Route to appropriate handler (local or AI)
4. **Feedback**: Replace command text with result or show inline UI
5. **Undo**: Support undo/redo for all command executions

**Command Categories:**

- **Text transformation**: summarize, expand, rephrase, translate
- **Code operations**: format, explain, debug
- **Data insertion**: date, time, calculations, lookups
- **Workflow automation**: templates, snippets, macros

### AI Service Integration

**When integrating AI services:**

- MUST have timeout limits (default 30s)
- MUST show progress indicators for operations > 1s
- MUST cache responses when appropriate
- MUST respect user privacy (local processing preferred)
- MUST allow users to configure AI providers (OpenAI, Anthropic, local models)

## Governance

### Amendment Process

**This constitution can be amended through:**

1. Proposal documenting the change rationale
2. Impact assessment on existing codebase
3. Team review and approval
4. Version bump following semantic versioning
5. Update of dependent templates and documentation

### Versioning Policy

- **MAJOR** (X.0.0): Removing/redefining core principles, breaking changes to governance
- **MINOR** (x.Y.0): Adding new principles, expanding sections, new constraints
- **PATCH** (x.y.Z): Clarifications, typo fixes, non-semantic improvements

### Compliance

**All code reviews MUST verify:**

- Technology stack adherence
- Component library usage before custom implementations
- AI feature graceful degradation
- Offline-first data handling
- Security best practices (IPC boundaries, CSP)

**Complexity Justification:**

Any violation of these principles MUST be documented in the implementation plan's "Complexity Tracking" section with:
- Specific principle violated
- Why it's necessary
- Simpler alternatives considered and rejected

### Development Guidance

For runtime development guidance and workflow details, see project-specific documentation:
- `CLAUDE.md` - AI assistant context and common commands
- `README.md` - Project overview and setup
- `.specify/templates/` - Spec/plan/task templates

**Version**: 1.0.0 | **Ratified**: 2025-12-21 | **Last Amended**: 2025-12-21
