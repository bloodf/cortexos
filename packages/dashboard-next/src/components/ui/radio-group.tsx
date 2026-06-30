import * as React from "react";
import { RadioList, RadioListItem } from "@astryxdesign/core/RadioList";
import { cn } from "@/lib/utils";

const RadioGroup = React.forwardRef<HTMLDivElement, React.ComponentProps<typeof RadioList>>(
  ({ className, ...props }, ref) => (
    <RadioList ref={ref} className={cn("grid gap-2", className)} {...props} />
  ),
);
RadioGroup.displayName = "RadioGroup";

const RadioGroupItem = React.forwardRef<HTMLDivElement, React.ComponentProps<typeof RadioListItem>>(
  ({ className, ...props }, ref) => (
    <RadioListItem ref={ref} className={cn(className)} {...props} />
  ),
);
RadioGroupItem.displayName = "RadioGroupItem";

export { RadioGroup, RadioGroupItem };
