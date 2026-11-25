"use client";
import { useActionState, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button, Field, Input } from "@/components/ui";
import { sendCodeAction, verifyCodeAction, type SignInState } from "../actions";

export function SignInForm() {
  const [sent, send, sending] = useActionState<SignInState, FormData>(sendCodeAction, { step: "email" });
  const [checked, verify, verifying] = useActionState<SignInState, FormData>(verifyCodeAction, { step: "code" });
  const [restart, setRestart] = useState(0);
  const onCodeStep = sent.step === "code" && restart === 0;
  const email = sent.email ?? "";

  if (!onCodeStep) {
    return (
      <form action={(f) => { setRestart(0); return send(f); }} className="mt-5 flex flex-col gap-4" noValidate>
        <Field label="Work email" htmlFor="email" error={sent.error}>
          <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required defaultValue={email}
            aria-invalid={!!sent.error} aria-describedby={sent.error ? "email-error" : undefined} />
        </Field>
        <Button type="submit" size="lg" disabled={sending} aria-busy={sending}>
          {sending && <Loader2 aria-hidden className="animate-spin" />}Email me a code
        </Button>
        <p className="text-xs text-text-muted">No password. The office adds team members; ask them if you can&apos;t get in.</p>
      </form>
    );
  }

  return (
    <form action={verify} className="mt-5 flex flex-col gap-4" noValidate>
      {sent.info && <p role="status" className="rounded-sm bg-accent-soft p-3">{sent.info}</p>}
      <input type="hidden" name="email" value={email} />
      <Field label="6-digit code" htmlFor="code" error={checked.error}>
        <Input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={6} required autoFocus
          className="tracking-[0.4em] text-lg" aria-invalid={!!checked.error} aria-describedby={checked.error ? "code-error" : undefined} />
      </Field>
      <Button type="submit" size="lg" disabled={verifying} aria-busy={verifying}>
        {verifying && <Loader2 aria-hidden className="animate-spin" />}Sign in
      </Button>
      <button type="button" onClick={() => setRestart((n) => n + 1)} className="self-start font-semibold text-accent-text hover:underline">
        Use a different email
      </button>
    </form>
  );
}
