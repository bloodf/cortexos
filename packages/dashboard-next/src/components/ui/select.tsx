import * as React from "react";
import { Selector } from "@astryxdesign/core/Selector";
import { cn } from "@/lib/utils";

interface SelectOption {
  value: string;
  label: string;
}

interface SelectContextValue {
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  options: SelectOption[];
}

const SelectContext = React.createContext<SelectContextValue | null>(null);

function useSelect() {
  const ctx = React.useContext(SelectContext);
  if (!ctx) throw new Error("Select subcomponents must be used within <Select>");
  return ctx;
}

function extractSelectOptions(node: React.ReactNode): SelectOption[] {
  const options: SelectOption[] = [];
  React.Children.forEach(node, (child) => {
    if (!React.isValidElement(child)) return;
    if (child.type === SelectItem) {
      const props = child.props as SelectItemProps;
      options.push({
        value: props.value,
        label: String(props.children ?? props.value),
      });
    } else {
      options.push(
        ...extractSelectOptions((child.props as { children?: React.ReactNode }).children),
      );
    }
  });
  return options;
}

export interface SelectProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  children?: React.ReactNode;
}

function Select({ value, defaultValue, onValueChange, children }: SelectProps) {
  const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue);
  const actualValue = value ?? uncontrolledValue ?? "";
  const options = React.useMemo(() => extractSelectOptions(children), [children]);
  const onChange = React.useCallback(
    (v: string) => {
      setUncontrolledValue(v);
      onValueChange?.(v);
    },
    [onValueChange],
  );
  return (
    <SelectContext.Provider value={{ value: actualValue, onValueChange: onChange, options }}>
      {children}
    </SelectContext.Provider>
  );
}

const SelectGroup = ({ children }: { children?: React.ReactNode }) => children;

export interface SelectValueProps {
  placeholder?: string;
  className?: string;
}

function SelectValue({ placeholder, className }: SelectValueProps) {
  const { value, options, placeholder: contextPlaceholder } = useSelect();
  const selected = options.find((o) => o.value === value);
  return (
    <span className={cn(className)}>
      {selected?.label ?? placeholder ?? contextPlaceholder ?? ""}
    </span>
  );
}

export interface SelectTriggerProps {
  className?: string;
  children?: React.ReactNode;
}

function SelectTrigger({ className, children }: SelectTriggerProps) {
  const { value, onValueChange, options, placeholder } = useSelect();
  const selected = options.find((o) => o.value === value);
  const label = React.Children.toArray(children).find(
    (child) => React.isValidElement(child) && child.type === SelectValue,
  );
  const placeholderText =
    (React.isValidElement(label) && (label.props as SelectValueProps).placeholder) ||
    placeholder ||
    "Select…";

  return (
    <Selector
      label={placeholderText}
      isLabelHidden
      options={options}
      value={value ?? ""}
      onChange={onValueChange}
      placeholder={selected ? undefined : placeholderText}
      className={cn(className)}
    />
  );
}

export interface SelectContentProps {
  children?: React.ReactNode;
  className?: string;
}

function SelectContent({ children, className }: SelectContentProps) {
  return (
    <span className={cn("hidden", className)} aria-hidden>
      {children}
    </span>
  );
}

export interface SelectItemProps {
  value: string;
  children?: React.ReactNode;
  className?: string;
}

function SelectItem({ children }: SelectItemProps) {
  return <>{children}</>;
}

function SelectLabel({ children }: { children?: React.ReactNode }) {
  return <>{children}</>;
}

function SelectSeparator() {
  return null;
}

function SelectScrollUpButton() {
  return null;
}

function SelectScrollDownButton() {
  return null;
}

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
};
