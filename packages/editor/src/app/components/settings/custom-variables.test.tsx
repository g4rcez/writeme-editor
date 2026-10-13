import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Script } from "@/store/repositories/entities/script";
import { CustomVariables } from "./custom-variables";

const mocks = vi.hoisted(() => ({
    scripts: [] as Script[],
    refresh: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
    setAlert: vi.fn(),
}));

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { size?: string; theme?: string };
type InputProps = InputHTMLAttributes<HTMLInputElement> & { optionalText?: string; container?: string };
type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { optionalText?: string };
type ConfirmProps = {
    open: boolean;
    title: string;
    message: string;
    confirmText: string;
    onConfirm: () => void;
    onCancel: () => void;
};

vi.mock("@g4rcez/components", () => ({
    Button: ({ size: _size, theme: _theme, children, ...props }: ButtonProps) => (
        <button type="button" {...props}>
            {children}
        </button>
    ),
    Input: ({ optionalText: _optionalText, container: _container, title, ...props }: InputProps) => (
        <input aria-label={title} {...props} />
    ),
    Textarea: ({ optionalText: _optionalText, title, ...props }: TextareaProps) => (
        <textarea aria-label={title} {...props} />
    ),
}));

vi.mock("@/app/hooks/use-scripts", () => ({
    useScripts: () => ({ scripts: mocks.scripts, refresh: mocks.refresh }),
}));

vi.mock("@/store/repositories", () => ({
    repositories: { scripts: { save: mocks.save, delete: mocks.delete } },
}));

vi.mock("@/store/ui.store", () => ({ uiDispatch: { setAlert: mocks.setAlert } }));

vi.mock("../confirm", () => ({
    Confirm: ({ open, title, message, confirmText, onConfirm, onCancel }: ConfirmProps): ReactNode =>
        open ? (
            <dialog open aria-label={title}>
                <p>{message}</p>
                <button type="button" onClick={onCancel}>
                    Cancel
                </button>
                <button type="button" onClick={onConfirm}>
                    {confirmText}
                </button>
            </dialog>
        ) : null,
}));

function variable(): Script {
    return new Script("year-variable", "YEAR", "return 2026;", new Date("2026-01-01"), new Date("2026-01-01"));
}

beforeEach(() => {
    vi.clearAllMocks();
    mocks.scripts = [];
    mocks.refresh.mockResolvedValue(undefined);
    mocks.save.mockResolvedValue(undefined);
    mocks.delete.mockResolvedValue(undefined);
});

describe("CustomVariables", () => {
    it("adds a variable with named expression fields and persists edits", async () => {
        render(<CustomVariables />);
        expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Add Variable" }));
        fireEvent.change(screen.getByRole("textbox", { name: "Variable Name: NEW_VAR" }), {
            target: { value: "YEAR" },
        });
        fireEvent.change(screen.getByRole("textbox", { name: "JavaScript expression: YEAR" }), {
            target: { value: "return 2027;" },
        });
        fireEvent.click(screen.getByRole("button", { name: "Save Variables" }));
        await waitFor(() =>
            expect(mocks.setAlert).toHaveBeenCalledWith(expect.objectContaining({ open: true, type: "success" })),
        );
        expect(mocks.save).toHaveBeenCalledOnce();
        expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ name: "YEAR", content: "return 2027;" }));
        expect(mocks.refresh).toHaveBeenCalledOnce();
    });

    it("requires confirmation before deleting the labeled variable", async () => {
        mocks.scripts = [variable()];
        render(<CustomVariables />);
        fireEvent.click(screen.getByRole("button", { name: "Delete YEAR" }));
        expect(mocks.delete).not.toHaveBeenCalled();
        fireEvent.click(
            within(screen.getByRole("dialog", { name: "Delete Variable" })).getByRole("button", { name: "Delete" }),
        );
        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
        expect(mocks.delete).toHaveBeenCalledWith("year-variable");
        expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    });

    it("keeps a variable when deletion is canceled", () => {
        mocks.scripts = [variable()];
        render(<CustomVariables />);
        fireEvent.click(screen.getByRole("button", { name: "Delete YEAR" }));
        fireEvent.click(
            within(screen.getByRole("dialog", { name: "Delete Variable" })).getByRole("button", { name: "Cancel" }),
        );
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(screen.getByRole("textbox", { name: "JavaScript expression: YEAR" })).toHaveValue("return 2026;");
        expect(mocks.delete).not.toHaveBeenCalled();
    });
});
