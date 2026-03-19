import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, FlatList, StyleSheet, StatusBar,
  TouchableOpacity, Animated, Image
} from 'react-native';
import { db, auth } from '../firebase/config';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';

const RANKS = [
  { name: 'Navagat', emoji: '🌱', min: 0, color: '#888' },
  { name: 'Khiladi', emoji: '⚡', min: 500, color: '#00bcd4' },
  { name: 'Asuya', emoji: '😤', min: 1500, color: '#ff9800' },
  { name: 'Asur', emoji: '👹', min: 3000, color: '#f44336' },
  { name: 'Sher', emoji: '🦁', min: 6000, color: '#9c27b0' },
  { name: 'Baahubali', emoji: '🏹', min: 10000, color: '#ff6b35' },
  { name: 'Nawab', emoji: '👑', min: 15000, color: '#ffd700' },
  { name: 'Adda King', emoji: '🔱', min: 99999, color: '#ff1744' },
];

const getRankForCoins = (coins = 0) => {
  let rank = RANKS[0];
  for (const r of RANKS) { if (coins >= r.min) rank = r; }
  return rank;
};

const TopThreeCard = ({ user, position, anim }) => {
  if (!user) return <View style={{ flex: 1 }} />;
  const rank = getRankForCoins(user.coins || 0);
  const size = position === 1 ? 72 : 58;
  const colors = { 1: '#ffd700', 2: '#c0c0c0', 3: '#cd7f32' };
  const posEmoji = ['🥇', '🥈', '🥉'][position - 1];
  return (
    <Animated.View style={[styles.topCard, { transform: [{ scale: anim }], opacity: anim }]}>
      <Text style={styles.topPosition}>{posEmoji}</Text>
      {user.profilePic
        ? <Image source={{ uri: user.profilePic }} style={[styles.topAvatar, { width: size, height: size, borderRadius: size/2, borderColor: colors[position] }]} />
        : <View style={[styles.topAvatar, { width: size, height: size, borderRadius: size/2, borderColor: colors[position], backgroundColor: '#0f3460', justifyContent: 'center', alignItems: 'center' }]}>
            <Text style={[styles.topAvatarText, { fontSize: size * 0.4 }]}>{user?.username?.charAt(0).toUpperCase()}</Text>
          </View>
      }
      <Text style={styles.topUsername} numberOfLines={1}>{user?.username}</Text>
      <Text style={[styles.topRank, { color: rank.color }]}>{rank.emoji} {rank.name}</Text>
      <Text style={styles.topCoins}>🪙 {user?.coins}</Text>
    </Animated.View>
  );
};

const LeaderRow = ({ user, position, isMe, index }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, delay: index * 60, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 50, friction: 8, delay: index * 60, useNativeDriver: true }),
    ]).start();
  }, []);
  const rank = getRankForCoins(user?.coins || 0);
  return (
    <Animated.View style={[styles.leaderRow, isMe && styles.leaderRowMe, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <Text style={[styles.leaderPos, position <= 3 && { color: '#ffd700' }]}>
        {position <= 3 ? ['🥇', '🥈', '🥉'][position - 1] : `#${position}`}
      </Text>
      {user?.profilePic
        ? <Image source={{ uri: user.profilePic }} style={[styles.leaderAvatar, { borderColor: rank.color }]} />
        : <View style={[styles.leaderAvatar, { borderColor: rank.color }]}>
            <Text style={styles.leaderAvatarText}>{user?.username?.charAt(0).toUpperCase()}</Text>
          </View>
      }
      <View style={styles.leaderInfo}>
        <View style={styles.leaderNameRow}>
          <Text style={styles.leaderName}>{user?.username}</Text>
          {isMe && <View style={styles.meBadge}><Text style={styles.meBadgeText}>TUM</Text></View>}
        </View>
        <Text style={[styles.leaderRank, { color: rank.color }]}>{rank.emoji} {rank.name}</Text>
      </View>
      <View style={styles.leaderRight}>
        <Text style={styles.leaderCoins}>🪙 {user?.coins}</Text>
        {user?.badges?.length > 0 && <Text style={styles.leaderBadge}>{user.badges[user.badges.length - 1]}</Text>}
      </View>
    </Animated.View>
  );
};

export default function LeaderboardScreen() {
  const [users, setUsers] = useState([]);
  const [myData, setMyData] = useState(null);
  const [myPosition, setMyPosition] = useState(null);
  const [loading, setLoading] = useState(true);
  const headerAnim = useRef(new Animated.Value(0)).current;
  const top1Anim = useRef(new Animated.Value(0)).current;
  const top2Anim = useRef(new Animated.Value(0)).current;
  const top3Anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fetchLeaderboard();
    Animated.timing(headerAnim, { toValue: 1, duration: 700, useNativeDriver: true }).start();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      const q = query(collection(db, 'users'), orderBy('coins', 'desc'));
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setUsers(list);
      const myIndex = list.findIndex(u => u.uid === auth.currentUser?.uid);
      if (myIndex !== -1) { setMyData(list[myIndex]); setMyPosition(myIndex + 1); }
      Animated.stagger(200, [
        Animated.spring(top2Anim, { toValue: 1, tension: 50, friction: 6, useNativeDriver: true }),
        Animated.spring(top1Anim, { toValue: 1, tension: 50, friction: 6, useNativeDriver: true }),
        Animated.spring(top3Anim, { toValue: 1, tension: 50, friction: 6, useNativeDriver: true }),
      ]).start();
    } catch (e) {}
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <Animated.View style={[styles.header, { opacity: headerAnim }]}>
        <Text style={styles.headerTitle}>🏆 Leaderboard</Text>
        <Text style={styles.headerSub}>UP ka Sabse Bada Adda King kaun?</Text>
      </Animated.View>

      {myData && (
        <View style={styles.myRankBar}>
          <Text style={styles.myRankText}>Teri Rank: #{myPosition}</Text>
          <Text style={styles.myCoinsText}>🪙 {myData.coins} coins</Text>
          <Text style={[styles.myRankBadge, { color: getRankForCoins(myData.coins).color }]}>
            {getRankForCoins(myData.coins).emoji} {getRankForCoins(myData.coins).name}
          </Text>
        </View>
      )}

      {users.length >= 3 && (
        <View style={styles.topThree}>
          <TopThreeCard user={users[1]} position={2} anim={top2Anim} />
          <TopThreeCard user={users[0]} position={1} anim={top1Anim} />
          <TopThreeCard user={users[2]} position={3} anim={top3Anim} />
        </View>
      )}

      {loading ? (
        <View style={styles.center}><Text style={styles.loadingText}>Load ho raha hai... ⏳</Text></View>
      ) : (
        <FlatList
          data={users.slice(3)}
          keyExtractor={item => item.uid || item.id}
          renderItem={({ item, index }) => (
            <LeaderRow user={item} position={index + 4}
              isMe={item.uid === auth.currentUser?.uid} index={index} />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  header: { paddingTop: 50, paddingHorizontal: 20, paddingBottom: 15, backgroundColor: '#16213e' },
  headerTitle: { fontSize: 26, fontWeight: 'bold', color: '#ffd700' },
  headerSub: { color: '#888', fontSize: 13, marginTop: 2 },
  myRankBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#ff6b3520', paddingHorizontal: 20, paddingVertical: 10, borderBottomWidth: 1, borderColor: '#ff6b3540' },
  myRankText: { color: '#ff6b35', fontWeight: 'bold', fontSize: 14 },
  myCoinsText: { color: '#ffd700', fontWeight: 'bold', fontSize: 14 },
  myRankBadge: { fontWeight: 'bold', fontSize: 13 },
  topThree: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', paddingVertical: 20, paddingHorizontal: 10, backgroundColor: '#16213e', borderBottomWidth: 1, borderColor: '#0f3460' },
  topCard: { alignItems: 'center', flex: 1, paddingBottom: 5 },
  topAvatar: { borderWidth: 3, marginBottom: 8 },
  topAvatarText: { fontWeight: 'bold', color: '#fff' },
  topPosition: { fontSize: 13, fontWeight: 'bold', color: '#ffd700', marginBottom: 3 },
  topUsername: { color: '#fff', fontWeight: 'bold', fontSize: 13, textAlign: 'center' },
  topRank: { fontSize: 11, fontWeight: 'bold', marginTop: 2 },
  topCoins: { color: '#ffd700', fontSize: 12, marginTop: 3 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#888' },
  list: { padding: 15 },
  leaderRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#16213e', borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#0f3460' },
  leaderRowMe: { borderColor: '#ff6b35', backgroundColor: '#ff6b3510' },
  leaderPos: { color: '#888', fontWeight: 'bold', fontSize: 14, width: 35, textAlign: 'center' },
  leaderAvatar: { width: 45, height: 45, borderRadius: 23, backgroundColor: '#0f3460', justifyContent: 'center', alignItems: 'center', borderWidth: 2, marginRight: 12 },
  leaderAvatarText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  leaderInfo: { flex: 1 },
  leaderNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  leaderName: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  meBadge: { backgroundColor: '#ff6b35', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  meBadgeText: { color: '#fff', fontSize: 9, fontWeight: 'bold' },
  leaderRank: { fontSize: 12, marginTop: 3 },
  leaderRight: { alignItems: 'flex-end' },
  leaderCoins: { color: '#ffd700', fontWeight: 'bold', fontSize: 13 },
  leaderBadge: { fontSize: 16, marginTop: 3 },
});
