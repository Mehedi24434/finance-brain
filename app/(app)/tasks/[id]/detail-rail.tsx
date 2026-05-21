"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Clock, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export default function TaskDetailRail({
  taskId,
  taskTitle,
  status,
}: {
  taskId: string;
  taskTitle: string;
  status: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const isClosed = status === "completed" || status === "cancelled";

  async function call(key: string, url: string, init?: RequestInit) {
    if (busy) return;
    setBusy(key);
    start(async () => {
      try {
        const res = await fetch(url, init);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `Failed (${res.status})`);
        }
        toast.success(
          key === "resolve" ? "Resolved" : key === "snooze" ? "Snoozed" : "Done",
        );
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Action failed");
      } finally {
        setBusy(null);
      }
    });
  }

  return (
    <aside className="bg-surface border border-border rounded-lg p-3 space-y-2 sticky top-4">
      <div className="text-[11px] uppercase tracking-wider text-text-tertiary px-1">
        Actions
      </div>
      <Button
        variant="outline"
        className="w-full justify-start"
        disabled={isClosed || pending}
        onClick={() =>
          call("resolve", `/api/tasks/${taskId}/resolve`, { method: "POST" })
        }
      >
        <Check className="size-3.5" />
        Resolve
      </Button>
      <Button
        variant="outline"
        className="w-full justify-start"
        disabled={isClosed || pending}
        onClick={() =>
          call("snooze", `/api/tasks/${taskId}/snooze`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            }),
          })
        }
      >
        <Clock className="size-3.5" />
        Snooze 24h
      </Button>
      <AddFollowupDialog taskId={taskId} taskTitle={taskTitle} />
    </aside>
  );
}

function AddFollowupDialog({
  taskId,
  taskTitle,
}: {
  taskId: string;
  taskTitle: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState(`Re: ${taskTitle}`);
  const [contact, setContact] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/followups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          notes: notes || null,
          contact_name: contact || null,
          related_task_id: taskId,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Failed (${res.status})`);
      }
      toast.success("Followup added");
      setOpen(false);
      setNotes("");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add followup");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" className="w-full justify-start">
            <Plus className="size-3.5" />
            Add followup
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add followup</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="followup-subject">Subject</Label>
            <Input
              id="followup-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="followup-contact">Contact (optional)</Label>
            <Input
              id="followup-contact"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="e.g. Maria Santos"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="followup-notes">Notes</Label>
            <Textarea
              id="followup-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Adding…" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
