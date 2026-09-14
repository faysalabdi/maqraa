import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { cueFor, MUTE_STORAGE_KEY, type CelebrationEvent } from "@maqraa/shared";

/**
 * Cue dispatch for the app. The event table lives in the shared package, so
 * this and the web layer react to the same moments in the same way.
 *
 * Sound is not here yet. The web layer synthesises its cues from oscillators;
 * React Native has no equivalent, so the same six cues need real audio files
 * and a native audio package. Haptics carry the feedback until those exist —
 * `playSound` below is the seam they drop into.
 */

let muted = false;

/** Load the saved preference. Call once at launch, before any cue can fire. */
export async function hydrateFeedbackPrefs(): Promise<void> {
  try {
    muted = (await AsyncStorage.getItem(MUTE_STORAGE_KEY)) === "1";
  } catch {
    // Storage unavailable — default to on, the preference just will not stick.
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

function playSound(_event: CelebrationEvent): void {
  // Intentionally empty: see the note above. Wiring audio means adding the
  // asset files and an audio package, both of which need a native rebuild.
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
