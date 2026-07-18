import { Ionicons } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Purchases, { type PurchasesPackage } from "react-native-purchases";
import { ArabicText } from "../components/ArabicText";
import { Button } from "../components/ui";
import { useMe } from "../lib/me-context";
import { purchasesAvailable } from "../lib/purchases";
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
  const [packages, setPackages] = useState<PurchasesPackage[] | null>(null);
  const [selected, setSelected] = useState<PurchasesPackage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!purchasesAvailable()) {
      setError("Purchases aren't available in this build.");
      return;
    }
    Purchases.getOfferings()
      .then((offerings) => {
        const pkgs = offerings.current?.availablePackages ?? [];
        setPackages(pkgs);
        setSelected(pkgs.find((p) => p.packageType === "ANNUAL") ?? pkgs[0] ?? null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load plans."));
  }, []);

  // Already Pro (e.g. web Stripe sub, or purchase just landed) — nothing to sell.
  useEffect(() => {
    if (plan === "pro") router.back();
  }, [plan]);

  const finishAfterEntitlement = async () => {
    // The RC webhook usually lands within seconds; poll /me a few times.
    for (let i = 0; i < 6; i++) {
      await refresh();
      await new Promise((r) => setTimeout(r, 1500));
    }
  };

  const buy = async () => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const { customerInfo } = await Purchases.purchasePackage(selected);
      if (customerInfo.entitlements.active["pro"]) {
        await finishAfterEntitlement();
        router.back();
      }
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
      const customerInfo = await Purchases.restorePurchases();
      if (customerInfo.entitlements.active["pro"]) {
        await finishAfterEntitlement();
        router.back();
      } else {
        setError("No previous purchase found for this Apple ID.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Restore failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]} edges={["top", "bottom"]}>
      <Stack.Screen options={{ headerShown: false, presentation: "modal" }} />
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={24} color={c.fgMuted} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <ArabicText style={[styles.logo, { color: c.brand }]}>مقرأة</ArabicText>
        <Text style={[styles.title, { color: c.fg }]}>Maqraa Pro</Text>

        <View style={styles.perks}>
          {PERKS.map((perk) => (
            <View key={perk} style={styles.perkRow}>
              <Ionicons name="checkmark-circle" size={20} color={c.brand} />
              <Text style={{ color: c.fg, fontSize: 15, flex: 1 }}>{perk}</Text>
            </View>
          ))}
        </View>

        {!packages && !error ? <ActivityIndicator style={{ marginVertical: 20 }} /> : null}

        {packages ? (
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
                      {pkg.packageType === "ANNUAL" ? "Yearly" : pkg.packageType === "MONTHLY" ? "Monthly" : pkg.product.title}
                    </Text>
                    <Text style={{ color: c.fgMuted, fontSize: 13 }}>
                      {pkg.product.priceString}
                      {pkg.packageType === "ANNUAL" ? " / year" : pkg.packageType === "MONTHLY" ? " / month" : ""}
                    </Text>
                  </View>
                  {isSelected ? <Ionicons name="checkmark-circle" size={22} color={c.brand} /> : null}
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {error ? <Text style={{ color: c.danger, textAlign: "center" }}>{error}</Text> : null}

        <Button title="Continue" onPress={buy} loading={busy} disabled={!selected} />
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
});
