import { Button, Tooltip } from "@g4rcez/components";
import { type Icon } from "@phosphor-icons/react";
import { ComponentProps } from "react";

export const NavbarButton = (
  props: ComponentProps<"button"> & { Icon: Icon },
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
