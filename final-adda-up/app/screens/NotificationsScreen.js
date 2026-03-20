import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, StatusBar, RefreshControl
} from 'react-native';
import { db, auth } from '../firebase/config';
import {
  collection, query, orderBy, limit, getDocs,
  doc, updateDoc, where
} from 'firebase/firestore';

const NOTIF_ICONS = {
  follow: '👤', battle_vote: '🗳️', battle_win: '🏆',
  battle_share: '⚔️', coin_earn: '🪙', referral: '🤝',
  rank_up: '⬆️', roast: '🔥', mention: '📣', dm: '💬', default: '🔔',
};

export default function NotificationsScreen({ navigation }) {
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { fetchNotifs(); }, []);

  const fetchNotifs = async () => {
    try {
      const q = query(
        collection(db, 'notifications'),
        where('toUid', '==', auth.currentUser.uid),
        orderBy('createdAt', 'desc'),
        limit(40)
      );
      const snap = await getDocs(q);
      setNotifs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {}
    setLoading(false);
    setRefreshing(false);
  };

  const markAllRead = async () => {
    try {
      const unread = notifs.filter(n => !n.read);
      for (const n of unread) {
        await updateDoc(doc(db, 'notifications', n.id), { read: true });
      }
      setNotifs(prev => prev.map(n => ({ ...n, read: true })));
    } catch (e) {}
  };

  const handleNotifPress = async (item) => {
    // Mark as read
    try {
      await updateDoc(doc(db, 'notifications', item.id), { read: true });
      setNotifs(prev => prev.map(n => n.id === item.id ? { ...n, read: true } : n));
    } catch (e) {}
    // Navigate based on type
    if (item.type === 'battle_share' || item.type === 'battle_vote' || item.type === 'battle_win') {
      navigation.navigate('Battle');
    } else if (item.type === 'follow' && item.fromUid) {
      navigation.navigate('Profile', { uid: item.fromUid });
    } else if (item.type === 'dm' && item.fromUid) {
      navigation.navigate('DM', { otherUid: item.fromUid, otherName: item.fromName || 'User' });
    }
  };

  const getTimeAgo = (ts) => {
    if (!ts) return '';
    const now = Date.now();
    const time = ts.seconds ? ts.seconds * 1000 : new Date(ts).getTime();
    const diff = Math.floor((now - time) / 1000);
    if (diff < 60) return `${diff}s pehle`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m pehle`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h pehle`;
    return `${Math.floor(diff / 86400)}d pehle`;
  };

  const renderNotif = ({ item }) => {
    const icon = NOTIF_ICONS[item.type] || NOTIF_ICONS.default;
    return (
      <TouchableOpacity
        style={[styles.notifCard, !item.read && styles.notifUnread]}
        activeOpacity={0.8}
        onPress={() => handleNotifPress(item)}
      >
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>{icon}</Text>
          {!item.read && <View style={styles.unreadDot} />}
        </View>
        <View style={styles.notifContent}>
          <Text style={styles.notifText}>{item.message || 'Kuch hua hai!'}</Text>
          <Text style={styles.notifTime}>{getTimeAgo(item.createdAt)}</Text>
        </View>
        {item.coins && (
          <View style={styles.coinPill}>
            <Text style={styles.coinPillText}>+{item.coins} 🪙</Text>
          </View>
        )}
        {(item.battleCode || item.fromUid) && (
          <Text style={{ color: '#ff6b35', fontSize: 18 }}>→</Text>
        )}
      </TouchableOpacity>
    );
  };

  const unreadCount = notifs.filter(n => !n.read).length;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#16213e" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>🔔 Notifications</Text>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={markAllRead} style={styles.markReadBtn}>
            <Text style={styles.markReadText}>Sab padha</Text>
          </TouchableOpacity>
        )}
      </View>

      {unreadCount > 0 && (
        <View style={styles.unreadBanner}>
          <Text style={styles.unreadBannerText}>{unreadCount} naya notification hai! 🔥</Text>
        </View>
      )}

      {loading ? (
        <View style={styles.center}><Text style={styles.loadingText}>Load ho raha hai... ⏳</Text></View>
      ) : notifs.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>🔔</Text>
          <Text style={styles.emptyText}>Abhi koi notification nahi</Text>
          <Text style={styles.emptySubText}>Battles karo, coins kamao!</Text>
        </View>
      ) : (
        <FlatList
          data={notifs} renderItem={renderNotif} keyExtractor={item => item.id}
          contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchNotifs(); }} tintColor="#ff6b35" />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingTop: 50, backgroundColor: '#16213e', borderBottomWidth: 1, borderBottomColor: '#0f3460' },
  backBtn: { padding: 4 },
  backIcon: { color: '#ff6b35', fontSize: 22, fontWeight: 'bold' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  markReadBtn: { backgroundColor: '#ff6b3520', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  markReadText: { color: '#ff6b35', fontSize: 12, fontWeight: 'bold' },
  unreadBanner: { backgroundColor: '#ff6b3518', padding: 10, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#ff6b3530' },
  unreadBannerText: { color: '#ff6b35', fontWeight: 'bold', fontSize: 13 },
  list: { padding: 14 },
  notifCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#16213e', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#0f3460' },
  notifUnread: { borderColor: '#ff6b3555', backgroundColor: '#ff6b350a' },
  iconContainer: { position: 'relative', marginRight: 14 },
  icon: { fontSize: 26 },
  unreadDot: { position: 'absolute', top: -2, right: -2, width: 9, height: 9, borderRadius: 5, backgroundColor: '#ff6b35' },
  notifContent: { flex: 1 },
  notifText: { color: '#ddd', fontSize: 14, lineHeight: 20 },
  notifTime: { color: '#666', fontSize: 11, marginTop: 4 },
  coinPill: { backgroundColor: '#ffd70022', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  coinPillText: { color: '#ffd700', fontWeight: 'bold', fontSize: 12 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#888', fontSize: 16 },
  emptyEmoji: { fontSize: 50, marginBottom: 14 },
  emptyText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  emptySubText: { color: '#888', fontSize: 14, marginTop: 8 },
});
