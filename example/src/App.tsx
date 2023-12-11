import * as React from 'react';

import { StyleSheet, View, Text } from 'react-native';
import useMetalPriceLive from 'metal-price-live';

export default function App() {
  const data = useMetalPriceLive('ws://localhost:5000');
  return (
    <View style={styles.container}>
      <Text>Result: {data.data}</Text>
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
