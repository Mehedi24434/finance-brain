"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Mic, MicOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type RecognitionLike = {
  start: () => void;
  stop: () => void;
  abort: () => void;
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type RecognitionCtor = new () => RecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  }
}

export default function QuickCapture() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [recording, setRecording] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(true);
  const recognitionRef = useRef<RecognitionLike | null>(null);

  useEffect(() => {
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    setVoiceSupported(Boolean(Ctor));
    return () => recognitionRef.current?.abort();
  }, []);

  function startVoice() {
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Ctor) {
      toast.error("Voice input needs Chrome, Edge, or Safari.");
      return;
    }
    const recognition = new Ctor();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (e) => {
      let transcript = "";
      for (let i = 0; i < e.results.length; i++) {
        transcript += e.results[i][0].transcript;
      }
      setValue(transcript);
    };
    recognition.onerror = (e) => {
      if (e.error !== "no-speech" && e.error !== "aborted") {
        toast.error(`Voice error: ${e.error}`);
      }
      setRecording(false);
    };
    recognition.onend = () => setRecording(false);
    recognitionRef.current = recognition;
    setRecording(true);
    recognition.start();
  }

  function stopVoice() {
    recognitionRef.current?.stop();
    setRecording(false);
  }

  async function submit() {
    const title = value.trim();
    if (!title || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, source: "manual" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Failed (${res.status})`);
      }
      setValue("");
      toast.success("Task captured");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to capture task");
    } finally {
      setSubmitting(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  }

  const micTitle = !voiceSupported
    ? "Use Chrome for voice input"
    : recording
      ? "Stop recording"
      : "Voice input";

  return (
    <div className="flex items-center gap-2">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Capture a task… (press Enter)"
        className="h-8"
      />
      <button
        type="button"
        onClick={recording ? stopVoice : startVoice}
        disabled={!voiceSupported}
        title={micTitle}
        aria-label={recording ? "Stop voice input" : "Start voice input"}
        className={cn(
          "h-7 w-7 grid place-items-center rounded-md shrink-0 transition-colors",
          recording
            ? "bg-urgent/15 text-urgent animate-pulse"
            : "text-text-secondary hover:text-text-primary hover:bg-hover",
          !voiceSupported && "opacity-50 cursor-not-allowed",
        )}
      >
        {recording ? <MicOff className="size-3.5" /> : <Mic className="size-3.5" />}
      </button>
    </div>
  );
}
