import { JsonDevTools } from "@/app/components/json-dev-tools";
import { JsonEditor } from "@/app/components/json-editor";
import { css } from "@g4rcez/components";
import { Group, Panel, Separator } from "react-resizable-panels";

type Props = {
  value: string;
  onChange?: (v: string) => void;
  className?: string;
};

export const JsonInspectorPanel = ({ value, onChange, className }: Props) => (
  <Group direction="horizontal" className={css("overflow-hidden", className)}>
    <Panel defaultSize={50} minSize={20}>
      <JsonEditor value={value} onChange={onChange ?? (() => {})} className="h-full" />
    </Panel>
    <Separator className="w-px bg-border/20 cursor-col-resize" />
    <Panel defaultSize={50} minSize={20}>
      <JsonDevTools value={value} className="h-full" />
    </Panel>
  </Group>
);
