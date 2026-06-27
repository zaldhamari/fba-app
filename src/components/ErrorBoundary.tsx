import React, { Component, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { DS } from './ds';

interface Props {
  children: ReactNode;
  fallbackLabel?: string;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: unknown): State {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { hasError: true, message };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    if (__DEV__) console.error('[ErrorBoundary]', error, info.componentStack);
  }

  reset = () => this.setState({ hasError: false, message: '' });

  render() {
    if (!this.state.hasError) return this.props.children;

    const label = this.props.fallbackLabel ?? 'This section';

    return (
      <View style={s.container}>
        <Text style={s.icon}>⚠️</Text>
        <Text style={s.title}>{label} couldn't load</Text>
        <Text style={s.detail} numberOfLines={3}>{this.state.message}</Text>
        <TouchableOpacity style={s.btn} onPress={this.reset} activeOpacity={0.8}>
          <Text style={s.btnTxt}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const s = StyleSheet.create({
  container: {
    margin: 16,
    padding: 20,
    borderRadius: 12,
    backgroundColor: DS.bgCard,
    alignItems: 'center',
    gap: 8,
  },
  icon:   { fontSize: 28 },
  title:  { fontSize: 15, fontWeight: '600', color: DS.textPrimary, textAlign: 'center' },
  detail: { fontSize: 12, color: DS.textMuted, textAlign: 'center' },
  btn: {
    marginTop: 4,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: DS.accent,
  },
  btnTxt: { fontSize: 14, fontWeight: '600', color: DS.bgCard },
});
