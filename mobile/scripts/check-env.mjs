/**
 * Guards against the failure mode that gets store binaries rejected: every
 * EXPO_PUBLIC_* value is inlined into the bundle at BUILD time, so a variable
 * that only exists in a local .env.local is simply absent from an EAS build.
 * The app then ships looking fine but with whole features quietly dead — which
 * is how a build went out with in-app purchases disabled.
 *
 * Runs as the eas-build-post-install hook. Fails a production build outright;
 * warns on every other profile so local and preview builds stay convenient.
 */

const REQUIRED = [
  "EXPO_PUBLIC_SUPABASE_URL",
  "EXPO_PUBLIC_SUPABASE_ANON_KEY",
  "EXPO_PUBLIC_API_URL",
  "EXPO_PUBLIC_REVENUECAT_IOS_KEY",
];

const profile = process.env.EAS_BUILD_PROFILE ?? "local";
const missing = REQUIRED.filter((key) => !process.env[key]);

if (missing.length === 0) {
  console.log(`[check-env] ${REQUIRED.length} required vars present (profile: ${profile})`);
  process.exit(0);
}

const list = missing.map((key) => `  - ${key}`).join("\n");

if (profile === "production") {
  console.error(
    `\n[check-env] Missing ${missing.length} required variable(s) for a production build:\n${list}\n\n` +
      `Set them on the EAS project (eas env:create) and rebuild. Shipping without\n` +
      `them produces a binary where the matching feature is silently unavailable.\n`,
  );
  process.exit(1);
}

console.warn(
  `\n[check-env] Missing ${missing.length} variable(s) (profile: ${profile}):\n${list}\n` +
    `Allowed outside production, but the matching features will be unavailable.\n`,
);
