import type { ReactNode } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export interface DetailTab {
  id: string;
  label: string;
  content: ReactNode;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  tabs: DetailTab[];
  actions?: ReactNode;
}

export function DetailDrawer({ open, onOpenChange, title, description, tabs, actions }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl flex flex-col p-0 gap-0">
        <SheetHeader className="px-6 py-4 border-b">
          <SheetTitle className="flex items-center justify-between gap-3">
            <span className="truncate">{title}</span>
            {actions && <span className="flex gap-1 shrink-0">{actions}</span>}
          </SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>
        <Tabs defaultValue={tabs[0]?.id} className="flex-1 min-h-0 flex flex-col">
          <TabsList className="mx-6 mt-3 w-fit">
            {tabs.map((t) => (
              <TabsTrigger key={t.id} value={t.id}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
            {tabs.map((t) => (
              <TabsContent key={t.id} value={t.id} className="mt-0 space-y-4">
                {t.content}
              </TabsContent>
            ))}
          </div>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
