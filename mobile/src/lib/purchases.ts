import Purchases, { LOG_LEVEL } from "react-native-purchases";

const apiKey = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;

let configured = false;

/** True when a RevenueCat key is present (i.e. IAP is available in this build). */
export function purchasesAvailable(): boolean {
  return !!apiKey;
}

/**
 * Configure RevenueCat against the signed-in Supabase user, so webhook events
 * arrive with app_user_id = our user id and entitlement rows line up.
 */
export async function configurePurchases(userId: string): Promise<void> {
  if (!apiKey) return;
  try {
    if (!configured) {
      Purchases.setLogLevel(LOG_LEVEL.WARN);
      Purchases.configure({ apiKey, appUserID: userId });
      configured = true;
    } else {
      await Purchases.logIn(userId);
    }
  } catch (e) {
    console.warn("[purchases] configure failed", e);
  }
}

export async function logOutPurchases(): Promise<void> {
  if (!apiKey || !configured) return;
  try {
    await Purchases.logOut();
  } catch {
    // Already anonymous — fine.
  }
}
