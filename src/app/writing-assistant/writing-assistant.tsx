import { SparkleIcon } from "@phosphor-icons/react";
import { type KeyboardEvent, useEffect, useId, useRef } from "react";
import { Link } from "react-router-dom";
import { adapterRegistry } from "@/app/ai/adapters/registry";
import type { WritingEditorAdapter, WritingSuggestion } from "./types";
import { useWritingAssistant } from "./use-writing-assistant";

type WritingAssistantProps = {
  adapter: WritingEditorAdapter;
  disabled?: boolean;
};

const CATEGORY_LABELS: Record<WritingSuggestion["category"], string> = {
  spelling: "Spelling",
  grammar: "Grammar",
  clarity: "Clarity",
  enhancement: "Enhancement",
};

export function WritingAssistant({ adapter, disabled = false }: WritingAssistantProps) {
  const assistant = useWritingAssistant(adapter, disabled);
  const panelId = useId();
  const configurationId = useId();
  const cardRefs = useRef(new Map<string, HTMLElement>());
  const statusRef = useRef<HTMLParagraphElement>(null);
  const pendingFocusAfterRemovalRef = useRef<string | null | undefined>(undefined);
  const activeSuggestionId = assistant.adapterState.activeSuggestionId;
  const suggestions = assistant.adapterState.suggestions;
  const providerAdapter = assistant.selectedConfiguration
    ? adapterRegistry.get(assistant.selectedConfiguration.adapterId)
    : undefined;
  const providerLabel = assistant.selectedConfiguration
    ? [
      providerAdapter?.name ?? assistant.selectedConfiguration.adapterId,
      assistant.selectedConfiguration.name,
      assistant.selectedConfiguration.model ?? providerAdapter?.defaultModel,
    ]
      .filter(Boolean)
      .join(" · ")
    : "No AI configuration selected";
  const canReview =
    !disabled &&
    adapter.isEditable() &&
    !assistant.isReviewing &&
    !assistant.configurationsLoading &&
    assistant.selectedConfiguration !== null;

  useEffect(() => {
    if (!assistant.isOpen || !activeSuggestionId) return;
    cardRefs.current.get(activeSuggestionId)?.focus();
  }, [activeSuggestionId, assistant.isOpen]);

  useEffect(() => {
    if (pendingFocusAfterRemovalRef.current === undefined) return;
    const targetId = pendingFocusAfterRemovalRef.current;
    pendingFocusAfterRemovalRef.current = undefined;
    if (targetId) cardRefs.current.get(targetId)?.focus();
    else statusRef.current?.focus();
  }, [suggestions]);

  const focusTargetAfterRemoval = (suggestionId: string, remove: () => boolean): void => {
    const suggestionIndex = suggestions.findIndex((suggestion) => suggestion.id === suggestionId);
    const fallbackSuggestionId =
      suggestions[suggestionIndex + 1]?.id ?? suggestions[suggestionIndex - 1]?.id ?? null;
    const removed = remove();
    if (removed || !adapter.getSuggestions().some((suggestion) => suggestion.id === suggestionId)) {
      pendingFocusAfterRemovalRef.current = fallbackSuggestionId;
    }
  };

  const handleEscape = (event: KeyboardEvent<HTMLElement>): void => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    assistant.close(true);
  };

  const isTriggerDisabled = disabled || !adapter.isEditable();

  return (
    <div className="mb-4 w-full min-w-0">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <button
          type="button"
          aria-expanded={assistant.isOpen}
          aria-controls={panelId}
          disabled={isTriggerDisabled}
          onPointerDown={assistant.captureSelection}
          onClick={assistant.toggle}
          className="inline-flex min-h-10 items-center gap-2 rounded-md border border-card-border bg-secondary-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          <SparkleIcon size={16} aria-hidden="true" />
          <span>Writing assistant</span>
        </button>
        {assistant.isOpen && assistant.selectedConfiguration && (
          <span className="min-w-0 truncate text-xs text-muted-foreground" title={providerLabel}>
            {providerLabel}
          </span>
        )}
      </div>

      {assistant.isOpen && (
        <section
          id={panelId}
          role="region"
          aria-label="Writing suggestions"
          onKeyDown={handleEscape}
          className="mt-2 flex max-h-80 min-w-0 flex-col overflow-hidden rounded-md border border-card-border bg-background text-foreground"
        >
          <div className="flex min-w-0 flex-wrap items-start justify-between gap-2 border-b border-card-border px-3 py-2">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold">Writing suggestions</h2>
              {suggestions.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {suggestions.length} {suggestions.length === 1 ? "suggestion" : "suggestions"}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => assistant.close(true)}
              className="inline-flex min-h-10 shrink-0 items-center rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Close
            </button>
          </div>

          <div className="min-h-0 overflow-y-auto px-3 py-3">
            {assistant.configurationsLoading ? (
              <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
                Loading saved AI configurations…
              </p>
            ) : assistant.configurationsError ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <p role="alert" className="text-foreground">
                  {assistant.configurationsError}
                </p>
                <button
                  type="button"
                  onClick={() => void assistant.loadConfigurations()}
                  className="inline-flex min-h-10 items-center rounded-md border border-card-border bg-secondary-background px-3 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Retry
                </button>
                <Link
                  to="/settings/ai"
                  className="inline-flex min-h-10 items-center rounded-md px-2 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  AI settings
                </Link>
              </div>
            ) : assistant.configurations.length === 0 ? (
              <div className="space-y-2 text-sm">
                <p>No saved AI configuration is available for writing review.</p>
                <Link
                  to="/settings/ai"
                  className="inline-flex min-h-10 items-center rounded-md bg-button-primary-bg px-3 text-sm font-medium text-button-primary-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Configure AI
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid min-w-0 gap-1">
                  <label htmlFor={configurationId} className="text-xs font-medium text-foreground">
                    Saved AI configuration
                  </label>
                  <select
                    id={configurationId}
                    value={assistant.selectedConfigurationId}
                    onChange={(event) => assistant.selectConfiguration(event.currentTarget.value)}
                    className="min-h-10 w-full min-w-0 rounded-md border border-card-border bg-secondary-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {assistant.configurations.map((configuration) => {
                      const configuredAdapter = adapterRegistry.get(configuration.adapterId);
                      const label = [
                        configuredAdapter?.name ?? configuration.adapterId,
                        configuration.name,
                        configuration.model ?? configuredAdapter?.defaultModel,
                      ]
                        .filter(Boolean)
                        .join(" · ");
                      return (
                        <option key={configuration.id} value={configuration.id}>
                          {label}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {assistant.selectedConfiguration && (
                  <div className="space-y-2 text-xs leading-relaxed text-muted-foreground">
                    <p>
                      Review sends the selected text or note prose to <strong className="font-medium text-foreground">{providerLabel}</strong>. Nothing is changed until you accept a suggestion.
                    </p>
                    <p>Writing review uses dedicated review instructions, not the saved chat prompt.</p>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={!canReview || assistant.noteCharacters === 0}
                    onClick={() => void assistant.review("note")}
                    className="inline-flex min-h-10 items-center justify-center rounded-md bg-button-primary-bg px-3 text-sm font-medium text-button-primary-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Review note ({assistant.noteCharacters} characters)
                  </button>
                  <button
                    type="button"
                    disabled={!canReview || assistant.selectionCharacters === 0}
                    onPointerDown={assistant.captureSelection}
                    onClick={() => void assistant.review("selection")}
                    className="inline-flex min-h-10 items-center justify-center rounded-md border border-card-border bg-secondary-background px-3 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Review selection ({assistant.selectionCharacters} characters)
                  </button>
                  {assistant.isReviewing && (
                    <button
                      type="button"
                      onClick={assistant.stop}
                      className="inline-flex min-h-10 items-center justify-center rounded-md border border-card-border bg-secondary-background px-3 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      Stop review
                    </button>
                  )}
                </div>
              </div>
            )}
            {!assistant.configurationsLoading &&
              assistant.noteCharacters === 0 &&
              assistant.selectionCharacters === 0 && (
                <p role="status" aria-live="polite" className="mt-3 text-sm text-muted-foreground">
                  No prose to review.
                </p>
              )}
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              Native spelling corrections are available from the right-click menu when provided by your OS or browser;
              supported languages depend on installed dictionaries. Browser enhanced spellcheck may use a cloud
              service. Writeme does not send text for AI review until you choose Review note or Review selection.
            </p>

            {assistant.reviewError && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <p role="alert" className="text-sm text-destructive">{assistant.reviewError}</p>
                <button
                  type="button"
                  disabled={!canReview}
                  onClick={assistant.retry}
                  className="inline-flex min-h-10 items-center rounded-md border border-card-border bg-secondary-background px-3 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Retry review
                </button>
              </div>
            )}
            {(assistant.reviewStatus || assistant.batchProgress) && (
              <p
                ref={statusRef}
                role="status"
                aria-live="polite"
                aria-atomic="true"
                tabIndex={-1}
                className="mt-3 text-sm text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {assistant.batchProgress
                  ? `Reviewing batch ${assistant.batchProgress.current} of ${assistant.batchProgress.total}.`
                  : assistant.reviewStatus}
              </p>
            )}

            {suggestions.length > 0 ? (
              <ol className="mt-2 max-h-48 divide-y divide-card-border overflow-y-auto">
                {suggestions.map((suggestion, index) => (
                  <li key={suggestion.id} className="min-w-0 py-3 first:pt-1 last:pb-1">
                    <article
                      ref={(element) => {
                        if (element) cardRefs.current.set(suggestion.id, element);
                        else cardRefs.current.delete(suggestion.id);
                      }}
                      tabIndex={0}
                      aria-current={activeSuggestionId === suggestion.id ? "true" : undefined}
                      aria-label={`${CATEGORY_LABELS[suggestion.category]} suggestion ${index + 1} for ${suggestion.original}`}
                      className="min-w-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-foreground">
                          {CATEGORY_LABELS[suggestion.category]}
                        </span>
                        <button
                          type="button"
                          aria-label={`Show suggestion ${index + 1} in note`}
                          onClick={() => adapter.reveal(suggestion.id)}
                          className="inline-flex min-h-10 items-center rounded-md px-2 text-xs font-medium text-primary underline-offset-4 hover:bg-muted hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          Show in note
                        </button>
                      </div>
                      <p className="mt-1 break-words text-sm leading-relaxed">
                        <span className="sr-only">Original: </span>
                        <del>{suggestion.original}</del>
                        <span aria-hidden="true" className="px-1 text-muted-foreground">→</span>
                        <span className="sr-only">Suggested: </span>
                        <ins className="no-underline">{suggestion.replacement || "Delete this text"}</ins>
                      </p>
                      <p className="mt-1 break-words text-xs leading-relaxed text-muted-foreground">
                        {suggestion.explanation}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          aria-label={`Accept ${CATEGORY_LABELS[suggestion.category].toLowerCase()} suggestion ${index + 1} for ${suggestion.original}`}
                          onClick={() =>
                            focusTargetAfterRemoval(suggestion.id, () => adapter.accept(suggestion.id))
                          }
                          className="inline-flex min-h-10 items-center justify-center rounded-md bg-button-primary-bg px-3 text-sm font-medium text-button-primary-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          aria-label={`Dismiss ${CATEGORY_LABELS[suggestion.category].toLowerCase()} suggestion ${index + 1} for ${suggestion.original}`}
                          onClick={() =>
                            focusTargetAfterRemoval(suggestion.id, () => {
                              adapter.dismiss(suggestion.id);
                              return true;
                            })
                          }
                          className="inline-flex min-h-10 items-center justify-center rounded-md border border-card-border bg-secondary-background px-3 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          Dismiss
                        </button>
                      </div>
                    </article>
                  </li>
                ))}
              </ol>
            ) : null}
          </div>
        </section>
      )}
    </div>
  );
}
