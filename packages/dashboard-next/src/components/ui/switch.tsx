import * as React from "react";
import { Switch as AstryxSwitch } from "@astryxdesign/core/Switch";
import { cn } from "@/lib/utils";

export interface SwitchProps extends Omit<
  React.ComponentProps<typeof AstryxSwitch>,
  "value" | "onChange" | "label" | "isDisabled"
> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
}

const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, checked, onCheckedChange, label, disabled, ...props }, ref) => (
    <AstryxSwitch
      ref={ref}
      value={checked ?? false}
      onChange={onCheckedChange}
      label={label ?? (props["aria-label"] || "Switch")}
      isLabelHidden={!label}
      isDisabled={disabled}
      className={cn(className)}
      {...props}
    />
  ),
);
Switch.displayName = "Switch";

export { Switch };
