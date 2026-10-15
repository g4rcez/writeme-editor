import { Tooltip } from "@g4rcez/components";
import type { ReactElement } from "react";

type NoteToolTooltipProps = {
    title: string;
    description: string;
    children: ReactElement;
    enabled?: boolean;
};

export function NoteToolTooltip({ title, description, children, enabled = true }: NoteToolTooltipProps): ReactElement {
    return (
        <Tooltip placement="bottom" popover={false} title={children} enabled={enabled} open={enabled ? undefined : false}>
            <span className="writeme-note-tool-tooltip-content flex max-w-64 flex-col gap-1 text-left text-tooltip-foreground">
                <span className="text-xs font-semibold">{title}</span>
                <span className="text-xs leading-relaxed">{description}</span>
            </span>
        </Tooltip>
    );
}
