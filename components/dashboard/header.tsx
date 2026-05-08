"use client";

import { Activity, LogIn, LogOut, RadioTower } from "lucide-react";
import { signIn, signOut, useSession } from "next-auth/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CollectorStatus } from "@/lib/types";
import { APP_NAME } from "@/lib/constants";

export function DashboardHeader({
  connected,
  status
}: {
  connected: boolean;
  status: CollectorStatus | null;
}) {
  const { data: session } = useSession();

  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[#050910]/82 backdrop-blur-xl">
      <div className="container flex min-h-16 flex-wrap items-center justify-between gap-3 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md border border-cyan-300/25 bg-cyan-400/12 shadow-glow">
            <Activity className="h-5 w-5 text-cyan-200" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-normal">{APP_NAME}</h1>
            <p className="text-xs text-muted-foreground">Realtime probability analytics console</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={connected ? "success" : "danger"} className="gap-1.5">
            <RadioTower className="h-3.5 w-3.5" />
            {connected ? "Socket live" : "Socket offline"}
          </Badge>
          <Badge variant="outline">{status?.mode ?? "loading"}</Badge>
          {session?.user ? (
            <Button variant="outline" size="sm" onClick={() => void signOut()}>
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          ) : (
            <Button variant="secondary" size="sm" onClick={() => void signIn("google")}>
              <LogIn className="h-4 w-4" />
              Google login
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
