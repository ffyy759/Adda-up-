import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, StatusBar, RefreshControl,
  ScrollView, Animated
} from 'react-native';
import { db, auth } from '../firebase/config';
import { collection, query, orderBy, limit, getDocs, doc, getDoc } from 'firebase/firestore';

const RANKS = [
  { name: 'Navagat', emoji: '🌱', min: 0, color: '#888' },
  { name: 'Khiladi', emoji: '⚡', min: 500, color: '#00bcd4' },
  { name: 'Dhaakad', emoji: '🔥', min: 1500, color: '#ff9800' },
  { name: 'Yoddha', emoji: '⚔️', min: 3000, color: '#f44336' },
  { name: 'Sher', emoji: '🦁', min: 6000, color: '#9c27b0' },
  { name: 'Baahubali', emoji: '🏹', min: 10000, color: '#ff6b35' },
  { name: 'Nawab', emoji: '👑', min: 15000, color: '#ffd700' },
  { name: 'Adda King', emoji: '🔱', min: 99999, color: '#ff1744' },
];

const getRank = (coins) => {
  let rank = RANKS[0];
  for (const r of RANKS) { if (coins >= r.min) rank = r; }
  return rank;
};

const getNextRank = (coins) => {
  for (let i = 0; i < RANKS.length; i++) {
    if (coins < RANKS[i].min) return RANKS[i];
  }
  return null;
};

const BATTLE_TABS = ['Sab', 'Vote', 'Prediction', 'Roast'];

export default function HomeScreen({ navigation }) {
  const [battles, setBattles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userData, setUserData] = useState(null);
  const [activeTab, setActiveTab] = useState('Sab');
  const bannerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fetchBattles();
    fetchUserData();
    Animated.timing(bannerAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  const fetchUserData = async () => {
    try {
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (userDoc.exists()) setUserData(userDoc.data());
    } catch (e) {}
  };

  const fetchBattles = async () => {
    try {
      const q = query(collection(db, 'battles'), orderBy('createdAt', 'desc'), limit(30));
      const snapshot = await getDocs(q);
      setBattles(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {}
    setLoading(false);
    setRefreshing(false);
  };

  const filteredBattles = activeTab === 'Sab'
    ? battles
    : battles.filter(b => b.type === activeTab.toLowerCase());

  const rank = userData ? getRank(userData.coins || 0) : null;
  const nextRank = userData ? getNextRank(userData.coins || 0) : null;
  const progress = rank && nextRank
    ? Math.min(((userData.coins - rank.min) / (nextRank.min - rank.min)) * 100, 100)
    : 100;

  const renderBattle = ({ item, index }) => {
    const typeColors = { vote: '#00bcd4', prediction: '#9c27b0', roast: '#f44336' };
    const typeEmojis = { vote: '🗳️', prediction: '🔮', roast: '🔥' };
    const color = typeColors[item.type] || '#ff6b35';

    return (
      <TouchableOpacity
        style={[styles.battleCard, { borderLeftColor: color, borderLeftWidth: 4 }]}
        onPress={() => navigation.navigate('Battle', { battle: item })}
        activeOpacity={0.85}
      >
        <View style={styles.battleHeader}>
          <View style={[styles.typeBadge, { backgroundColor: color + '22' }]}>
            <Text style={[styles.typeText, { color }]}>
              {typeEmojis[item.type] || '⚔️'} {item.type?.toUpperCase()}
            </Text>
          </View>
          <Text style={styles.coinText}>🪙 {item.coins || 10}</Text>
        </View>

        <Text style={styles.battleQuestion}>{item.question}</Text>

        {item.type === 'vote' && (
          <View style={styles.optionsRow}>
            <View style={styles.optionA}>
              <Text style={styles.optionText} numberOfLines={1}>👊 {item.optionA}</Text>
            </View>
            <Text style={styles.vsText}>VS</Text>
            <View style={styles.optionB}>
              <Text style={styles.optionText} numberOfLines={1}>👊 {item.optionB}</Text>
            </View>
          </View>
        )}

        <View style={styles.battleFooter}>
          <Text style={styles.footerText}>👤 {item.createdBy}</Text>
          <Text style={styles.footerText}>🗳️ {item.totalVotes || 0} votes</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#16213e" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Adda UP 🔥</Text>
          <Text style={styles.headerSub}>🧡 Made in UP</Text>
        </View>
        <View style={styles.headerRight}>
          {userData && (
            <TouchableOpacity style={styles.coinBadge} onPress={() => navigation.navigate('Coins')}>
              <Text style={styles.coinBadgeText}>🪙 {userData.coins || 0}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.notifBtn}
            onPress={() => navigation.navigate('Notifications')}
          >
            <Text style={styles.notifIcon}>🔔</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Rank Card */}
      {userData && rank && (
        <Animated.View style={[styles.rankCard, { opacity: bannerAnim }]}>
          <View style={styles.rankLeft}>
            <Text style={[styles.rankEmoji, { color: rank.color }]}>
              {rank.emoji}
            </Text>
            <View>
              <Text style={styles.rankGreet}>Jai Ho, {userData.username}!</Text>
              <Text style={[styles.rankName, { color: rank.color }]}>{rank.name}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('Leaderboard')}>
            <Text style={styles.rankViewText}>Leaderboard →</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Rank Progress Bar */}
      {userData && nextRank && (
        <View style={styles.progressContainer}>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${progress}%`, backgroundColor: rank.color }]} />
          </View>
          <Text style={styles.progressText}>
            {userData.coins} / {nextRank.min} coins → {nextRank.emoji} {nextRank.name}
          </Text>
        </View>
      )}

      {/* Filter Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll}>
        {BATTLE_TABS.map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Battles List */}
      {loading ? (
        <View style={styles.center}>
          <Text style={styles.loadingText}>Load ho raha hai... ⏳</Text>
        </View>
      ) : filteredBattles.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>Koi battle nahi! 😴</Text>
          <Text style={styles.emptySubText}>Pehle battle shuru karo 🔥</Text>
        </View>
      ) : (
        <FlatList
          data={filteredBattles}
          renderItem={renderBattle}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchBattles(); }}
              tintColor="#ff6b35"
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, paddingTop: 50, backgroundColor: '#16213e',
    borderBottomWidth: 1, borderBottomColor: '#0f3460',
  },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#ff6b35' },
  headerSub: { color: '#888', fontSize: 11, marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  coinBadge: {
    backgroundColor: '#ff6b3522', paddingHorizontal: 12,
    paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#ff6b3555',
  },
  coinBadgeText: { color: '#ff6b35', fontWeight: 'bold', fontSize: 13 },
  notifBtn: {
    backgroundColor: '#16213e', padding: 6, borderRadius: 20,
    borderWidth: 1, borderColor: '#0f3460',
  },
  notifIcon: { fontSize: 18 },
  rankCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    margin: 14, marginBottom: 6, backgroundColor: '#16213e',
    borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#0f3460',
  },
  rankLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rankEmoji: { fontSize: 32 },
  rankGreet: { color: '#ccc', fontSize: 12 },
  rankName: { fontWeight: 'bold', fontSize: 16 },
  rankViewText: { color: '#ff6b35', fontSize: 12, fontWeight: 'bold' },
  progressContainer: { paddingHorizontal: 14, marginBottom: 8 },
  progressBarBg: {
    height: 6, backgroundColor: '#0f3460', borderRadius: 3, overflow: 'hidden',
  },
  progressBarFill: { height: 6, borderRadius: 3 },
  progressText: { color: '#666', fontSize: 10, marginTop: 4, textAlign: 'right' },
  tabScroll: { paddingHorizontal: 12, paddingVertical: 8, maxHeight: 50 },
  tab: {
    paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20,
    marginRight: 8, backgroundColor: '#16213e',
    borderWidth: 1, borderColor: '#0f3460',
  },
  tabActive: { backgroundColor: '#ff6b35', borderColor: '#ff6b35' },
  tabText: { color: '#888', fontWeight: '600', fontSize: 13 },
  tabTextActive: { color: '#fff' },
  list: { padding: 14 },
  battleCard: {
    backgroundColor: '#16213e', borderRadius: 14, padding: 14,
    marginBottom: 12, borderWidth: 1, borderColor: '#0f3460',
  },
  battleHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  typeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  typeText: { fontWeight: 'bold', fontSize: 11 },
  coinText: { color: '#ffd700', fontSize: 13, fontWeight: 'bold' },
  battleQuestion: { color: '#fff', fontSize: 15, fontWeight: 'bold', marginBottom: 12, lineHeight: 22 },
  optionsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
  optionA: { flex: 1, backgroundColor: '#0f3460', padding: 10, borderRadius: 10 },
  optionB: { flex: 1, backgroundColor: '#e9456022', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#e94560' },
  optionText: { color: '#fff', fontSize: 12, textAlign: 'center' },
  vsText: { color: '#ff6b35', fontWeight: 'bold', fontSize: 13 },
  battleFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  footerText: { color: '#666', fontSize: 12 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#888', fontSize: 16 },
  emptyText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  emptySubText: { color: '#888', fontSize: 14, marginTop: 8 },
});
