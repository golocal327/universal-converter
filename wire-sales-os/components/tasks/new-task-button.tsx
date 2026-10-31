"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TaskDialog, type TaskDraft } from "./task-dialog";

/** "New task" button; also opens automatically with ?new=1 (command palette: C T). */
export function NewTaskButton() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [draft, setDraft] = useState<TaskDraft | null>(() =>
    params.get("new") === "1" ? { title: "", description: null, type: "follow_up", priority: "medium", due_at: null, company_id: null } : null,
  );
  const close = () => {
    setDraft(null);
    if (params.get("new")) router.replace(pathname);
  };
  return (
    <>
      <Button size="sm" onClick={() => setDraft({ title: "", description: null, type: "follow_up", priority: "medium", due_at: new Date(Date.now() + 86_400_000).toISOString(), company_id: null })}>
        <Plus /> New task
      </Button>
      {draft && <TaskDialog open onOpenChange={(o) => !o && close()} initial={draft} />}
    </>
  );
}
