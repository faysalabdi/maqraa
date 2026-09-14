import { Ionicons } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArabicText } from "../components/ArabicText";
import { Button } from "../components/ui";
import { useMe } from "../lib/me-context";
import {
  fetchPackages,
  purchase,
  restore as restorePurchases,
  type Buyable,
  type PackagesResult,
} from "../lib/purchases";
import { centeredContent } from "../lib/theme";
import { usePalette } from "../lib/use-palette";

const PERKS = [
  "Intermediate and Advanced books",
  "Unlimited review deck",
  "Much higher daily AI limits",
  "Longer voice practice sessions",
];

export default function Paywall() {
  const c = usePalette();
  const { plan, refresh } = useMe();
  const [packages, setPackages] = useState<Buyable[] | null>(null);
  const [selected, setSelected] = useState<Buyable | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [reason, setReason] = useState<Exclude<PackagesResult, { ok: true }>["reason"] | null>(null);

  // StoreKit can answer empty transiently right after launch, so one retry is
  // worth it — but every attempt is time-boxed inside fetchPackages, so this
  // always reaches a terminal state rather than spinning forever.
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setReason(null);
      for (let tries = 0; tries < 2; tries++) {
        const res = await fetchPackages();
        if (!alive) return;
        if (res.ok) {
          setPackages(res.buyables);
          setSelected(res.buyables.find((x) => x.label === "Yearly") ?? res.buyables[0]);
          setLoading(false);
          return;
        }
        // A build with no key will never succeed — do not sit through a retry.
        if (res.reason === "unavailable" || tries === 1) {
          setPackages([]);
          setReason(res.reason);
          setLoading(false);
          return;
        }
        await new Promise((r) => setTimeout(r, 1200));
      }
    })();
    return () => {
      alive = false;
    };
  }, [attempt]);

  const finishAfterEntitlement = async () => {
    for (let i = 0; i < 6; i++) {
      await refresh();
      await new Promise((r) => setTimeout(r, 1500));
    }
    router.back();
  };

  const buy = async () => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      if ((await purchase(selected)) === "entitled") await finishAfterEntitlement();
    } catch (e) {
      const err = e as { userCancelled?: boolean; message?: string };
      if (!err.userCancelled) setError(err.message ?? "Purchase failed.");
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    setBusy(true);
    setError(null);
    try {
      if (await restorePurchases()) await finishAfterEntitlement();
      else setError("No previous purchase found for this Apple ID.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Restore failed.");
    } finally {
      setBusy(false);
    }
  };

  const alreadyPro = plan === "pro";

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]} edges={["top", "bottom"]}>
      <Stack.Screen options={{ headerShown: false, presentation: "modal" }} />
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Close">
          <Ionicons name="close" size={24} color={c.fgMuted} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={[styles.content, centeredContent]}>
        <ArabicText style={[styles.logo, { color: c.brand }]}>مقرأ</ArabicText>
        <Text style={[styles.title, { color: c.fg }]}>Maqraa Pro</Text>

        {alreadyPro ? (
          <View style={styles.centerBlock}>
            <Ionicons name="checkmark-circle" size={56} color={c.brand} />
            <Text style={{ color: c.fg, fontSize: 18, fontWeight: "700", textAlign: "center" }}>
              You already have Maqraa Pro
            </Text>
            <Text style={{ color: c.fgMuted, textAlign: "center" }}>
              Every book, unlimited reviews, and higher limits are unlocked.
            </Text>
            <Button title="Done" onPress={() => router.back()} />
          </View>
        ) : (
          <>
            <View style={styles.perks}>
              {PERKS.map((perk) => (
                <View key={perk} style={styles.perkRow}>
                  <Ionicons name="checkmark-circle" size={20} color={c.brand} />
                  <Text style={{ color: c.fg, fontSize: 15, flex: 1 }}>{perk}</Text>
                </View>
              ))}
            </View>

            {loading ? (
              <ActivityIndicator style={{ marginVertical: 20 }} />
            ) : packages && packages.length > 0 ? (
              <View style={{ gap: 10 }}>
                {packages.map((buyable) => {
                  const isSelected = selected?.id === buyable.id;
                  return (
                    <Pressable
                      key={buyable.id}
                      onPress={() => setSelected(buyable)}
                      style={[
                        styles.pkg,
                        {
                          borderColor: isSelected ? c.brand : c.border,
                          backgroundColor: isSelected ? `${c.brand}10` : c.surface,
                        },
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: c.fg, fontWeight: "700", fontSize: 16 }}>
                          {buyable.label}
                        </Text>
                        <Text style={{ color: c.fgMuted, fontSize: 13 }}>
                          {buyable.priceString}
                          {buyable.suffix}
                        </Text>
                      </View>
                      {isSelected ? (
                        <Ionicons name="checkmark-circle" size={22} color={c.brand} />
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <View style={[styles.notice, { backgroundColor: c.surface, borderColor: c.border }]}>
                <Text style={{ color: c.fg, fontWeight: "600", textAlign: "center" }}>
                  {reason === "unavailable"
                    ? "Purchases unavailable in this build"
                    : "Couldn't load plans"}
                </Text>
                <Text style={{ color: c.fgMuted, fontSize: 13, textAlign: "center" }}>
                  {reason === "unavailable"
                    ? "In-app purchases aren't set up in this build of the app."
                    : reason === "empty"
                      ? "The App Store returned no subscriptions for this account. If they were only just approved, it can take a little while for them to appear."
                      : "The App Store didn't respond in time. Check your connection and try again."}
                </Text>
                {reason === "unavailable" ? null : (
                  <Button
                    title="Try again"
                    variant="ghost"
                    onPress={() => setAttempt((n) => n + 1)}
                  />
                )}
              </View>
            )}

            {error ? <Text style={{ color: c.danger, textAlign: "center" }}>{error}</Text> : null}

            {packages && packages.length > 0 ? (
              <Button title="Continue" onPress={buy} loading={busy} disabled={!selected} />
            ) : null}
            <Pressable onPress={restore} disabled={busy}>
              <Text style={{ color: c.fgMuted, textAlign: "center", padding: 8 }}>
                Restore purchases
              </Text>
            </Pressable>
            <Text style={{ color: c.fgMuted, fontSize: 11, textAlign: "center", lineHeight: 16 }}>
              Payment is charged to your Apple ID. Subscriptions renew automatically unless cancelled
              at least 24 hours before the end of the period. Manage or cancel anytime in App Store
              settings.
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  topBar: { paddingHorizontal: 20, paddingVertical: 8 },
  content: { padding: 24, gap: 18, paddingBottom: 40 },
  logo: { fontSize: 44, textAlign: "center" },
  title: { fontSize: 28, fontWeight: "800", textAlign: "center" },
  centerBlock: { alignItems: "center", gap: 12, paddingVertical: 30 },
  perks: { gap: 10 },
  perkRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  pkg: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 2,
    borderRadius: 14,
    padding: 16,
  },
  notice: { borderWidth: 1, borderRadius: 14, padding: 16, gap: 6 },
});
