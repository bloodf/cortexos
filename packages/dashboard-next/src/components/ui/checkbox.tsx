import * as React from "react";
import { CheckboxInput } from "@astryxdesign/core/CheckboxInput";
import { cn } from "@/lib/utils";

export interface CheckboxProps extends Omit<
  React.ComponentProps<typeof CheckboxInput>,
  "value" | "onChange" | "label"
> {
  checked?: boolean | "indeterminate";
  onCheckedChange?: (checked: boolean | "indeterminate") => void;
  label?: string;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, checked, onCheckedChange, label, ...props }, ref) => (
    <CheckboxInput
      ref={ref}
      value={checked ?? false}
      onChange={onCheckedChange}
      label={label ?? (props["aria-label"] || "Checkbox")}
      isLabelHidden={!label}
      className={cn(className)}
      {...props}
    />
  ),
);
Checkbox.displayName = "Checkbox";

export { Checkbox };
