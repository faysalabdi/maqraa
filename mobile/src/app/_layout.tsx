import {
  NotoNaskhArabic_400Regular,
  NotoNaskhArabic_700Bold,
  useFonts,
} from "@expo-google-fonts/noto-naskh-arabic";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SessionProvider } from "../lib/auth-context";
import { MeProvider } from "../lib/me-context";
import { usePalette } from "../lib/use-palette";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const c = usePalette();
  const [fontsLoaded] = useFonts({
    NotoNaskhArabic_400Regular,
    NotoNaskhArabic_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <SessionProvider>
      <MeProvider>
        <StatusBar style="auto" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: c.bg },
          }}
        >
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
        </Stack>
      </MeProvider>
    </SessionProvider>
  );
}
