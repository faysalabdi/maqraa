import { Redirect, Stack } from "expo-router";
import { useSession } from "../../lib/auth-context";

export default function AuthLayout() {
  const { session, loading } = useSession();
  if (!loading && session) return <Redirect href="/(tabs)/path" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
