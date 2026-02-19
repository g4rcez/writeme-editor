import { Button, Tooltip } from "@g4rcez/components";
import { LucideIcon } from "lucide-react";
import { ComponentProps } from "react";

export const NavbarButton = (
  props: ComponentProps<"button"> & { Icon: LucideIcon },
) => {
  return (
    <Tooltip
      placement="bottom-start"
      as={Button}
      size="small"
      theme="ghost-muted"
      title={
        <span {...props}>
          <props.Icon className="size-4" />
        </span>
      }
    >
      {props.title}
    </Tooltip>
  );
};
