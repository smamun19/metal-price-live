import * as React from 'react';

import { StyleSheet, View, Text } from 'react-native';
import useMetalPriceLive from 'metal-price-live';

const API_KEY = 'your-api-key';
// Set this to your Socket.IO price-feed server, e.g.
// 'https://your-pricefeed.example.com'. The example won't connect while empty.
const API_URL = '';

export default function App() {
  const state = useMetalPriceLive(API_KEY, API_URL, {
    path: 'socket.io',
    event: 'your:event-name',
  });

  return (
    <View style={styles.container}>
      <Text style={styles.status}>Status: {state.status}</Text>

      {state.status === 'error' && (
        <Text style={styles.error}>Error: {state.error}</Text>
      )}

      {state.status === 'connected' && (
        <View style={styles.quotes}>
          <Text>
            Gold (XAUUSD) — bid {state.data.XAUUSD.bid} / ask{' '}
            {state.data.XAUUSD.ask}
          </Text>
          <Text>
            Silver (XAGUSD) — bid {state.data.XAGUSD.bid} / ask{' '}
            {state.data.XAGUSD.ask}
          </Text>
          <Text style={styles.meta}>
            Updated {state.data.timestamp}
            {state.data.stale ? ' (stale)' : ''}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  status: {
    fontSize: 16,
    marginBottom: 12,
  },
  error: {
    color: 'red',
  },
  quotes: {
    alignItems: 'center',
    gap: 6,
  },
  meta: {
    marginTop: 8,
    fontSize: 12,
    opacity: 0.7,
  },
});
