"use client";

import { useEffect, useState } from "react";
import { X, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const KEY = "cortex.tour.v1.dismissed";
const STEPS = [
  { title: "Welcome to CortexOS", body: "This is a fully-mocked demo build. All data is generated locally — nothing is sent anywhere." },
  { title: "Keyboard-first", body: "Press ⌘K to open the command palette. Press ? for the full shortcut list." },
  { title: "Customize Overview", body: "On the Overview page, hit Edit to rearrange or remove widgets. Your layout is saved locally." },
  { title: "Try the simulate menu", body: "Sign in as admin (admin / admin) and use the flask icon in the top bar to crash, heal, or stress services." },
];

export function DemoTour() {
  const [step, setStep] = useState<number | null>(null);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (!localStorage.getItem(KEY)) setStep(0);
    } catch { /* noop */ }
  }, []);

  if (step === null) return null;
  const s = STEPS[step];
  const last = step === STEPS.length - 1;

  const dismiss = () => {
    try { localStorage.setItem(KEY, "1"); } catch { /* noop */ }
    setStep(null);
  };

  return (
    <div
      role="dialog"
      aria-label={s.title}
      className="fixed bottom-4 right-4 z-50 w-[calc(100%-2rem)] max-w-sm rounded-lg border bg-card shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-300"
    >
      <div className="flex items-start gap-2 p-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
            <span className="size-1.5 rounded-full bg-primary" />
            Tour · {step + 1} / {STEPS.length}
          </div>
          <h3 className="mt-1.5 text-sm font-semibold">{s.title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
        </div>
        <button type="button" onClick={dismiss} aria-label="Close tour" className="text-muted-foreground hover:text-foreground">
          <X className="size-4" />
        </button>
      </div>
      <div className="flex items-center justify-between border-t px-4 py-2.5">
        <button type="button" onClick={dismiss} className="text-xs text-muted-foreground hover:text-foreground">Skip</button>
        <Button size="sm" onClick={() => (last ? dismiss() : setStep(step + 1))}>
          {last ? "Got it" : <>Next<ArrowRight className="size-3.5 ml-1" /></>}
        </Button>
      </div>
    </div>
  );
}
