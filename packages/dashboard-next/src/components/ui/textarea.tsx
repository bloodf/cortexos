import * as React from "react";
import { TextArea as AstryxTextArea } from "@astryxdesign/core/TextArea";
import { cn } from "@/lib/utils";

export interface TextareaProps extends Omit<
  React.ComponentProps<typeof AstryxTextArea>,
  "value" | "onChange" | "label"
> {
  value?: string | number | readonly string[];
  onChange?: React.ChangeEventHandler<HTMLTextAreaElement>;
  label?: string;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, value = "", onChange, label, isLabelHidden, ...props }, ref) => (
    <AstryxTextArea
      ref={ref}
      value={typeof value === "string" ? value : String(value ?? "")}
      onChange={onChange ? (_v, e) => onChange(e) : undefined}
      label={label ?? ""}
      isLabelHidden={isLabelHidden ?? !label}
      className={cn(className)}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";

export { Textarea };
