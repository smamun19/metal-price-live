import * as React from 'react';

import { StyleSheet, View, Text } from 'react-native';
import useMetalPriceLive from 'metal-price-live';

export default function App() {
  const { status } = useMetalPriceLive(
    'wss://your-websocket-endpoint',
    'your-api-key'
  );

  return (
    <View style={styles.container}>
      <Text>Result: {status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  box: {
    width: 60,
    height: 60,
    marginVertical: 20,
  },
});
