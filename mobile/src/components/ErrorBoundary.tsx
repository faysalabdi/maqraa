import * as Updates from "expo-updates";
import { Component, type ReactNode } from "react";
import { ScrollView, Text, View } from "react-native";

/**
 * Without this, a render error is fatal: expo-updates' error recovery takes
 * over, fails to recover, and aborts the process. The user sees a hard crash
 * and the only record is a device crash log with no JavaScript message in it.
 *
 * Catching it keeps the app alive and puts the actual error on screen, which
 * is the difference between "it crashes" and a report we can act on.
 */
type Props = { children: ReactNode };
type State = { error: Error | null; info: string | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }): void {
    this.setState({ info: info.componentStack ?? null });
    console.error("[boundary]", error, info.componentStack);
  }

  render(): ReactNode {
    const { error, info } = this.state;
    if (!error) return this.props.children;

    const build = Updates.isEmbeddedLaunch
      ? "embedded bundle"
      : `update ${String(Updates.updateId ?? "unknown").slice(0, 8)}`;

    return (
      <View style={{ flex: 1, backgroundColor: "#0e1311", padding: 24, paddingTop: 80 }}>
        <Text style={{ color: "#f1efe6", fontSize: 20, fontWeight: "700", marginBottom: 8 }}>
          Something broke on this screen
        </Text>
        <Text style={{ color: "#9aa69c", fontSize: 13, marginBottom: 20 }}>
          {build} · runtime {Updates.runtimeVersion ?? "?"} · channel {Updates.channel ?? "?"}
        </Text>
        <ScrollView style={{ flex: 1 }}>
          <Text selectable style={{ color: "#e8b94f", fontSize: 14, marginBottom: 16 }}>
            {error.name}: {error.message}
          </Text>
          {info ? (
            <Text selectable style={{ color: "#9aa69c", fontSize: 11, lineHeight: 16 }}>
              {info.trim()}
            </Text>
          ) : null}
        </ScrollView>
        <Text
          onPress={() => {
            this.setState({ error: null, info: null });
          }}
          style={{
            color: "#04130c", backgroundColor: "#27b07b", textAlign: "center",
            paddingVertical: 14, borderRadius: 12, fontWeight: "700", marginTop: 16,
          }}
        >
          Go back
        </Text>
      </View>
    );
  }
}
