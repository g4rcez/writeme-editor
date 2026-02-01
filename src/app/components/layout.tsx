import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { PropsWithChildren } from "react";
import { useUIStore, contentWidthClasses } from "../../store/ui.store";

const cn = (...inputs: Parameters<typeof clsx>) => twMerge(clsx(inputs));

type LayoutProps = PropsWithChildren<{
  className?: string;
  ignoreWidth?: boolean;
}>;

export const Layout = ({ children, className, ignoreWidth }: LayoutProps) => {
  const [state] = useUIStore();
  const widthClass = ignoreWidth ? "max-w-safe" : contentWidthClasses[state.contentWidth];

  return (
    <div
      className={cn(
        "mx-auto w-full transition-all duration-300",
        widthClass,
        className
      )}
    >
      {children}
    </div>
  );
};
