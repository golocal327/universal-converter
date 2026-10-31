"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/services/types";

/** Run a server action with pending state, toast feedback and a router refresh. */
export function useAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const run = <T,>(fn: () => Promise<ActionResult<T>>, success?: string | ((data: T) => string), onOk?: (data: T) => void) =>
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      if (success) toast.success(typeof success === "function" ? success(r.data) : success);
      onOk?.(r.data);
      router.refresh();
    });
  return { pending, run };
}
