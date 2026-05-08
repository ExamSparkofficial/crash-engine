import { ShieldAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DISCLAIMER } from "@/lib/constants";

export function ProbabilityNotice() {
  return (
    <Alert className="border-cyan-300/20 bg-cyan-400/8">
      <div className="flex items-start gap-3">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-cyan-200" />
        <div>
          <AlertTitle>Analytics Only</AlertTitle>
          <AlertDescription>
            {DISCLAIMER} CrashPulse AI does not automate betting, bypass security, or claim exact
            crash prediction.
          </AlertDescription>
        </div>
      </div>
    </Alert>
  );
}
