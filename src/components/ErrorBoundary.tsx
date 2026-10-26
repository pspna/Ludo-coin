import React, { Component, ErrorInfo, ReactNode } from 'react';
import { StyleSheet, Text, View, Pressable, ScrollView } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary caught an error]:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  handleBackToHome = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
    if (typeof window !== 'undefined' && window.location) {
      window.location.href = '/';
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <View style={styles.card}>
            <View style={styles.iconCircle}>
              <Ionicons name="alert-circle" size={44} color="#EF4444" />
            </View>

            <Text style={styles.title}>
              {this.props.fallbackTitle || 'Something went wrong'}
            </Text>

            <Text style={styles.subtitle}>
              An unexpected error occurred while rendering this screen.
            </Text>

            {this.state.error ? (
              <ScrollView style={styles.errorBox} contentContainerStyle={{ padding: 12 }}>
                <Text style={styles.errorText}>
                  {this.state.error.name}: {this.state.error.message}
                </Text>
                {this.state.error.stack ? (
                  <Text style={styles.stackText} numberOfLines={8}>
                    {this.state.error.stack}
                  </Text>
                ) : null}
              </ScrollView>
            ) : null}

            <View style={styles.actionsRow}>
              <Pressable
                style={[styles.btn, styles.primaryBtn]}
                onPress={this.handleRetry}
              >
                <Ionicons name="refresh" size={18} color="#FFFFFF" />
                <Text style={styles.primaryBtnText}>Try Again</Text>
              </Pressable>

              <Pressable
                style={[styles.btn, styles.secondaryBtn]}
                onPress={this.handleBackToHome}
              >
                <Ionicons name="home-outline" size={18} color="#94A3B8" />
                <Text style={styles.secondaryBtnText}>Back to Home</Text>
              </Pressable>
            </View>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#1E293B',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#334155',
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(239, 68, 68, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: '#F8FAFC',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  errorBox: {
    maxHeight: 140,
    width: '100%',
    backgroundColor: '#090D16',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 20,
  },
  errorText: {
    color: '#F87171',
    fontWeight: '800',
    fontSize: 12,
    lineHeight: 16,
  },
  stackText: {
    color: '#64748B',
    fontSize: 10,
    marginTop: 6,
    fontFamily: 'monospace',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
    borderRadius: 14,
  },
  primaryBtn: {
    backgroundColor: '#7C3AED',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  secondaryBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: '#334155',
  },
  secondaryBtnText: {
    color: '#CBD5E1',
    fontWeight: '700',
    fontSize: 14,
  },
});
