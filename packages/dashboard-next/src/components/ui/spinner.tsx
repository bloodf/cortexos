import * as React from "react";
import { Spinner as AstryxSpinner } from "@astryxdesign/core/Spinner";
import { cn } from "@/lib/utils";

function Spinner({ className, ...props }: React.ComponentProps<typeof AstryxSpinner>) {
  return <AstryxSpinner className={cn(className)} {...props} />;
}

export { Spinner };
