import { redirect } from "next/navigation";
import { currentActor } from "@/server/auth";
import { SignInForm } from "./sign-in-form";

export const metadata = { title: "Sign in" };

const REASON: Record<string, string> = {
  field: "That account is for the field app. Sign in to the office with an office account.",
};

/** S01 Sign in: emailed one-time code. */
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const me = await currentActor();
  if (me && (me.role === "office" || me.role === "admin")) redirect("/jobs");
  const { reason } = await searchParams;
  return (
    <main className="grid min-h-dvh place-items-center bg-nav-bg px-4">
      <div className="w-full max-w-sm rounded-lg bg-bg p-6 shadow-pop">
        <p className="flex items-center text-lg font-bold">
          <span aria-hidden className="mr-2 size-2.5 rounded-[3px] bg-accent" />Blend Field
        </p>
        <h1 className="mt-4 text-xl font-bold">Sign in</h1>
        {reason && REASON[reason] && <p role="alert" className="mt-3 rounded-sm bg-warning-soft p-3 text-warning">{REASON[reason]}</p>}
        <SignInForm />
      </div>
    </main>
  );
}
