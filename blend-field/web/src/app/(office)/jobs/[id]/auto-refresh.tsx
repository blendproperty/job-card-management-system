"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** M0 stand-in for Supabase Realtime: refresh server data while the page is visible. */
export function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return (
    <p className="sr-only" aria-live="off">This page updates every {seconds} seconds.</p>
  );
}
