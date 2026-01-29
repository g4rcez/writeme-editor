import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { PropsWithChildren } from "react";

const cn = (...inputs: Parameters<typeof clsx>) => twMerge(clsx(inputs));

type LayoutProps = PropsWithChildren<{
  className?: string;
}>;

export const Layout = ({ children, className }: LayoutProps) => (
  <div className={cn("mx-auto w-full max-w-5xl px-4 md:px-0", className)}>
    {children}
  </div>
);
