import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { MediaStream, RTCPeerConnection as RTCPeerConnectionType } from "react-native-webrtc";
import type { RealtimeSessionResponse } from "@maqraa/shared";

// Lazily loaded so the module doesn't crash in Expo Go (native code lives only
// in the built app). Resolved on first Start.
type WebRTC = typeof import("react-native-webrtc");
let webrtc: WebRTC | null = null;
function loadWebRTC(): WebRTC | null {
  if (webrtc) return webrtc;
  try {
    webrtc = require("react-native-webrtc") as WebRTC;
    return webrtc;
  } catch {
    return null;
  }
}
import { AppHeader } from "../../components/AppHeader";
import { ArabicText } from "../../components/ArabicText";
import { Washed } from "../../components/Background";
import { Button } from "../../components/ui";
import { API_BASE, authHeader } from "../../lib/api";
import { useMe } from "../../lib/me-context";
import { usePalette } from "../../lib/use-palette";

type Phase = "idle" | "connecting" | "live" | "ended" | "error";
type Line = { id: string; role: "user" | "tutor"; text: string };

const DEFAULT_MAX = 5 * 60;

function clock(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function TalkScreen() {
  const c = usePalette();
  const { plan } = useMe();
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [muted, setMuted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [maxSeconds, setMaxSeconds] = useState(DEFAULT_MAX);

  const pcRef = useRef<RTCPeerConnectionType | null>(null);
  const micRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const endedRef = useRef(false);
  const capRef = useRef(DEFAULT_MAX);

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    try {
      pcRef.current?.close();
    } catch {}
    pcRef.current = null;
    micRef.current?.getTracks().forEach((t) => t.stop());
    micRef.current = null;
  }, []);

  const end = useCallback(
    (reason?: string) => {
      if (endedRef.current) return;
      endedRef.current = true;
      cleanup();
      setPhase("ended");
      if (reason) setError(reason);
    },
    [cleanup],
  );

  // Tear down when leaving the tab, and on unmount.
  useEffect(() => () => cleanup(), [cleanup]);
  useFocusEffect(
    useCallback(() => {
      return () => end();
    }, [end]),
  );

  const upsert = useCallback((id: string, role: Line["role"], make: (prev: string) => string) => {
    setLines((prev) => {
      const i = prev.findIndex((l) => l.id === id);
      if (i === -1) return [...prev, { id, role, text: make("") }];
      const next = [...prev];
      next[i] = { ...next[i], text: make(next[i].text) };
      return next;
    });
  }, []);

  const handleEvent = useCallback(
    (raw: string) => {
      let ev: Record<string, unknown>;
      try {
        ev = JSON.parse(raw);
      } catch {
        return;
      }
      switch (ev.type as string) {
        case "conversation.item.input_audio_transcription.completed": {
          const t = ((ev.transcript as string) ?? "").trim();
          if (t) upsert(`u-${ev.item_id}`, "user", () => t);
          break;
        }
        case "response.output_audio_transcript.delta":
        case "response.audio_transcript.delta":
          upsert(`t-${ev.item_id}`, "tutor", (p) => p + ((ev.delta as string) ?? ""));
          break;
        case "response.output_audio_transcript.done":
        case "response.audio_transcript.done": {
          const t = ((ev.transcript as string) ?? "").trim();
          if (t) upsert(`t-${ev.item_id}`, "tutor", () => t);
          break;
        }
      }
    },
    [upsert],
  );

  const start = useCallback(async () => {
    setError(null);
    setLines([]);
    setElapsed(0);
    setMuted(false);
    endedRef.current = false;
    setPhase("connecting");

    try {
      const res = await fetch(`${API_BASE}/api/realtime/session`, {
        method: "POST",
        headers: { ...(await authHeader()), "Content-Type": "application/json" },
        body: "{}",
      });
      const json = (await res.json().catch(() => ({}))) as RealtimeSessionResponse & {
        error?: string;
      };
      if (!res.ok || !json.clientSecret) {
        throw new Error(json.error ?? "Couldn't start a session. Please try again.");
      }
      capRef.current = json.maxSeconds ?? DEFAULT_MAX;
      setMaxSeconds(capRef.current);

      const rtc = loadWebRTC();
      if (!rtc) throw new Error("Voice practice needs the full Maqraa app from the App Store.");
      const { mediaDevices, RTCPeerConnection, RTCSessionDescription } = rtc;

      const mic = await mediaDevices.getUserMedia({ audio: true });
      micRef.current = mic as unknown as MediaStream;

      const pc = new RTCPeerConnection();
      pcRef.current = pc;
      // react-native-webrtc auto-plays remote audio through the audio session.
      (pc as unknown as { addEventListener: (t: string, cb: (e: unknown) => void) => void }).addEventListener(
        "connectionstatechange",
        () => {
          const state = (pc as unknown as { connectionState: string }).connectionState;
          if (state === "failed" || state === "disconnected") {
            end("Connection lost. Start a new conversation when ready.");
          }
        },
      );
      mic.getAudioTracks().forEach((track) => pc.addTrack(track, mic as never));

      const dc = pc.createDataChannel("oai-events");
      // react-native-webrtc data channels use onmessage/onopen handlers.
      (dc as unknown as { onmessage: (e: { data: string }) => void }).onmessage = (e) =>
        handleEvent(e.data);
      (dc as unknown as { onopen: () => void }).onopen = () => {
        setPhase("live");
        dc.send(JSON.stringify({ type: "response.create" }));
        timerRef.current = setInterval(() => {
          setElapsed((s) => {
            if (s + 1 >= capRef.current) {
              end(
                plan === "pro"
                  ? "Session time limit reached — start a fresh one anytime."
                  : "That's your free 5 minutes for today — nice work.",
              );
            }
            return s + 1;
          });
        }, 1000);
      };

      const offer = await pc.createOffer({});
      await pc.setLocalDescription(offer);

      const sdpRes = await fetch(
        `https://api.openai.com/v1/realtime/calls?model=${json.model ?? "gpt-realtime"}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${json.clientSecret}`,
            "Content-Type": "application/sdp",
          },
          body: offer.sdp,
        },
      );
      if (!sdpRes.ok) throw new Error("Couldn't reach the voice service. Please try again.");
      await pc.setRemoteDescription(
        new RTCSessionDescription({ type: "answer", sdp: await sdpRes.text() }),
      );
    } catch (err) {
      cleanup();
      endedRef.current = true;
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setPhase("error");
    }
  }, [cleanup, end, handleEvent, plan]);

  const toggleMute = useCallback(() => {
    const track = micRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMuted(!track.enabled);
  }, []);

  const live = phase === "live";

  return (
    <Washed>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <AppHeader />
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={[styles.heading, { color: c.fg }]}>Talk</Text>
          <Text style={[styles.sub, { color: c.fgMuted }]}>
            Practise speaking with an Arabic voice tutor. Just talk — it listens, replies out loud,
            and keeps the conversation going at your level.
          </Text>

          {phase === "idle" || phase === "ended" || phase === "error" ? (
            <View style={styles.centerBlock}>
              <View style={[styles.orb, { backgroundColor: `${c.brand}18`, borderColor: c.brand }]}>
                <Ionicons name="mic" size={56} color={c.brand} />
              </View>
              {error ? <Text style={{ color: phase === "error" ? c.danger : c.fgMuted, textAlign: "center" }}>{error}</Text> : null}
              <Text style={{ color: c.fgMuted, fontSize: 13 }}>
                {plan === "pro" ? "Up to 15 minutes per session" : "5 minutes free per day"}
              </Text>
              <Button
                title={phase === "idle" ? "Start conversation" : "Start again"}
                onPress={start}
              />
              {plan !== "pro" ? (
                <Pressable onPress={() => router.push("/paywall")}>
                  <Text style={{ color: c.brand, fontWeight: "600" }}>
                    Get longer sessions with Pro
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : phase === "connecting" ? (
            <View style={styles.centerBlock}>
              <ActivityIndicator />
              <Text style={{ color: c.fgMuted }}>Connecting…</Text>
            </View>
          ) : (
            <View style={{ gap: 16 }}>
              <View style={styles.liveHeader}>
                <View style={[styles.liveOrb, { backgroundColor: c.brand }]}>
                  <Ionicons name="mic" size={40} color={c.brandFg} />
                </View>
                <Text style={{ color: c.fgMuted }}>
                  {clock(elapsed)} / {clock(maxSeconds)}
                </Text>
              </View>

              <View style={{ gap: 10 }}>
                {lines.map((l) => (
                  <View
                    key={l.id}
                    style={[
                      styles.bubble,
                      {
                        backgroundColor: l.role === "tutor" ? c.surface : `${c.brand}14`,
                        borderColor: c.border,
                        alignSelf: l.role === "tutor" ? "flex-start" : "flex-end",
                      },
                    ]}
                  >
                    <ArabicText style={{ color: c.fg, fontSize: 18 }}>{l.text}</ArabicText>
                  </View>
                ))}
                {lines.length === 0 ? (
                  <Text style={{ color: c.fgMuted, textAlign: "center" }}>
                    Say مرحبا to get started…
                  </Text>
                ) : null}
              </View>

              <View style={styles.controls}>
                <Pressable
                  onPress={toggleMute}
                  style={[styles.ctrl, { backgroundColor: muted ? c.danger : c.bgMuted }]}
                >
                  <Ionicons
                    name={muted ? "mic-off" : "mic"}
                    size={24}
                    color={muted ? "#fff" : c.fg}
                  />
                </Pressable>
                <Pressable
                  onPress={() => end()}
                  style={[styles.ctrl, styles.endCtrl, { backgroundColor: c.danger }]}
                >
                  <Ionicons name="call" size={26} color="#fff" />
                </Pressable>
              </View>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Washed>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 20, gap: 12, paddingBottom: 40 },
  heading: { fontSize: 30, fontWeight: "700" },
  sub: { fontSize: 14, lineHeight: 21 },
  centerBlock: { alignItems: "center", gap: 16, paddingVertical: 40 },
  orb: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  liveHeader: { alignItems: "center", gap: 10, paddingVertical: 12 },
  liveOrb: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  bubble: {
    maxWidth: "85%",
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  controls: { flexDirection: "row", justifyContent: "center", gap: 24, paddingTop: 12 },
  ctrl: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center" },
  endCtrl: { transform: [{ rotate: "135deg" }] },
});
