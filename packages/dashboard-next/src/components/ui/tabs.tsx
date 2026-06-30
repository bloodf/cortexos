import * as React from "react";
import { TabList, Tab } from "@astryxdesign/core/TabList";
import { cn } from "@/lib/utils";

interface TabsContextValue {
  value: string;
  onValueChange: (value: string) => void;
}

const TabsContext = React.createContext<TabsContextValue | null>(null);

function useTabs() {
  const ctx = React.useContext(TabsContext);
  if (!ctx) throw new Error("Tabs subcomponents must be used within <Tabs>");
  return ctx;
}

export interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  children?: React.ReactNode;
}

function Tabs({
  defaultValue,
  value: controlledValue,
  onValueChange,
  children,
  className,
  ...props
}: TabsProps) {
  const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue ?? "");
  const value = controlledValue !== undefined ? controlledValue : uncontrolledValue;
  const onChange = React.useCallback(
    (v: string) => {
      setUncontrolledValue(v);
      onValueChange?.(v);
    },
    [onValueChange],
  );
  return (
    <TabsContext.Provider value={{ value, onValueChange: onChange }}>
      <div className={cn(className)} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

export type TabsListProps = Omit<React.HTMLAttributes<HTMLElement>, "onChange">;

const TabsList = React.forwardRef<HTMLElement, TabsListProps>(
  ({ className, children, ...props }, ref) => {
    const { value, onValueChange } = useTabs();
    return (
      <TabList
        ref={ref}
        value={value}
        onChange={onValueChange}
        className={cn(className)}
        {...props}
      >
        {children}
      </TabList>
    );
  },
);
TabsList.displayName = "TabsList";

export interface TabsTriggerProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "value"
> {
  value: string;
}

function childrenToLabel(children: React.ReactNode): string {
  if (children == null) return "";
  if (typeof children === "string") return children;
  if (typeof children === "number" || typeof children === "boolean") return String(children);
  return React.Children.toArray(children)
    .map((child) =>
      typeof child === "string"
        ? child
        : typeof child === "number" || typeof child === "boolean"
          ? String(child)
          : "",
    )
    .join("");
}

const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ className, value, children, role = "tab", ...props }, ref) => {
    const { value: activeValue } = useTabs();
    const isActive = value === activeValue;
    return (
      <Tab
        ref={ref}
        value={value}
        label={childrenToLabel(children)}
        className={cn(className)}
        {...props}
        role={role}
        data-state={isActive ? "active" : "inactive"}
      />
    );
  },
);
TabsTrigger.displayName = "TabsTrigger";

export interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

const TabsContent = React.forwardRef<HTMLDivElement, TabsContentProps>(
  ({ className, value, children, ...props }, ref) => {
    const { value: activeValue } = useTabs();
    const isActive = value === activeValue;
    if (!isActive) return null;
    return (
      <div
        ref={ref}
        role="tabpanel"
        data-state={isActive ? "active" : "inactive"}
        className={cn("mt-2", className)}
        {...props}
      >
        {children}
      </div>
    );
  },
);
TabsContent.displayName = "TabsContent";

export { Tabs, TabsList, TabsTrigger, TabsContent };
