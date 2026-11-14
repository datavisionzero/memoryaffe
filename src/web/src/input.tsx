import type { ComponentProps } from "react";

export function Input({
  autoComplete = "off",
  ...props
}: ComponentProps<"input">) {
  const ignore = autoComplete === "off";
  return (
    <input
      {...props}
      autoComplete={autoComplete}
      data-1p-ignore={ignore || undefined}
      data-lpignore={ignore ? "true" : undefined}
    />
  );
}
export function Textarea(props: ComponentProps<"textarea">) {
  return (
    <textarea
      {...props}
      autoComplete="off"
      data-1p-ignore
      data-lpignore="true"
    />
  );
}
