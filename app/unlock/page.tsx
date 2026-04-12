"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { validatePassphrase } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function UnlockForm() {
  const searchParams = useSearchParams();
  const from = searchParams.get("from") ?? "/today";
  const [state, formAction, isPending] = useActionState(validatePassphrase, null);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-sm space-y-8 text-center">
        <div>
          <div className="text-5xl mb-4">🔐</div>
          <h1 className="text-2xl font-bold">Routine</h1>
          <p className="text-sm text-muted-foreground mt-1">Enter your passphrase to continue</p>
        </div>

        <form action={formAction} className="space-y-4 text-left">
          <input type="hidden" name="from" value={from} />
          <div className="space-y-2">
            <Label htmlFor="passphrase">Passphrase</Label>
            <Input
              id="passphrase"
              name="passphrase"
              type="password"
              placeholder="••••••••••••"
              autoComplete="current-password"
              autoFocus
              required
            />
          </div>

          {state?.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Checking…" : "Unlock"}
          </Button>
        </form>
      </div>
    </div>
  );
}

export default function UnlockPage() {
  return (
    <Suspense>
      <UnlockForm />
    </Suspense>
  );
}
