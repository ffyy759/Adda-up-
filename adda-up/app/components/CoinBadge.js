import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function CoinBadge({ coins }) {
  return (
    <View style={styles.badge}>
      <Text style={styles.text}>🪙 {coins || 0}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { backgroundColor: '#ff6b3520', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#ff6b3555' },
  text: { color: '#ff6b35', fontWeight: 'bold', fontSize: 13 },
});
