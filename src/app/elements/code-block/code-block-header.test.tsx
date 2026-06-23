import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CodeBlockHeader } from "./code-block-header";

describe("CodeBlockHeader", () => {
	it("renders a copy button before the language selector", () => {
		render(
			<CodeBlockHeader
				code="const answer = 42;"
				lines={1}
				canRun={false}
				language="javascript"
				isRunning={false}
				onFormat={vi.fn()}
				onCopy={vi.fn()}
				handleRun={vi.fn()}
				isCopied={false}
				isFormatting={false}
				onChangeLanguage={vi.fn()}
			/>,
		);

		expect(
			screen.getByRole("button", { name: /copy to clipboard/i }),
		).toBeInTheDocument();
		expect(screen.getByRole("combobox")).toBeInTheDocument();
	});

	it("calls onCopy when the copy button is pressed", async () => {
		const user = userEvent.setup();
		const onCopy = vi.fn();

		render(
			<CodeBlockHeader
				code="const answer = 42;"
				lines={1}
				canRun={false}
				language="javascript"
				isRunning={false}
				onFormat={vi.fn()}
				onCopy={onCopy}
				handleRun={vi.fn()}
				isCopied={false}
				isFormatting={false}
				onChangeLanguage={vi.fn()}
			/>,
		);

		await user.click(
			screen.getByRole("button", { name: /copy to clipboard/i }),
		);

		expect(onCopy).toHaveBeenCalledTimes(1);
	});

	it("shows copied feedback after a successful copy", () => {
		render(
			<CodeBlockHeader
				code="const answer = 42;"
				lines={1}
				canRun={false}
				language="javascript"
				isRunning={false}
				onFormat={vi.fn()}
				onCopy={vi.fn()}
				handleRun={vi.fn()}
				isCopied={true}
				isFormatting={false}
				onChangeLanguage={vi.fn()}
			/>,
		);

		expect(screen.getByRole("button", { name: /copied/i })).toBeInTheDocument();
	});
});
