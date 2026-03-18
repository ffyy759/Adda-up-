import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export default function UserCard({ user, onPress }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{user?.username?.charAt(0).toUpperCase()}</Text>
      </View>
      <View>
        <Text style={styles.username}>{user?.username}</Text>
        <Text style={styles.coins}>🪙 {user?.coins || 0}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#16213e', borderRadius: 12, padding: 12, marginBottom: 8, gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#ff6b35', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  username: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  coins: { color: '#ffd700', fontSize: 12, marginTop: 2 },
});
