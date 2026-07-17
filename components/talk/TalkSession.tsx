"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Mic, MicOff, Phone, PhoneOff, RotateCcw, Sparkles, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Phase = "idle" | "connecting" | "live" | "ended" | "error";

type Line = {
  id: string;
  role: "user" | "tutor";
  text: string;
  final: boolean;
};

// Fallback cap if the server doesn't send one; the real per-plan cap comes
// from /api/realtime/session (free 5 min, Pro 15 min).
const DEFAULT_MAX_SECONDS = 5 * 60;

function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function TalkSession() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [muted, setMuted] = useState(false);
  const [tutorSpeaking, setTutorSpeaking] = useState(false);
  const [userSpeaking, setUserSpeaking] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [maxSeconds, setMaxSeconds] = useState(DEFAULT_MAX_SECONDS);
  const [showUpsell, setShowUpsell] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const micRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const endedRef = useRef(false);

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    dcRef.current?.close();
    dcRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    micRef.current?.getTracks().forEach((t) => t.stop());
    micRef.current = null;
    if (audioRef.current) audioRef.current.srcObject = null;
  }, []);

  const endSession = useCallback(
    (reason?: string) => {
      if (endedRef.current) return;
      endedRef.current = true;
      cleanup();
      setTutorSpeaking(false);
      setUserSpeaking(false);
      setPhase("ended");
      if (reason) setError(reason);
    },
    [cleanup],
  );

  useEffect(() => () => cleanup(), [cleanup]);

  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight });
  }, [lines]);

  const upsertLine = useCallback(
    (id: string, role: Line["role"], make: (prev: string) => string, final: boolean) => {
      setLines((prev) => {
        const i = prev.findIndex((l) => l.id === id);
        if (i === -1) return [...prev, { id, role, text: make(""), final }];
        const next = [...prev];
        next[i] = { ...next[i], text: make(next[i].text), final: final || next[i].final };
        return next;
      });
    },
    [],
  );

  const handleEvent = useCallback(
    (raw: string) => {
      let ev: Record<string, unknown>;
      try {
        ev = JSON.parse(raw);
      } catch {
        return;
      }
      const type = ev.type as string;
      switch (type) {
        case "input_audio_buffer.speech_started":
          setUserSpeaking(true);
          break;
        case "input_audio_buffer.speech_stopped":
          setUserSpeaking(false);
          break;
        case "output_audio_buffer.started":
          setTutorSpeaking(true);
          break;
        case "output_audio_buffer.stopped":
        case "output_audio_buffer.cleared":
          setTutorSpeaking(false);
          break;
        case "conversation.item.input_audio_transcription.completed": {
          const text = ((ev.transcript as string) ?? "").trim();
          if (text) upsertLine(`u-${ev.item_id}`, "user", () => text, true);
          break;
        }
        case "response.output_audio_transcript.delta":
        case "response.audio_transcript.delta": {
          const delta = (ev.delta as string) ?? "";
          upsertLine(`t-${ev.item_id}`, "tutor", (prev) => prev + delta, false);
          break;
        }
        case "response.output_audio_transcript.done":
        case "response.audio_transcript.done": {
          const text = ((ev.transcript as string) ?? "").trim();
          if (text) upsertLine(`t-${ev.item_id}`, "tutor", () => text, true);
          break;
        }
        case "error": {
          const err = ev.error as { message?: string } | undefined;
          console.error("[realtime] server error:", err);
          if (err?.message?.toLowerCase().includes("session")) {
            endSession("The session ended unexpectedly. Start a new one when ready.");
          }
          break;
        }
      }
    },
    [endSession, upsertLine],
  );

  const start = useCallback(async () => {
    setError(null);
    setLines([]);
    setElapsed(0);
    setMuted(false);
    setShowUpsell(false);
    endedRef.current = false;
    setPhase("connecting");

    try {
      const tokenRes = await fetch("/api/realtime/session", { method: "POST" });
      const tokenJson = (await tokenRes.json().catch(() => ({}))) as {
        clientSecret?: string;
        model?: string;
        plan?: string;
        maxSeconds?: number;
        error?: string;
      };
      if (!tokenRes.ok || !tokenJson.clientSecret) {
        throw new Error(tokenJson.error ?? "Couldn't start a session. Please try again.");
      }
      const cap = tokenJson.maxSeconds ?? DEFAULT_MAX_SECONDS;
      const isFree = tokenJson.plan !== "pro";
      setMaxSeconds(cap);
      capRef.current = cap;
      freeRef.current = isFree;

      let mic: MediaStream;
      try {
        mic = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
        });
      } catch {
        throw new Error(
          "Microphone access was blocked. Allow the mic in your browser settings and try again.",
        );
      }
      micRef.current = mic;

      const pc = new RTCPeerConnection();
      pcRef.current = pc;
      pc.ontrack = (e) => {
        if (audioRef.current) {
          audioRef.current.srcObject = e.streams[0];
          void audioRef.current.play().catch(() => {});
        }
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
          endSession("Connection lost. Start a new conversation when ready.");
        }
      };
      pc.addTrack(mic.getAudioTracks()[0], mic);

      const dc = pc.createDataChannel("oai-events");
      dcRef.current = dc;
      dc.onmessage = (e) => handleEvent(e.data);
      dc.onopen = () => {
        setPhase("live");
        // Have the tutor greet first so the learner isn't talking into silence.
        dc.send(JSON.stringify({ type: "response.create" }));
        timerRef.current = setInterval(() => {
          setElapsed((s) => {
            if (s + 1 >= capRef.current) {
              if (freeRef.current) {
                setShowUpsell(true);
                endSession("That's your free 5 minutes for today — nice work.");
              } else {
                endSession("Session time limit reached — start a fresh one anytime.");
              }
              return s + 1;
            }
            return s + 1;
          });
        }, 1000);
      };
      dc.onclose = () => {
        if (!endedRef.current && phaseRef.current === "live") {
          endSession();
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sdpRes = await fetch(
        `https://api.openai.com/v1/realtime/calls?model=${tokenJson.model ?? "gpt-realtime"}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokenJson.clientSecret}`,
            "Content-Type": "application/sdp",
          },
          body: offer.sdp,
        },
      );
      if (!sdpRes.ok) {
        throw new Error("Couldn't reach the voice service. Please try again.");
      }
      await pc.setRemoteDescription({ type: "answer", sdp: await sdpRes.text() });
    } catch (err) {
      cleanup();
      endedRef.current = true;
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setPhase("error");
    }
  }, [cleanup, endSession, handleEvent]);

  // dc.onclose and the timer fire long after render; read current values via refs.
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const capRef = useRef(DEFAULT_MAX_SECONDS);
  const freeRef = useRef(true);

  const toggleMute = useCallback(() => {
    const track = micRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMuted(!track.enabled);
  }, []);

  const live = phase === "live";
  const nearLimit = live && elapsed >= maxSeconds - 60;

  return (
    <div className="flex flex-col gap-4">
      <audio ref={audioRef} autoPlay className="hidden" />

      <section className="rounded-3xl bg-surface p-6 text-center shadow-lift ring-1 ring-border">
        <div className="relative mx-auto grid h-28 w-28 place-items-center">
          {live && tutorSpeaking && (
            <>
              <span className="absolute inset-0 animate-ping rounded-full bg-brand/20" />
              <span className="absolute -inset-2 rounded-full bg-brand/10" />
            </>
          )}
          <span
            className={cn(
              "relative grid h-24 w-24 place-items-center rounded-full bg-gradient-to-br from-brand to-brand-dark text-brand-fg shadow-soft transition-transform",
              live && tutorSpeaking && "scale-105 shadow-glow-brand",
            )}
          >
            {live && tutorSpeaking ? (
              <Volume2 className="h-9 w-9" />
            ) : (
              <span className="font-arabic text-4xl" dir="rtl">
                مع
              </span>
            )}
          </span>
        </div>

        <p className="mt-4 text-sm font-semibold text-fg-muted" aria-live="polite">
          {phase === "idle" && "Your tutor speaks only Fusha — greet them and dive in."}
          {phase === "connecting" && "Connecting to your tutor…"}
          {live && tutorSpeaking && "Tutor is speaking — feel free to interrupt."}
          {live && !tutorSpeaking && userSpeaking && "Listening to you…"}
          {live && !tutorSpeaking && !userSpeaking && "Your turn — say something in Arabic."}
          {phase === "ended" && "Conversation ended."}
          {phase === "error" && "Couldn't start the conversation."}
        </p>

        {live && (
          <p
            className={cn(
              "mt-1 text-xs font-bold tabular-nums",
              nearLimit ? "text-flame" : "text-fg-muted",
            )}
          >
            {formatClock(elapsed)}
            {nearLimit && " · wrapping up soon"}
          </p>
        )}

        {error && (
          <p
            className={cn(
              "mx-auto mt-3 max-w-sm rounded-xl px-3 py-2 text-xs font-semibold",
              showUpsell ? "bg-brand/10 text-brand" : "bg-danger/10 text-danger",
            )}
          >
            {error}
          </p>
        )}

        {showUpsell && (
          <Link
            href="/upgrade"
            className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-brand/10 px-4 py-2 text-sm font-bold text-brand transition hover:bg-brand/15"
          >
            <Sparkles className="h-4 w-4" /> Go Pro for 15-minute daily conversations
          </Link>
        )}

        <div className="mt-5 flex items-center justify-center gap-3">
          {(phase === "idle" || phase === "error") && (
            <button
              onClick={start}
              className="inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-3 font-semibold text-brand-fg transition hover:bg-brand-dark"
            >
              <Phone className="h-4 w-4" />
              {phase === "error" ? "Try again" : "Start conversation"}
            </button>
          )}

          {phase === "connecting" && (
            <button
              disabled
              className="inline-flex cursor-wait items-center gap-2 rounded-xl bg-brand/60 px-6 py-3 font-semibold text-brand-fg"
            >
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-fg/40 border-t-brand-fg" />
              Connecting…
            </button>
          )}

          {live && (
            <>
              <button
                onClick={toggleMute}
                aria-pressed={muted}
                className={cn(
                  "inline-flex items-center gap-2 rounded-xl px-5 py-3 font-semibold ring-1 transition",
                  muted
                    ? "bg-flame/15 text-flame ring-flame/30"
                    : "bg-bg-muted text-fg ring-border hover:bg-bg",
                )}
              >
                {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                {muted ? "Unmute" : "Mute"}
              </button>
              <button
                onClick={() => endSession()}
                className="inline-flex items-center gap-2 rounded-xl bg-danger px-5 py-3 font-semibold text-white transition hover:opacity-90"
              >
                <PhoneOff className="h-4 w-4" /> End
              </button>
            </>
          )}

          {phase === "ended" && (
            <button
              onClick={start}
              className="inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-3 font-semibold text-brand-fg transition hover:bg-brand-dark"
            >
              <RotateCcw className="h-4 w-4" /> New conversation
            </button>
          )}
        </div>
      </section>

      {lines.length > 0 && (
        <section className="rounded-3xl bg-surface p-4 shadow-card ring-1 ring-border">
          <h2 className="px-2 pb-2 text-xs font-bold uppercase tracking-wide text-fg-muted">
            Transcript
          </h2>
          <div ref={transcriptRef} className="flex max-h-80 flex-col gap-2 overflow-y-auto px-1">
            {lines.map((l) => (
              <div
                key={l.id}
                className={cn("flex", l.role === "user" ? "justify-end" : "justify-start")}
              >
                <p
                  dir="rtl"
                  className={cn(
                    "font-arabic max-w-[85%] rounded-2xl px-4 py-2 text-lg leading-relaxed",
                    l.role === "user"
                      ? "rounded-br-md bg-brand/10 text-fg"
                      : "rounded-bl-md bg-bg-muted text-fg",
                    !l.final && "opacity-70",
                  )}
                >
                  {l.text}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {phase === "idle" && (
        <section className="grid gap-2 sm:grid-cols-3">
          {[
            ["تكلَّم بلا خوف", "Mistakes are the point — the tutor corrects you and moves on."],
            ["قُل «أبطئ»", 'Control the pace: say "slow down", "speed up", or "interrupt me more".'],
            ["قاطِعه متى شئت", "It's a real conversation — you can cut the tutor off mid-sentence."],
          ].map(([ar, en]) => (
            <div key={ar} className="rounded-2xl bg-surface p-4 ring-1 ring-border">
              <p className="font-arabic text-lg text-brand" dir="rtl">
                {ar}
              </p>
              <p className="mt-1 text-xs text-fg-muted">{en}</p>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
