import Purchases, { LOG_LEVEL, type PurchasesPackage } from "react-native-purchases";

const apiKey = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;

/**
 * StoreKit's product request can stall indefinitely — no resolve, no reject —
 * when the store is unreachable or the products are not purchasable for the
 * account. Without a ceiling the paywall sits on a spinner forever, which is
 * what App Review saw. Past this we always show a recoverable state instead.
 */
const OFFERINGS_TIMEOUT_MS = 6000;

let configured = false;
let configuring: Promise<boolean> | null = null;

/** True when a RevenueCat key is present (i.e. IAP is available in this build). */
export function purchasesAvailable(): boolean {
  return !!apiKey;
}

class TimeoutError extends Error {}

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError("timed out")), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

function configure(appUserID?: string): Promise<boolean> {
  if (!apiKey) return Promise.resolve(false);
  if (configuring) return configuring;
  configuring = (async () => {
    try {
      Purchases.setLogLevel(LOG_LEVEL.WARN);
      Purchases.configure(appUserID ? { apiKey, appUserID } : { apiKey });
      configured = true;
    } catch (e) {
      console.warn("[purchases] configure failed", e);
      configured = false;
    }
    return configured;
  })();
  return configuring;
}

/**
 * Configure at launch, before any screen asks for prices. Purchases only
 * happen behind auth, so the anonymous window here is browse-only — but it
 * means a paywall opened during a slow session restore still loads its prices
 * rather than querying an unconfigured SDK.
 */
export function initPurchases(): Promise<boolean> {
  return configure();
}

/** Resolves once the SDK is configured (or known to be unavailable). */
export async function purchasesReady(): Promise<boolean> {
  if (!apiKey) return false;
  if (configured) return true;
  return configure();
}

/**
 * Attach the signed-in Supabase user, so webhook events arrive with
 * app_user_id = our user id and entitlement rows line up.
 */
export async function configurePurchases(userId: string): Promise<void> {
  if (!apiKey) return;
  if (!(await configure(userId))) return;
  try {
    await Purchases.logIn(userId);
  } catch (e) {
    console.warn("[purchases] logIn failed", e);
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

export type PackagesResult =
  | { ok: true; packages: PurchasesPackage[] }
  /** No key in this build — IAP was compiled out. */
  | { ok: false; reason: "unavailable" }
  /** The store answered, with nothing for sale on this account or storefront. */
  | { ok: false; reason: "empty" }
  | { ok: false; reason: "timeout" }
  | { ok: false; reason: "error" };

/** One bounded attempt at the current offering's packages. Never hangs. */
export async function fetchPackages(): Promise<PackagesResult> {
  if (!apiKey) return { ok: false, reason: "unavailable" };
  if (!(await purchasesReady())) return { ok: false, reason: "unavailable" };
  try {
    const offerings = await withTimeout(Purchases.getOfferings(), OFFERINGS_TIMEOUT_MS);
    const packages =
      offerings.current?.availablePackages ??
      Object.values(offerings.all ?? {})[0]?.availablePackages ??
      [];
    return packages.length > 0 ? { ok: true, packages } : { ok: false, reason: "empty" };
  } catch (e) {
    if (e instanceof TimeoutError) return { ok: false, reason: "timeout" };
    console.warn("[purchases] getOfferings failed", e);
    return { ok: false, reason: "error" };
  }
}
