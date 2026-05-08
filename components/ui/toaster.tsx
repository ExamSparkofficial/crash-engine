"use client";

import { X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Toaster() {
  const { toasts, dismiss } = useToast();

  return (
    <div className="fixed right-4 top-4 z-50 flex w-[min(420px,calc(100vw-2rem))] flex-col gap-3">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            "rounded-lg border bg-card/95 p-4 text-sm shadow-glow backdrop-blur-xl",
            toast.variant === "destructive" ? "border-rose-400/30" : "border-cyan-300/20"
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold">{toast.title}</p>
              {toast.description ? (
                <p className="mt-1 text-muted-foreground">{toast.description}</p>
              ) : null}
            </div>
            <Button
              aria-label="Dismiss notification"
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => dismiss(toast.id)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
