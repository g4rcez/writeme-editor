import { Button, Tooltip } from "@g4rcez/components";
import { type Icon } from "@phosphor-icons/react";
import { type ComponentProps } from "react";

export const NavbarButton = (
  props: ComponentProps<"button"> & { Icon: Icon },
) => {
  return (
    <Tooltip
      as={Button}
      size="small"
      theme="ghost-muted"
      placement="bottom-start"
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
