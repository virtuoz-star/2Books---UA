import type { ReactNode } from "react";
import { cn } from "cn";

function PageHeader({
  title,
  children,
  className,
}: {
  title: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <h1 className="display-title page-title text-foreground">{title}</h1>
      {children}
    </div>
  );
}

export { PageHeader };
