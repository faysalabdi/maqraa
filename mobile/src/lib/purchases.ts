import Purchases, { LOG_LEVEL } from "react-native-purchases";

const apiKey = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;

let configured = false;
let configuring: Promise<void> | null = null;

/** True when a RevenueCat key is present (i.e. IAP is available in this build). */
export function purchasesAvailable(): boolean {
  return !!apiKey;
}

/**
 * Resolves once `configurePurchases` has finished for the signed-in user.
 * Callers that fetch offerings must await this: configuration is kicked off
 * from the session effect, so a screen opened immediately after launch can
 * otherwise query the SDK before it is configured and get nothing back.
 */
export async function purchasesReady(): Promise<boolean> {
  if (!apiKey) return false;
  if (configured) return true;
  try {
    await configuring;
  } catch {
    // configure logs its own failure; report readiness below.
  }
  return configured;
}

/**
 * Configure RevenueCat against the signed-in Supabase user, so webhook events
 * arrive with app_user_id = our user id and entitlement rows line up.
 */
export async function configurePurchases(userId: string): Promise<void> {
  if (!apiKey) return;
  configuring = (async () => {
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
  })();
  await configuring;
}

export async function logOutPurchases(): Promise<void> {
  if (!apiKey || !configured) return;
  try {
    await Purchases.logOut();
  } catch {
    // Already anonymous — fine.
  }
}
