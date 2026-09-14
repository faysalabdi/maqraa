import Purchases, {
  LOG_LEVEL,
  type PurchasesPackage,
  type PurchasesStoreProduct,
} from "react-native-purchases";

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

/**
 * The subscriptions as they are defined in App Store Connect. Only used for
 * the direct fallback below — the offering is still the preferred source,
 * because it is the one the RevenueCat dashboard can re-price and re-package
 * without an app release.
 */
const PRODUCT_IDS = ["maqraa_pro_yearly", "maqraa_pro_monthly"];

/** One thing the paywall can sell, whichever source it came from. */
export type Buyable = {
  id: string;
  label: string;
  priceString: string;
  /** "/ year", "/ month", or empty when the period is not a plain one. */
  suffix: string;
  pkg: PurchasesPackage | null;
  product: PurchasesStoreProduct | null;
};

export type PackagesResult =
  | { ok: true; buyables: Buyable[]; source: "offering" | "product" }
  /** No key in this build — IAP was compiled out. */
  | { ok: false; reason: "unavailable" }
  /** Both the offering and a direct product lookup came back empty. */
  | { ok: false; reason: "empty" }
  | { ok: false; reason: "timeout" }
  | { ok: false; reason: "error" };

function suffixForPeriod(period: string | null): string {
  if (period === "P1Y") return " / year";
  if (period === "P1M") return " / month";
  return "";
}

function fromPackage(pkg: PurchasesPackage): Buyable {
  const annual = pkg.packageType === "ANNUAL";
  const monthly = pkg.packageType === "MONTHLY";
  return {
    id: pkg.identifier,
    label: annual ? "Yearly" : monthly ? "Monthly" : pkg.product.title,
    priceString: pkg.product.priceString,
    suffix: annual ? " / year" : monthly ? " / month" : suffixForPeriod(pkg.product.subscriptionPeriod),
    pkg,
    product: null,
  };
}

function fromProduct(product: PurchasesStoreProduct): Buyable {
  const period = product.subscriptionPeriod;
  return {
    id: product.identifier,
    label: period === "P1Y" ? "Yearly" : period === "P1M" ? "Monthly" : product.title,
    priceString: product.priceString,
    suffix: suffixForPeriod(period),
    pkg: null,
    product,
  };
}

/**
 * What the paywall can sell right now. Never hangs.
 *
 * Offerings are tried first, then the products are looked up directly by id.
 * That fallback matters: an offering is a RevenueCat dashboard construct, so a
 * missing or empty "current" offering leaves getOfferings returning nothing
 * even when the subscriptions are live and purchasable on the App Store. Going
 * straight to StoreKit keeps the paywall sellable through that misconfiguration
 * — and if this comes back empty too, the problem is on the App Store side.
 */
export async function fetchPackages(): Promise<PackagesResult> {
  if (!apiKey) return { ok: false, reason: "unavailable" };
  if (!(await purchasesReady())) return { ok: false, reason: "unavailable" };

  let sawError = false;

  try {
    const offerings = await withTimeout(Purchases.getOfferings(), OFFERINGS_TIMEOUT_MS);
    const packages =
      offerings.current?.availablePackages ??
      Object.values(offerings.all ?? {})[0]?.availablePackages ??
      [];
    if (packages.length > 0) {
      return { ok: true, buyables: packages.map(fromPackage), source: "offering" };
    }
    console.warn("[purchases] no offering packages — falling back to direct product lookup");
  } catch (e) {
    if (e instanceof TimeoutError) return { ok: false, reason: "timeout" };
    console.warn("[purchases] getOfferings failed", e);
    sawError = true;
  }

  try {
    const products = await withTimeout(Purchases.getProducts(PRODUCT_IDS), OFFERINGS_TIMEOUT_MS);
    if (products.length > 0) {
      return { ok: true, buyables: products.map(fromProduct), source: "product" };
    }
    return { ok: false, reason: "empty" };
  } catch (e) {
    if (e instanceof TimeoutError) return { ok: false, reason: "timeout" };
    console.warn("[purchases] getProducts failed", e);
    return { ok: false, reason: sawError ? "error" : "empty" };
  }
}

export type PurchaseOutcome = "entitled" | "not-entitled" | "cancelled";

/** Buy whichever shape the paywall ended up with. */
export async function purchase(buyable: Buyable): Promise<PurchaseOutcome> {
  const { customerInfo } = buyable.pkg
    ? await Purchases.purchasePackage(buyable.pkg)
    : await Purchases.purchaseStoreProduct(buyable.product!);
  return customerInfo.entitlements.active["pro"] ? "entitled" : "not-entitled";
}

export async function restore(): Promise<boolean> {
  const customerInfo = await Purchases.restorePurchases();
  return !!customerInfo.entitlements.active["pro"];
}
