import type { ComponentProps } from "react";
import { cn } from "cn";

function IconButton({
  label,
  className,
  type = "button",
  ...props
}: ComponentProps<"button"> & { label: string }) {
  return (
    <button
      type={type}
      aria-label={label}
      className={cn(
        "icon-btn btn btn-quiet motion-color inline-flex size-10 cursor-pointer items-center justify-center rounded-full border border-transparent text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export { IconButton };
