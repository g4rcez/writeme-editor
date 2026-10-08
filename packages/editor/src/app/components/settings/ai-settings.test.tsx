import type {
    ButtonHTMLAttributes,
    ChangeEventHandler,
    InputHTMLAttributes,
    ReactNode,
    Ref,
    SelectHTMLAttributes,
    TextareaHTMLAttributes,
} from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AISettings } from "./ai-settings";

const mocks = vi.hoisted(() => ({
    getConfigs: vi.fn(),
    loadCredentials: vi.fn(),
    saveConfig: vi.fn(),
    saveCredentials: vi.fn(),
    clearRepositoryCredentials: vi.fn(),
    getCredentials: vi.fn(),
    startOAuthFlow: vi.fn(),
    completeOAuthFlow: vi.fn(),
    cancelOAuthFlow: vi.fn(),
    clearCredentials: vi.fn(),
    listAnthropicModels: vi.fn(),
    listOpenAIModels: vi.fn(),
    listOllamaModels: vi.fn(),
    setAlert: vi.fn(),
    isElectron: vi.fn(),
    prepareCredentialStorage: vi.fn(),
    copyDeviceCode: vi.fn(),
}));

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
    children: ReactNode;
    size?: string;
    theme?: string;
};

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
    container?: string;
    hiddenLabel?: boolean;
};

type SelectOption = { value: string; label?: string; disabled?: boolean };
type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "onChange"> & {
    ref?: Ref<HTMLSelectElement>;
    hiddenLabel?: boolean;
    loading?: boolean;
    placeholder?: string;
    onChange?: ChangeEventHandler<HTMLSelectElement>;
    options: SelectOption[];
    title: string;
};

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
    optionalText?: string;
    hiddenLabel?: boolean;
};
type ModalProps = {
    open: boolean;
    onChange: (open: boolean) => void;
    title: ReactNode;
    children: ReactNode;
    footer: ReactNode;
};

vi.mock("@g4rcez/components", () => ({
    Button: ({ children, size: _size, theme: _theme, ...props }: ButtonProps) => (
        <button type="button" {...props}>
            {children}
        </button>
    ),
    Input: ({ container: _container, hiddenLabel: _hiddenLabel, title, ...props }: InputProps) => (
        <input aria-label={title} {...props} />
    ),
    Select: ({ ref, hiddenLabel: _hiddenLabel, loading, options, placeholder, title, ...props }: SelectProps) => (
        <select ref={ref} aria-label={title} aria-busy={loading} {...props}>
            {placeholder && <option value="">{placeholder}</option>}
            {options.map((option) => (
                <option key={option.value} value={option.value} disabled={option.disabled}>
                    {option.label ?? option.value}
                </option>
            ))}
        </select>
    ),
    Textarea: ({ optionalText: _optionalText, hiddenLabel: _hiddenLabel, title, ...props }: TextareaProps) => (
        <textarea aria-label={title} {...props} />
    ),
    Modal: ({ open, title, children, footer }: ModalProps) =>
        open ? (
            <dialog open aria-label={typeof title === "string" ? title : undefined}>
                {children}
                {footer}
            </dialog>
        ) : null,
    css: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" "),
}));

vi.mock("@/app/ai/adapters/registry", () => {
    const anthropicAdapter = {
        id: "anthropic",
        name: "Anthropic (Claude)",
        supportsOAuth: true,
        defaultModel: "claude-test",
        listModels: mocks.listAnthropicModels,
    };
    const openAIAdapter = {
        id: "openai",
        name: "OpenAI (GPT)",
        supportsOAuth: true,
        defaultModel: "gpt-4o",
        listModels: mocks.listOpenAIModels,
    };
    const ollamaAdapter = {
        id: "ollama",
        name: "Ollama",
        supportsOAuth: false,
        defaultModel: "llama3.2",
        listModels: mocks.listOllamaModels,
    };
    const adapters = [anthropicAdapter, openAIAdapter, ollamaAdapter];

    return {
        adapterRegistry: {
            getAll: () => adapters,
            get: (id: string) => adapters.find((adapter) => adapter.id === id),
        },
    };
});

vi.mock("@/app/ai/auth/auth-manager", () => ({
    authManager: {
        getCredentials: mocks.getCredentials,
        saveCredentials: mocks.saveCredentials,
        startOAuthFlow: mocks.startOAuthFlow,
        completeOAuthFlow: mocks.completeOAuthFlow,
        cancelOAuthFlow: mocks.cancelOAuthFlow,
        clearCredentials: mocks.clearCredentials,
    },
}));

vi.mock("@/lib/is-electron", () => ({ isElectron: mocks.isElectron }));
vi.mock("@/lib/copy-device-code", () => ({ copyDeviceCode: mocks.copyDeviceCode }));

vi.mock("@/store/repositories", () => ({
    repositories: {
        ai: {
            getConfigs: mocks.getConfigs,
            loadCredentials: mocks.loadCredentials,
            saveConfig: mocks.saveConfig,
            saveCredentials: mocks.saveCredentials,
            clearCredentials: mocks.clearRepositoryCredentials,
        },
    },
}));

vi.mock("@/store/ui.store", () => ({
    uiDispatch: { setAlert: mocks.setAlert },
}));

function openAIConfig(model: string) {
    return {
        id: "openai-config",
        name: "OpenAI Config",
        adapterId: "openai",
        model,
        systemPrompt: "",
        isDefault: true,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
    };
}

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((promiseResolve) => {
        resolve = promiseResolve;
    });
    return { promise, resolve };
}

async function allowStorage(): Promise<void> {
    fireEvent.click(await screen.findByRole("button", { name: "Allow and continue" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
}

afterEach(() => vi.unstubAllGlobals());

beforeEach(() => {
    vi.clearAllMocks();
    mocks.isElectron.mockReturnValue(false);
    mocks.prepareCredentialStorage.mockResolvedValue(undefined);
    mocks.copyDeviceCode.mockResolvedValue(true);
    mocks.saveCredentials.mockResolvedValue(undefined);
    vi.stubGlobal("electronAPI", { ai: { prepareCredentialStorage: mocks.prepareCredentialStorage } });
    mocks.getConfigs.mockResolvedValue([openAIConfig("gpt-5-mini")]);
    mocks.loadCredentials.mockImplementation(async (adapterId: string) =>
        adapterId === "openai" ? { adapterId, accessToken: "stored-token", accountId: "account-id" } : null,
    );
    mocks.getCredentials.mockResolvedValue({
        accessToken: "fresh-token",
        accountId: "account-id",
    });
    mocks.listAnthropicModels.mockResolvedValue([]);
    mocks.listOllamaModels.mockResolvedValue([]);
    mocks.startOAuthFlow.mockResolvedValue({
        message: "Finish signing in with OpenAI.",
    });
    mocks.completeOAuthFlow.mockResolvedValue(undefined);
    mocks.clearCredentials.mockResolvedValue(undefined);
    mocks.saveConfig.mockResolvedValue(undefined);
});

describe("AISettings OpenAI models", () => {
    it("starts with the credential-configured provider instead of a stale default config", async () => {
        const configs = deferred<Array<ReturnType<typeof openAIConfig>>>();
        mocks.getConfigs.mockReturnValue(configs.promise);

        render(<AISettings />);

        expect(screen.getByRole("status")).toHaveTextContent("Loading AI configuration");
        expect(screen.queryByRole("button", { name: /Anthropic \(Claude\)/ })).not.toBeInTheDocument();

        await act(async () => {
            configs.resolve([
                {
                    ...openAIConfig("claude-test"),
                    id: "anthropic-config",
                    name: "Anthropic Config",
                    adapterId: "anthropic",
                },
            ]);
            await configs.promise;
        });

        const openAIButton = await screen.findByRole("button", { name: /OpenAI \(GPT\)/ });
        expect(openAIButton).toHaveAttribute("aria-pressed", "true");
        expect(screen.getByRole("button", { name: /Anthropic \(Claude\)/ })).toHaveAttribute("aria-pressed", "false");
    });

    it("loads connected account models and preserves the configured model", async () => {
        mocks.listOpenAIModels.mockResolvedValue([
            { id: "gpt-5", name: "GPT-5" },
            { id: "gpt-5-mini", name: "GPT-5 mini" },
        ]);

        render(<AISettings />);

        const modelSelect = await screen.findByRole("combobox", { name: "Model" });
        await waitFor(() => expect(modelSelect).toHaveValue("gpt-5-mini"));

        expect(modelSelect).toBeEnabled();
        expect(screen.getByRole("option", { name: "GPT-5" })).toBeInTheDocument();
        expect(screen.getByRole("option", { name: "GPT-5 mini" })).toBeInTheDocument();
        expect(mocks.getCredentials).toHaveBeenCalledTimes(1);
        expect(mocks.listOpenAIModels).toHaveBeenCalledWith({
            accessToken: "fresh-token",
            accountId: "account-id",
        });

        fireEvent.click(screen.getByRole("button", { name: /OpenAI \(GPT\)/ }));
        expect(modelSelect).toHaveValue("gpt-5-mini");
        expect(mocks.listOpenAIModels).toHaveBeenCalledTimes(1);
    });

    it("keeps the OpenAI select visible and retries an empty model response", async () => {
        mocks.getConfigs.mockResolvedValue([openAIConfig("removed-model")]);
        mocks.listOpenAIModels.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: "gpt-5", name: "GPT-5" }]);

        render(<AISettings />);

        const modelSelect = await screen.findByRole("combobox", { name: "Model" });
        expect(await screen.findByRole("alert")).toHaveTextContent("OpenAI returned no available models");
        expect(modelSelect).toBeDisabled();
        const saveButton = screen.getByRole("button", { name: "Save Configuration" });
        expect(saveButton).toBeDisabled();

        const retryButton = screen.getByRole("button", { name: "Retry loading models" });
        retryButton.focus();
        fireEvent.click(retryButton);

        expect(screen.getByRole("button", { name: "Retrying..." })).toHaveFocus();
        await waitFor(() => expect(modelSelect).toHaveValue("gpt-5"));
        expect(modelSelect).toBeEnabled();
        expect(modelSelect).toHaveFocus();
        expect(saveButton).toBeEnabled();
        expect(mocks.listOpenAIModels).toHaveBeenCalledTimes(2);
    });

    it("loads models after completing OpenAI OAuth", async () => {
        mocks.loadCredentials.mockResolvedValue(null);
        mocks.listOpenAIModels.mockResolvedValue([{ id: "gpt-5", name: "GPT-5" }]);

        render(<AISettings />);

        const modelSelect = await screen.findByRole("combobox", { name: "Model" });
        await waitFor(() => expect(modelSelect).toBeDisabled());
        fireEvent.click(screen.getByRole("button", { name: "Sign in with OpenAI" }));
        await allowStorage();
        fireEvent.click(await screen.findByRole("button", { name: "Complete sign-in" }));

        await waitFor(() => expect(modelSelect).toHaveValue("gpt-5"));
        expect(modelSelect).toBeEnabled();
        expect(mocks.completeOAuthFlow).toHaveBeenCalledWith("openai", "");
        expect(mocks.listOpenAIModels).toHaveBeenCalledTimes(1);
    });

    it("ignores a stale OAuth start result after switching providers", async () => {
        const oauthStart = deferred<{ message: string }>();
        mocks.loadCredentials.mockResolvedValue(null);
        mocks.startOAuthFlow.mockReturnValue(oauthStart.promise);

        render(<AISettings />);

        fireEvent.click(await screen.findByRole("button", { name: "Sign in with OpenAI" }));
        await allowStorage();
        const anthropicButton = screen.getByRole("button", { name: /Anthropic \(Claude\)/ });
        fireEvent.click(anthropicButton);
        await waitFor(() => expect(anthropicButton).toHaveTextContent("Needs setup"));

        await act(async () => {
            oauthStart.resolve({ message: "Stale OpenAI sign-in instructions" });
            await oauthStart.promise;
        });

        expect(screen.queryByText("Stale OpenAI sign-in instructions")).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Complete sign-in" })).not.toBeInTheDocument();
        expect(anthropicButton).toHaveAttribute("aria-pressed", "true");
    });

    it("ignores a stale OAuth completion after switching providers", async () => {
        const oauthCompletion = deferred<void>();
        mocks.loadCredentials.mockResolvedValue(null);
        mocks.completeOAuthFlow.mockReturnValue(oauthCompletion.promise);

        render(<AISettings />);

        fireEvent.click(await screen.findByRole("button", { name: "Sign in with OpenAI" }));
        await allowStorage();
        fireEvent.click(await screen.findByRole("button", { name: "Complete sign-in" }));
        const anthropicButton = screen.getByRole("button", { name: /Anthropic \(Claude\)/ });
        fireEvent.click(anthropicButton);
        await waitFor(() => expect(anthropicButton).toHaveTextContent("Needs setup"));

        await act(async () => {
            oauthCompletion.resolve();
            await oauthCompletion.promise;
        });

        expect(anthropicButton).toHaveAttribute("aria-pressed", "true");
        expect(anthropicButton).toHaveTextContent("Needs setup");
        expect(mocks.listOpenAIModels).not.toHaveBeenCalled();
        expect(mocks.setAlert).not.toHaveBeenCalledWith(expect.objectContaining({ type: "success" }));
    });

    it("keeps the Ollama model loading flow unchanged", async () => {
        mocks.listOpenAIModels.mockResolvedValue([{ id: "gpt-5", name: "GPT-5" }]);
        mocks.listOllamaModels.mockResolvedValue([{ id: "llama3.2", name: "Llama 3.2" }]);

        render(<AISettings />);

        await waitFor(() => expect(mocks.listOpenAIModels).toHaveBeenCalledTimes(1));
        fireEvent.click(screen.getByRole("button", { name: /Ollama/ }));

        const modelSelect = await screen.findByRole("combobox", { name: "Model" });
        expect(modelSelect).toBeDisabled();
        fireEvent.click(screen.getByRole("button", { name: "Load models" }));

        await waitFor(() => expect(modelSelect).toHaveValue("llama3.2"));
        expect(modelSelect).toBeEnabled();
        expect(mocks.listOllamaModels).toHaveBeenCalledWith({
            baseUrl: "http://localhost:11434/v1",
        });
    });

    it("ignores an OpenAI model response after switching providers", async () => {
        const modelResponse = deferred<Array<{ id: string; name: string }>>();
        mocks.listOpenAIModels.mockReturnValue(modelResponse.promise);

        render(<AISettings />);

        await waitFor(() => expect(mocks.listOpenAIModels).toHaveBeenCalledTimes(1));
        fireEvent.click(screen.getByRole("button", { name: /Anthropic \(Claude\)/ }));

        await act(async () => {
            modelResponse.resolve([{ id: "stale-openai-model", name: "Stale OpenAI model" }]);
            await modelResponse.promise;
        });

        await waitFor(() => expect(screen.getByDisplayValue("claude-test")).toBeInTheDocument());
        expect(screen.queryByRole("combobox", { name: "Model" })).not.toBeInTheDocument();
        expect(screen.queryByDisplayValue("stale-openai-model")).not.toBeInTheDocument();
    });

    it("ignores a stale credential result after switching providers", async () => {
        const anthropicCredentials = deferred<{ adapterId: string; accessToken: string }>();
        let anthropicCredentialCalls = 0;
        mocks.loadCredentials.mockImplementation((adapterId: string) => {
            if (adapterId === "openai") {
                return Promise.resolve({ adapterId, accessToken: "stored-token", accountId: "account-id" });
            }
            if (adapterId === "anthropic") {
                anthropicCredentialCalls += 1;
                return anthropicCredentialCalls === 1 ? Promise.resolve(null) : anthropicCredentials.promise;
            }
            return Promise.resolve(null);
        });
        mocks.listOpenAIModels.mockResolvedValue([]);

        render(<AISettings />);

        const anthropicButton = await screen.findByRole("button", { name: /Anthropic \(Claude\)/ });
        fireEvent.click(anthropicButton);
        const ollamaButton = screen.getByRole("button", { name: /Ollama/ });
        fireEvent.click(ollamaButton);
        await waitFor(() => expect(ollamaButton).toHaveTextContent("Needs setup"));

        await act(async () => {
            anthropicCredentials.resolve({
                adapterId: "anthropic",
                accessToken: "stale-token",
            });
            await anthropicCredentials.promise;
        });

        expect(ollamaButton).toHaveAttribute("aria-pressed", "true");
        expect(ollamaButton).toHaveTextContent("Needs setup");
    });

    it("ignores a stale Ollama response after switching providers", async () => {
        const ollamaResponse = deferred<Array<{ id: string; name: string }>>();
        mocks.listOpenAIModels.mockResolvedValue([]);
        mocks.listOllamaModels.mockReturnValue(ollamaResponse.promise);

        render(<AISettings />);

        const ollamaButton = await screen.findByRole("button", { name: /Ollama/ });
        fireEvent.click(ollamaButton);
        fireEvent.click(await screen.findByRole("button", { name: "Load models" }));
        await waitFor(() => expect(mocks.listOllamaModels).toHaveBeenCalledTimes(1));

        const anthropicButton = screen.getByRole("button", { name: /Anthropic \(Claude\)/ });
        fireEvent.click(anthropicButton);
        await waitFor(() => expect(anthropicButton).toHaveTextContent("Needs setup"));

        await act(async () => {
            ollamaResponse.resolve([{ id: "stale-ollama-model", name: "Stale Ollama model" }]);
            await ollamaResponse.promise;
        });

        expect(anthropicButton).toHaveTextContent("Needs setup");
        expect(screen.queryByText(/Connected — 1 model/)).not.toBeInTheDocument();
    });

    it("ignores a stale generic provider test after switching providers", async () => {
        const anthropicResponse = deferred<Array<{ id: string; name: string }>>();
        mocks.listOpenAIModels.mockResolvedValue([]);
        mocks.listAnthropicModels.mockReturnValue(anthropicResponse.promise);

        render(<AISettings />);

        const anthropicButton = await screen.findByRole("button", { name: /Anthropic \(Claude\)/ });
        fireEvent.click(anthropicButton);
        const apiKeyInput = await screen.findByPlaceholderText("Starts with sk-ant-");
        fireEvent.change(apiKeyInput, { target: { value: "stale-api-key" } });
        fireEvent.click(screen.getByRole("button", { name: "Verify and save key" }));
        await allowStorage();
        await waitFor(() => expect(mocks.listAnthropicModels).toHaveBeenCalledTimes(1));

        const ollamaButton = screen.getByRole("button", { name: /Ollama/ });
        fireEvent.click(ollamaButton);
        await waitFor(() => expect(ollamaButton).toHaveTextContent("Needs setup"));

        await act(async () => {
            anthropicResponse.resolve([{ id: "stale-anthropic-model", name: "Stale Anthropic model" }]);
            await anthropicResponse.promise;
        });

        expect(ollamaButton).toHaveTextContent("Needs setup");
        expect(mocks.saveCredentials).not.toHaveBeenCalledWith(
            "anthropic",
            expect.objectContaining({ apiKey: "stale-api-key" }),
        );
    });

    it("keeps the newly selected provider connected when an older disconnect finishes", async () => {
        const disconnect = deferred<void>();
        let openAICredentialsAvailable = true;
        mocks.listOpenAIModels.mockResolvedValue([]);
        mocks.loadCredentials.mockImplementation(async (adapterId: string) => {
            if (adapterId === "openai" && openAICredentialsAvailable) {
                return { adapterId, accessToken: "openai-token" };
            }
            if (adapterId === "anthropic") {
                return { adapterId, accessToken: "anthropic-token" };
            }
            return null;
        });
        mocks.clearCredentials.mockImplementation(async () => {
            await disconnect.promise;
            openAICredentialsAvailable = false;
        });

        render(<AISettings />);

        const openAIButton = await screen.findByRole("button", { name: /OpenAI \(GPT\)/ });
        await waitFor(() => expect(openAIButton).toHaveTextContent("Connected"));
        fireEvent.click(screen.getByRole("button", { name: "Disconnect OpenAI account" }));

        const anthropicButton = screen.getByRole("button", { name: /Anthropic \(Claude\)/ });
        fireEvent.click(anthropicButton);
        await waitFor(() => expect(anthropicButton).toHaveTextContent("Connected"));

        fireEvent.click(openAIButton);
        await waitFor(() => expect(openAIButton).toHaveTextContent("Checking"));

        await act(async () => {
            disconnect.resolve();
            await disconnect.promise;
        });

        await waitFor(() => expect(openAIButton).toHaveTextContent("Needs setup"));
    });

    it("cancels an in-flight OAuth completion", async () => {
        const oauthCompletion = deferred<void>();
        mocks.loadCredentials.mockResolvedValue(null);
        mocks.completeOAuthFlow.mockReturnValue(oauthCompletion.promise);

        render(<AISettings />);

        fireEvent.click(await screen.findByRole("button", { name: "Sign in with OpenAI" }));
        await allowStorage();
        fireEvent.click(await screen.findByRole("button", { name: "Complete sign-in" }));
        fireEvent.click(screen.getByRole("button", { name: "Cancel sign-in" }));
        expect(mocks.cancelOAuthFlow).toHaveBeenCalledTimes(1);

        await act(async () => {
            oauthCompletion.resolve();
            await oauthCompletion.promise;
        });

        expect(mocks.setAlert).not.toHaveBeenCalledWith(expect.objectContaining({ type: "success" }));
        expect(screen.getByRole("button", { name: "Sign in with OpenAI" })).toBeInTheDocument();
    });
});

describe("AISettings secure setup", () => {
    beforeEach(() => {
        mocks.loadCredentials.mockResolvedValue(null);
        mocks.listOpenAIModels.mockResolvedValue([]);
    });

    it("shows a browser storage warning and waits for consent before sign-in", async () => {
        render(<AISettings />);
        fireEvent.click(await screen.findByRole("button", { name: "Sign in with OpenAI" }));
        expect(screen.getByRole("dialog", { name: "Store credentials in this browser?" })).toHaveTextContent(
            "without system Keychain protection",
        );
        expect(mocks.startOAuthFlow).not.toHaveBeenCalled();
        expect(mocks.prepareCredentialStorage).not.toHaveBeenCalled();
        await allowStorage();
        expect(mocks.startOAuthFlow).toHaveBeenCalledExactlyOnceWith("openai");
    });

    it("cancels setup without opening the provider or requesting native access", async () => {
        mocks.isElectron.mockReturnValue(true);
        render(<AISettings />);
        fireEvent.click(await screen.findByRole("button", { name: "Sign in with OpenAI" }));
        fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(mocks.startOAuthFlow).not.toHaveBeenCalled();
        expect(mocks.prepareCredentialStorage).not.toHaveBeenCalled();
    });

    it("identifies an outdated production bridge instead of blaming Keychain", async () => {
        mocks.isElectron.mockReturnValue(true);
        mocks.prepareCredentialStorage.mockRejectedValue(
            new Error("Error invoking remote method: No handler registered for 'ai:prepare-credential-storage'"),
        );
        render(<AISettings />);
        fireEvent.click(await screen.findByRole("button", { name: "Sign in with OpenAI" }));
        fireEvent.click(await screen.findByRole("button", { name: "Allow and continue" }));
        const alert = await screen.findByRole("alert");
        expect(alert).toHaveTextContent("outdated desktop bridge");
        expect(alert).not.toHaveTextContent("Keychain");
        expect(mocks.startOAuthFlow).not.toHaveBeenCalled();
    });

    it("distinguishes a denied setup window from encryption unavailability", async () => {
        mocks.isElectron.mockReturnValue(true);
        mocks.prepareCredentialStorage.mockRejectedValue(new Error("AI setup access denied."));
        render(<AISettings />);
        fireEvent.click(await screen.findByRole("button", { name: "Sign in with OpenAI" }));
        fireEvent.click(await screen.findByRole("button", { name: "Allow and continue" }));
        expect(await screen.findByRole("alert")).toHaveTextContent("main Write Me window");
        expect(mocks.startOAuthFlow).not.toHaveBeenCalled();
    });

    it("offers production diagnostics without displaying a raw native exception", async () => {
        mocks.isElectron.mockReturnValue(true);
        mocks.prepareCredentialStorage.mockRejectedValue(new Error("Synthetic private exception"));
        render(<AISettings />);
        fireEvent.click(await screen.findByRole("button", { name: "Sign in with OpenAI" }));
        fireEvent.click(await screen.findByRole("button", { name: "Allow and continue" }));
        const alert = await screen.findByRole("alert");
        expect(alert).toHaveTextContent("View > Toggle Developer Tools");
        expect(alert).not.toHaveTextContent("Synthetic private exception");
        expect(mocks.startOAuthFlow).not.toHaveBeenCalled();
    });

    it("checks native encrypted storage before opening sign-in", async () => {
        mocks.isElectron.mockReturnValue(true);
        render(<AISettings />);
        fireEvent.click(await screen.findByRole("button", { name: "Sign in with OpenAI" }));
        await allowStorage();
        expect(mocks.prepareCredentialStorage).toHaveBeenCalledOnce();
        expect(mocks.prepareCredentialStorage.mock.invocationCallOrder[0]).toBeLessThan(
            mocks.startOAuthFlow.mock.invocationCallOrder[0] ?? 0,
        );
    });

    it("blocks sign-in when storage access is denied and allows a retry", async () => {
        mocks.isElectron.mockReturnValue(true);
        mocks.prepareCredentialStorage.mockRejectedValue(new Error("Access denied"));
        render(<AISettings />);
        fireEvent.click(await screen.findByRole("button", { name: "Sign in with OpenAI" }));
        fireEvent.click(screen.getByRole("button", { name: "Allow and continue" }));
        expect(await screen.findByRole("alert")).toHaveTextContent("login Keychain");
        expect(mocks.startOAuthFlow).not.toHaveBeenCalled();
        expect(mocks.saveCredentials).not.toHaveBeenCalled();
        mocks.prepareCredentialStorage.mockResolvedValue(undefined);
        await allowStorage();
        expect(mocks.startOAuthFlow).toHaveBeenCalledOnce();
    });

    it("does not start stale sign-in after switching providers during storage preparation", async () => {
        mocks.isElectron.mockReturnValue(true);
        const storage = deferred<void>();
        mocks.prepareCredentialStorage.mockReturnValue(storage.promise);
        render(<AISettings />);
        fireEvent.click(await screen.findByRole("button", { name: "Sign in with OpenAI" }));
        fireEvent.click(screen.getByRole("button", { name: "Allow and continue" }));
        await waitFor(() => expect(mocks.prepareCredentialStorage).toHaveBeenCalledOnce());
        fireEvent.click(screen.getByRole("button", { name: /Anthropic \(Claude\)/ }));
        await act(async () => {
            storage.resolve();
            await storage.promise;
        });
        expect(mocks.startOAuthFlow).not.toHaveBeenCalled();
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Anthropic \(Claude\)/ })).toHaveAttribute("aria-pressed", "true");
    });

    it("does not start sign-in after canceling a pending storage request", async () => {
        mocks.isElectron.mockReturnValue(true);
        const storage = deferred<void>();
        mocks.prepareCredentialStorage.mockReturnValue(storage.promise);
        render(<AISettings />);
        fireEvent.click(await screen.findByRole("button", { name: "Sign in with OpenAI" }));
        fireEvent.click(screen.getByRole("button", { name: "Allow and continue" }));
        fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
        await act(async () => {
            storage.resolve();
            await storage.promise;
        });
        expect(mocks.startOAuthFlow).not.toHaveBeenCalled();
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("lets the user cancel sign-in while the device-code request is pending", async () => {
        const signIn = deferred<{ message: string }>();
        mocks.startOAuthFlow.mockReturnValue(signIn.promise);
        render(<AISettings />);
        fireEvent.click(await screen.findByRole("button", { name: "Sign in with OpenAI" }));
        await allowStorage();
        fireEvent.click(screen.getByRole("button", { name: "Cancel sign-in" }));
        expect(mocks.cancelOAuthFlow).toHaveBeenCalledOnce();
        await act(async () => {
            signIn.resolve({ message: "Canceled sign-in instructions" });
            await signIn.promise;
        });
        expect(screen.queryByText("Canceled sign-in instructions")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Sign in with OpenAI" })).toBeEnabled();
    });

    it("retains an entered API key if native storage fails before verification", async () => {
        mocks.isElectron.mockReturnValue(true);
        mocks.prepareCredentialStorage.mockRejectedValue(new Error("Access denied"));
        render(<AISettings />);
        fireEvent.click(await screen.findByRole("button", { name: /Anthropic \(Claude\)/ }));
        const key = await screen.findByLabelText("API key");
        fireEvent.change(key, { target: { value: "synthetic-api-key" } });
        fireEvent.click(screen.getByRole("button", { name: "Verify and save key" }));
        expect(mocks.listAnthropicModels).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: "Allow and continue" }));
        expect(await screen.findByRole("alert")).toHaveTextContent("No new credentials have been saved");
        expect(key).toHaveValue("synthetic-api-key");
        expect(mocks.listAnthropicModels).not.toHaveBeenCalled();
        expect(mocks.saveCredentials).not.toHaveBeenCalled();
    });

    it("shows the copied device code and offers a manual copy retry", async () => {
        mocks.startOAuthFlow.mockResolvedValue({
            message: "Enter your code.",
            deviceCode: {
                userCode: "ABCD-1234",
                verificationUrl: "https://auth.openai.com/codex/device",
                copied: false,
            },
        });
        render(<AISettings />);
        fireEvent.click(await screen.findByRole("button", { name: "Sign in with OpenAI" }));
        await allowStorage();
        const code = await screen.findByLabelText("Device authorization code");
        expect(code).toHaveValue("ABCD-1234");
        expect(code).toHaveAttribute("readonly");
        fireEvent.focus(code);
        if (!(code instanceof HTMLInputElement)) throw new Error("Expected a code input");
        expect(code.selectionStart).toBe(0);
        expect(code.selectionEnd).toBe("ABCD-1234".length);
        expect(screen.getByRole("status")).toHaveTextContent("Automatic copy was unavailable");
        fireEvent.click(screen.getByRole("button", { name: "Copy code" }));
        await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Code copied to clipboard."));
        expect(mocks.copyDeviceCode).toHaveBeenCalledExactlyOnceWith("ABCD-1234");
    });

    it("announces clipboard success without exposing the device authentication identifier", async () => {
        mocks.startOAuthFlow.mockResolvedValue({
            message: "Enter your code.",
            deviceCode: {
                userCode: "ABCD-1234",
                verificationUrl: "https://auth.openai.com/codex/device",
                copied: true,
            },
        });
        render(<AISettings />);
        fireEvent.click(await screen.findByRole("button", { name: "Sign in with OpenAI" }));
        await allowStorage();
        expect(await screen.findByText("Code copied to clipboard.")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Open OpenAI sign-in page" })).toHaveAttribute(
            "href",
            "https://auth.openai.com/codex/device",
        );
    });

    it("keeps keyless local Ollama usable without credential-storage permission", async () => {
        mocks.isElectron.mockReturnValue(true);
        mocks.listOllamaModels.mockResolvedValue([{ id: "llama3.2", name: "Llama" }]);
        render(<AISettings />);
        fireEvent.click(await screen.findByRole("button", { name: /Ollama/ }));
        fireEvent.click(screen.getByRole("button", { name: "Load models" }));
        await waitFor(() => expect(screen.getByRole("combobox", { name: "Model" })).toHaveValue("llama3.2"));
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(mocks.prepareCredentialStorage).not.toHaveBeenCalled();
    });

    it("prevents sign-in while API-key verification is pending", async () => {
        const models = deferred<{ id: string; name: string }[]>();
        mocks.listAnthropicModels.mockReturnValue(models.promise);
        render(<AISettings />);
        fireEvent.click(await screen.findByRole("button", { name: /Anthropic \(Claude\)/ }));
        fireEvent.change(await screen.findByLabelText("API key"), { target: { value: "synthetic-api-key" } });
        fireEvent.click(screen.getByRole("button", { name: "Verify and save key" }));
        await allowStorage();
        await waitFor(() => expect(mocks.listAnthropicModels).toHaveBeenCalledOnce());
        const signIn = screen.getByRole("button", { name: "Sign in with Claude" });
        expect(signIn).toBeDisabled();
        fireEvent.click(signIn);
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(mocks.startOAuthFlow).not.toHaveBeenCalled();
        await act(async () => {
            models.resolve([{ id: "claude-test", name: "Claude" }]);
            await models.promise;
        });
        expect(await screen.findByText(/Credentials saved/)).toBeInTheDocument();
    });

    it("prevents key verification while browser sign-in is pending", async () => {
        const signIn = deferred<{ message: string }>();
        mocks.startOAuthFlow.mockReturnValue(signIn.promise);
        render(<AISettings />);
        fireEvent.click(await screen.findByRole("button", { name: /Anthropic \(Claude\)/ }));
        fireEvent.change(await screen.findByLabelText("API key"), { target: { value: "synthetic-api-key" } });
        fireEvent.click(screen.getByRole("button", { name: "Sign in with Claude" }));
        await allowStorage();
        await waitFor(() => expect(mocks.startOAuthFlow).toHaveBeenCalledOnce());
        const verify = screen.getByRole("button", { name: "Verify and save key" });
        expect(verify).toBeDisabled();
        fireEvent.click(verify);
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(mocks.listAnthropicModels).not.toHaveBeenCalled();
        await act(async () => {
            signIn.resolve({ message: "Continue on the provider page." });
            await signIn.promise;
        });
        expect(await screen.findByText("Continue on the provider page.")).toBeInTheDocument();
    });

    it("waits for credential persistence before reporting success", async () => {
        const save = deferred<void>();
        mocks.saveCredentials.mockReturnValue(save.promise);
        mocks.listAnthropicModels.mockResolvedValue([{ id: "claude-test", name: "Claude" }]);
        render(<AISettings />);
        fireEvent.click(await screen.findByRole("button", { name: /Anthropic \(Claude\)/ }));
        fireEvent.change(await screen.findByLabelText("API key"), { target: { value: "synthetic-api-key" } });
        fireEvent.click(screen.getByRole("button", { name: "Verify and save key" }));
        await allowStorage();
        await waitFor(() => expect(mocks.saveCredentials).toHaveBeenCalledOnce());
        expect(screen.queryByText(/Credentials saved/)).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Save Configuration" })).toBeDisabled();
        await act(async () => {
            save.resolve();
            await save.promise;
        });
        expect(await screen.findByText(/Credentials saved/)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Save Configuration" })).toBeEnabled();
    });

    it("reports a key-save failure inline without discarding the entered key", async () => {
        mocks.listAnthropicModels.mockResolvedValue([{ id: "claude-test", name: "Claude" }]);
        mocks.saveCredentials.mockRejectedValue(new Error("Storage unavailable after verification"));
        render(<AISettings />);
        fireEvent.click(await screen.findByRole("button", { name: /Anthropic \(Claude\)/ }));
        const key = await screen.findByLabelText("API key");
        fireEvent.change(key, { target: { value: "synthetic-api-key" } });
        fireEvent.click(screen.getByRole("button", { name: "Verify and save key" }));
        await allowStorage();
        expect(await screen.findByRole("alert")).toHaveTextContent("Storage unavailable after verification");
        expect(key).toHaveValue("synthetic-api-key");
    });
});
