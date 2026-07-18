import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, FormError, Input } from "../../components/ui";
import { supabase } from "../../lib/supabase";
import { usePalette } from "../../lib/use-palette";

export default function Verify() {
  const c = usePalette();
  const { email } = useLocalSearchParams<{ email: string }>();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const verify = async () => {
    if (!email) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code.trim(),
      type: "signup",
    });
    if (error) setError(error.message);
    setBusy(false);
    // On success the session appears and (auth)/_layout redirects to the app.
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <View style={styles.container}>
          <Text style={[styles.title, { color: c.fg }]}>Check your email</Text>
          <Text style={[styles.subtitle, { color: c.fgMuted }]}>
            We sent a 6-digit code to {email ?? "your email"}.
          </Text>

          <View style={styles.form}>
            <Input
              placeholder="123456"
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              maxLength={6}
              value={code}
              onChangeText={setCode}
              style={styles.code}
            />
            <FormError message={error} />
            <Button title="Verify" onPress={verify} loading={busy} disabled={code.length !== 6} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  container: { flex: 1, justifyContent: "center", paddingHorizontal: 24, gap: 8 },
  title: { fontSize: 26, fontWeight: "700", textAlign: "center" },
  subtitle: { fontSize: 15, textAlign: "center", marginBottom: 20 },
  form: { gap: 12 },
  code: { textAlign: "center", fontSize: 24, letterSpacing: 8 },
});
