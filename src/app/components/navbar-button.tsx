import { LucideIcon } from "lucide-react";
import { ComponentProps } from "react";

export const NavbarButton = (
  props: ComponentProps<"button"> & { Icon: LucideIcon },
) => {
  return (
    <button
      {...props}
      type="button"
      className="flex gap-1.5 items-center py-1.5 px-2.5 text-sm rounded-md transition-all text-foreground/70 hover:text-foreground hover:bg-muted/30"
    >
      <props.Icon className="size-4" />
    </button>
  );
};
