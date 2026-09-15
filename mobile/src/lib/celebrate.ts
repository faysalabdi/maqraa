import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import * as Haptics from "expo-haptics";
import { cueFor, MUTE_STORAGE_KEY, type CelebrationEvent } from "@maqraa/shared";

/**
 * Cue dispatch for the app. The event table lives in the shared package, so
 * this and the web layer react to the same moments in the same way.
 *
 * The web layer synthesises its cues from oscillators. React Native has no
 * equivalent, so these are files rendered from the same recipe table by
 * mobile/scripts/gen-cue-sounds.py — same sounds, different delivery.
 */

/**
 * Static requires, because Metro resolves assets at build time and cannot take
 * a path built at runtime.
 */
const SOURCES: Record<CelebrationEvent, number> = {
  "answer-correct": require("../../assets/sounds/answer-correct.wav"),
  "answer-missed": require("../../assets/sounds/answer-missed.wav"),
  "word-graduated": require("../../assets/sounds/word-graduated.wav"),
  "session-complete": require("../../assets/sounds/session-complete.wav"),
  "streak-extended": require("../../assets/sounds/streak-extended.wav"),
  "achievement-unlocked": require("../../assets/sounds/achievement-unlocked.wav"),
};

const players = new Map<CelebrationEvent, AudioPlayer>();

let muted = false;

/**
 * Load the saved preference and prepare audio. Call once at launch, before any
 * cue can fire.
 */
export async function hydrateFeedbackPrefs(): Promise<void> {
  try {
    muted = (await AsyncStorage.getItem(MUTE_STORAGE_KEY)) === "1";
  } catch {
    // Storage unavailable — default to on, the preference just will not stick.
  }
  try {
    // A cue is feedback on the reader's own action, so it should still sound
    // with the ringer switch off, and must never interrupt whatever they are
    // listening to while they read.
    await setAudioModeAsync({ playsInSilentMode: true, interruptionMode: "mixWithOthers" });
  } catch {
    // Audio session unavailable — cues stay silent rather than failing a cue.
  }
}

export function isFeedbackMuted(): boolean {
  return muted;
}

export async function setFeedbackMuted(next: boolean): Promise<void> {
  muted = next;
  try {
    await AsyncStorage.setItem(MUTE_STORAGE_KEY, next ? "1" : "0");
  } catch {
    // Still applies for this session.
  }
}

/**
 * Players are created once and reused. Cues fire on consecutive answers, and
 * building a player per cue would both leak and add latency to the one thing
 * that has to feel immediate.
 */
function playerFor(event: CelebrationEvent): AudioPlayer | null {
  const existing = players.get(event);
  if (existing) return existing;
  try {
    const player = createAudioPlayer(SOURCES[event]);
    players.set(event, player);
    return player;
  } catch {
    return null;
  }
}

function playSound(event: CelebrationEvent): void {
  const player = playerFor(event);
  if (!player) return;
  try {
    // Rewind first: a cue retriggered before it finished should restart, not
    // be ignored because the player is already at the end.
    void player.seekTo(0);
    player.play();
  } catch {
    // A cue is never worth taking a screen down for.
  }
}

export function celebrate(event: CelebrationEvent): void {
  if (muted) return;
  const cue = cueFor(event);
  if (cue.sound) playSound(cue.sound);
  switch (cue.haptic) {
    case "light":
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      break;
    case "medium":
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      break;
    case "success":
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      break;
    case "warning":
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      break;
    default:
      break;
  }
}

/** Whether this event should also throw confetti. */
export function hasConfetti(event: CelebrationEvent): boolean {
  return cueFor(event).confetti;
}
