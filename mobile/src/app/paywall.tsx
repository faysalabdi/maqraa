import { Ionicons } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { PurchasesPackage } from "react-native-purchases";
import { ArabicText } from "../components/ArabicText";
import { Button } from "../components/ui";
import { useMe } from "../lib/me-context";
import { purchasesAvailable } from "../lib/purchases";
import { usePalette } from "../lib/use-palette";

// Lazy so the module never crashes in Expo Go (native lives in the built app).
type Purchases = typeof import("react-native-purchases").default;
let rc: Purchases | null = null;
function loadPurchases(): Purchases | null {
  if (rc) return rc;
  try {
    rc = (require("react-native-purchases") as { default: Purchases }).default;
    return rc;
  } catch {
    return null;
  }
}

const PERKS = [
  "Intermediate and Advanced books",
  "Unlimited review deck",
  "Much higher daily AI limits",
  "Longer voice practice sessions",
];

export default function Paywall() {
  const c = usePalette();
  const { plan, refresh } = useMe();
  const [packages, setPackages] = useState<PurchasesPackage[] | null>(null);
  const [selected, setSelected] = useState<PurchasesPackage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const p = loadPurchases();
    if (!purchasesAvailable() || !p) {
      setLoading(false);
      return;
    }
    p.getOfferings()
      .then((offerings) => {
        if (!alive) return;
        const pkgs = offerings.current?.availablePackages ?? [];
        setPackages(pkgs);
        setSelected(pkgs.find((x) => x.packageType === "ANNUAL") ?? pkgs[0] ?? null);
      })
      .catch(() => {
        if (alive) setPackages([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const finishAfterEntitlement = async () => {
    for (let i = 0; i < 6; i++) {
      await refresh();
      await new Promise((r) => setTimeout(r, 1500));
    }
    router.back();
  };

  const buy = async () => {
    const p = loadPurchases();
    if (!selected || !p) return;
    setBusy(true);
    setError(null);
    try {
      const { customerInfo } = await p.purchasePackage(selected);
      if (customerInfo.entitlements.active["pro"]) await finishAfterEntitlement();
    } catch (e) {
      const err = e as { userCancelled?: boolean; message?: string };
      if (!err.userCancelled) setError(err.message ?? "Purchase failed.");
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    const p = loadPurchases();
    if (!p) return;
    setBusy(true);
    setError(null);
    try {
      const customerInfo = await p.restorePurchases();
      if (customerInfo.entitlements.active["pro"]) await finishAfterEntitlement();
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

      <ScrollView contentContainerStyle={styles.content}>
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
                {packages.map((pkg) => {
                  const isSelected = selected?.identifier === pkg.identifier;
                  return (
                    <Pressable
                      key={pkg.identifier}
                      onPress={() => setSelected(pkg)}
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
                          {pkg.packageType === "ANNUAL"
                            ? "Yearly"
                            : pkg.packageType === "MONTHLY"
                              ? "Monthly"
                              : pkg.product.title}
                        </Text>
                        <Text style={{ color: c.fgMuted, fontSize: 13 }}>
                          {pkg.product.priceString}
                          {pkg.packageType === "ANNUAL"
                            ? " / year"
                            : pkg.packageType === "MONTHLY"
                              ? " / month"
                              : ""}
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
                  Plans aren't available right now
                </Text>
                <Text style={{ color: c.fgMuted, fontSize: 13, textAlign: "center" }}>
                  Subscriptions are still being set up. Please check back soon.
                </Text>
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
