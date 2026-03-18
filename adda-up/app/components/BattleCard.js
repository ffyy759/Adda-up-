import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export default function BattleCard({ item, onPress }) {
  const typeColors = { vote: '#00bcd4', prediction: '#9c27b0', roast: '#f44336' };
  const color = typeColors[item?.type] || '#ff6b35';
  return (
    <TouchableOpacity style={[styles.card, { borderLeftColor: color }]} onPress={onPress}>
      <Text style={[styles.type, { color }]}>{item?.type?.toUpperCase()}</Text>
      <Text style={styles.question} numberOfLines={2}>{item?.question}</Text>
      <Text style={styles.votes}>🗳️ {item?.totalVotes || 0} votes</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#16213e', borderRadius: 12, padding: 14, marginBottom: 10, borderLeftWidth: 4 },
  type: { fontWeight: 'bold', fontSize: 11, marginBottom: 6 },
  question: { color: '#fff', fontSize: 14, fontWeight: 'bold', marginBottom: 6 },
  votes: { color: '#888', fontSize: 12 },
});
