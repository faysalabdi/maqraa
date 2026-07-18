import { Ionicons } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";
import { Platform, type ColorValue } from "react-native";
import { useSession } from "../../lib/auth-context";
import { usePalette } from "../../lib/use-palette";

type IconName = keyof typeof Ionicons.glyphMap;

const icon = (name: IconName) =>
  function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Ionicons name={name} color={color as string} size={size} />;
  };

export default function TabsLayout() {
  const { session, loading } = useSession();
  const c = usePalette();

  if (!loading && !session) return <Redirect href="/(auth)/sign-in" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.brand,
        tabBarInactiveTintColor: c.fgMuted,
        tabBarStyle: {
          backgroundColor: c.surface,
          borderTopColor: c.border,
          height: Platform.OS === "ios" ? 86 : 64,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen name="path" options={{ title: "Read", tabBarIcon: icon("book") }} />
      <Tabs.Screen name="talk" options={{ title: "Talk", tabBarIcon: icon("mic") }} />
      <Tabs.Screen name="words" options={{ title: "Words", tabBarIcon: icon("book-outline") }} />
      <Tabs.Screen name="review" options={{ title: "Review", tabBarIcon: icon("repeat") }} />
      <Tabs.Screen name="stats" options={{ title: "Stats", tabBarIcon: icon("stats-chart") }} />
      <Tabs.Screen name="awards" options={{ title: "Awards", tabBarIcon: icon("trophy") }} />
      {/* Settings lives behind the header avatar, not a tab. */}
      <Tabs.Screen name="settings" options={{ href: null }} />
    </Tabs>
  );
}
