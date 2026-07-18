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
import { ThemeProvider, useTheme } from "../lib/theme-context";

SplashScreen.preventAutoHideAsync();

function Root() {
  const { scheme, palette } = useTheme();
  return (
    <SessionProvider>
      <MeProvider>
        <StatusBar style={scheme === "dark" ? "light" : "dark"} />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: palette.bg },
          }}
        >
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
        </Stack>
      </MeProvider>
    </SessionProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    NotoNaskhArabic_400Regular,
    NotoNaskhArabic_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <ThemeProvider>
      <Root />
    </ThemeProvider>
  );
}
