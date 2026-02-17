import { PropsWithChildren } from "react";
import { useUIStore, contentWidthClasses } from "../../store/ui.store";
import { css } from "@g4rcez/components";

type LayoutProps = PropsWithChildren<{
  className?: string;
  ignoreWidth?: boolean;
}>;

export const Layout = ({ children, className, ignoreWidth }: LayoutProps) => {
  const [state] = useUIStore();
  const widthClass = ignoreWidth ? "max-w-safe" : contentWidthClasses[state.contentWidth];

  return (
    <div
      className={css(
        "mx-auto w-full transition-all duration-300",
        widthClass,
        className
      )}
    >
      {children}
    </div>
  );
};
