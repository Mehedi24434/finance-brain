"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Inbox as InboxIcon,
  LogOut,
  RefreshCw,
  Sparkles,
  Wand2,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { toast } from "sonner";

type Action = {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  run: () => Promise<void> | void;
  shortcut?: string;
};

export default function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function runCron(name: "briefing" | "reminders" | "sync") {
    const toastId = toast.loading(`Running ${name}…`);
    try {
      const res = await fetch(`/api/admin/run-cron/${name}`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Failed (${res.status})`);
      }
      toast.success(`${name} done`, { id: toastId });
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed", {
        id: toastId,
      });
    }
  }

  async function triageAll() {
    const toastId = toast.loading("Triaging all unread inbox items…");
    try {
      const res = await fetch("/api/inbox/triage-all", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Failed (${res.status})`);
      }
      const data = await res.json();
      toast.success(`Triaged ${data.triaged ?? 0}`, { id: toastId });
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed", {
        id: toastId,
      });
    }
  }

  async function signOut() {
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const actions: Action[] = [
    {
      id: "briefing",
      label: "Generate today's briefing",
      description: "Run Claude on today's signals + deliver to Telegram if linked.",
      icon: Sparkles,
      run: () => runCron("briefing"),
    },
    {
      id: "triage",
      label: "Triage all unread inbox items",
      description: "Run Claude triage over up to 10 unread items without a classification.",
      icon: Wand2,
      run: triageAll,
    },
    {
      id: "open-inbox",
      label: "Open inbox",
      description: "Jump to the full inbox listing.",
      icon: InboxIcon,
      run: () => router.push("/inbox"),
    },
    {
      id: "sync",
      label: "Sync integrations",
      description: "Run Gmail + Calendar sync now.",
      icon: RefreshCw,
      run: () => runCron("sync"),
    },
    {
      id: "signout",
      label: "Sign out",
      description: "End the session and return to login.",
      icon: LogOut,
      run: signOut,
    },
  ];

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Finance Brain"
      description="Type to search, ↵ to run."
    >
      <CommandInput placeholder="Run a command…" />
      <CommandList>
        <CommandEmpty>No matching command.</CommandEmpty>
        <CommandGroup heading="Actions">
          {actions.map((a) => {
            const Icon = a.icon;
            return (
              <CommandItem
                key={a.id}
                value={`${a.label} ${a.description}`}
                onSelect={async () => {
                  close();
                  await a.run();
                }}
              >
                <Icon className="size-3.5" />
                <div className="flex flex-col">
                  <span>{a.label}</span>
                  <span className="text-[11px] text-text-tertiary">
                    {a.description}
                  </span>
                </div>
                {a.shortcut && <CommandShortcut>{a.shortcut}</CommandShortcut>}
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
