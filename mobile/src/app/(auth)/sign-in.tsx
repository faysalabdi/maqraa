import { Link } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArabicText } from "../../components/ArabicText";
import { Button, FormError, Input } from "../../components/ui";
import { supabase } from "../../lib/supabase";
import { usePalette } from "../../lib/use-palette";

export default function SignIn() {
  const c = usePalette();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const signIn = async () => {
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) setError(error.message);
    setBusy(false);
    // On success the auth listener flips the session and (auth)/_layout redirects.
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <View style={styles.container}>
          <ArabicText style={[styles.logo, { color: c.brand }]}>مقرأة</ArabicText>
          <Text style={[styles.title, { color: c.fg }]}>Welcome back</Text>
          <Text style={[styles.subtitle, { color: c.fgMuted }]}>
            Sign in to keep your streak going.
          </Text>

          <View style={styles.form}>
            <Input
              placeholder="Email"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            <Input
              placeholder="Password"
              secureTextEntry
              autoComplete="current-password"
              value={password}
              onChangeText={setPassword}
            />
            <FormError message={error} />
            <Button title="Sign in" onPress={signIn} loading={busy} disabled={!email || !password} />
          </View>

          <Link href="/(auth)/sign-up" style={[styles.link, { color: c.fgMuted }]}>
            New to Maqraa? <Text style={{ color: c.brand, fontWeight: "600" }}>Create an account</Text>
          </Link>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  container: { flex: 1, justifyContent: "center", paddingHorizontal: 24, gap: 8 },
  logo: { fontSize: 56, textAlign: "center", marginBottom: 8 },
  title: { fontSize: 26, fontWeight: "700", textAlign: "center" },
  subtitle: { fontSize: 15, textAlign: "center", marginBottom: 20 },
  form: { gap: 12 },
  link: { textAlign: "center", marginTop: 24, fontSize: 15 },
});
