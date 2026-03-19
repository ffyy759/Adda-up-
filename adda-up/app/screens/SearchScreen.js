import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Image,
  StyleSheet, FlatList, Animated, StatusBar
} from 'react-native';
import { db, auth } from '../firebase/config';
import { collection, query, orderBy, startAt, endAt, getDocs } from 'firebase/firestore';

const RANKS = {
  'Navagat': { color: '#888', emoji: '🌱' },
  'Khiladi': { color: '#00bcd4', emoji: '⚡' },
  'Asuya': { color: '#ff9800', emoji: '😤' },
  'Asur': { color: '#f44336', emoji: '👹' },
  'Sher': { color: '#9c27b0', emoji: '🦁' },
  'Baahubali': { color: '#ff6b35', emoji: '🏹' },
  'Nawab': { color: '#ffd700', emoji: '👑' },
  'Adda King': { color: '#ff1744', emoji: '🔱' },
};

const getRankInfo = (coins = 0) => {
  if (coins >= 99999) return RANKS['Adda King'];
  if (coins >= 15000) return RANKS['Nawab'];
  if (coins >= 10000) return RANKS['Baahubali'];
  if (coins >= 6000) return RANKS['Sher'];
  if (coins >= 3000) return RANKS['Asur'];
  if (coins >= 1500) return RANKS['Asuya'];
  if (coins >= 500) return RANKS['Khiladi'];
  return RANKS['Navagat'];
};

const UserCard = ({ item, navigation, index }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 350, delay: index * 60, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 350, delay: index * 60, useNativeDriver: true }),
    ]).start();
  }, []);
  const rankInfo = getRankInfo(item.coins);
  return (
    <Animated.View style={[styles.card, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <TouchableOpacity style={styles.cardInner}
        onPress={() => navigation.navigate('Profile', { uid: item.uid })} activeOpacity={0.7}>
        {item.profilePic
          ? <Image source={{ uri: item.profilePic }} style={[styles.avatar, { borderColor: rankInfo.color }]} />
          : <View style={[styles.avatar, { backgroundColor: rankInfo.color + '40', borderColor: rankInfo.color }]}>
              <Text style={styles.avatarText}>{item.username?.charAt(0).toUpperCase()}</Text>
            </View>
        }
        <View style={styles.userInfo}>
          <Text style={styles.username}>{item.username}</Text>
          <View style={styles.rankRow}>
            <Text style={styles.rankEmoji}>{rankInfo.emoji}</Text>
            <Text style={[styles.rankText, { color: rankInfo.color }]}>{item.rank || 'Navagat'}</Text>
          </View>
          <Text style={styles.bioText} numberOfLines={1}>{item.bio || 'Koi bio nahi'}</Text>
        </View>
        <View style={styles.rightSection}>
          <Text style={styles.coinText}>🪙 {item.coins || 0}</Text>
          <View style={styles.followerBadge}>
            <Text style={styles.followerText}>👥 {item.followers?.length || 0}</Text>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

export default function SearchScreen({ navigation }) {
  const [searchText, setSearchText] = useState('');
  const [results, setResults] = useState([]);
  const [topUsers, setTopUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef(null);
  const headerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fetchTopUsers();
    Animated.timing(headerAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  useEffect(() => {
    if (searchText.length >= 1) { searchUsers(searchText); }
    else { setResults([]); setSearched(false); }
  }, [searchText]);

  const fetchTopUsers = async () => {
    try {
      const q = query(collection(db, 'users'), orderBy('coins', 'desc'));
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .filter(u => u.uid !== auth.currentUser?.uid).slice(0, 10);
      setTopUsers(list);
    } catch (e) {}
  };

  const searchUsers = async (text) => {
    setLoading(true);
    try {
      const q = query(collection(db, 'users'), orderBy('username'),
        startAt(text.toLowerCase()), endAt(text.toLowerCase() + '\uf8ff'));
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .filter(u => u.uid !== auth.currentUser?.uid);
      setResults(list);
      setSearched(true);
    } catch (e) {}
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <Animated.View style={[styles.header, { opacity: headerAnim }]}>
        <Text style={styles.headerTitle}>🔍 Dhundho</Text>
        <Text style={styles.headerSub}>UP ke logon ko dhundho!</Text>
      </Animated.View>
      <View style={styles.searchBox}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput ref={inputRef} style={styles.searchInput}
          placeholder="Username se dhundho..." placeholderTextColor="#555"
          value={searchText} onChangeText={setSearchText} autoCapitalize="none" />
        {searchText.length > 0 && (
          <TouchableOpacity onPress={() => setSearchText('')}>
            <Text style={styles.clearBtn}>✕</Text>
          </TouchableOpacity>
        )}
      </View>
      {loading && <Text style={{ color: '#888', textAlign: 'center', padding: 8 }}>Dhundh raha hai... ⏳</Text>}
      {searched && results.length === 0 && !loading && (
        <View style={styles.noResult}>
          <Text style={styles.noResultEmoji}>😕</Text>
          <Text style={styles.noResultText}>Koi nahi mila!</Text>
        </View>
      )}
      {searchText.length === 0 && (
        <View style={styles.topSection}>
          <Text style={styles.sectionTitle}>🏆 Top Users</Text>
          <FlatList data={topUsers} keyExtractor={item => item.uid || item.id}
            renderItem={({ item, index }) => <UserCard item={item} navigation={navigation} index={index} />}
            showsVerticalScrollIndicator={false} />
        </View>
      )}
      {searchText.length > 0 && results.length > 0 && (
        <View style={styles.resultsSection}>
          <Text style={styles.sectionTitle}>{results.length} user mile 👥</Text>
          <FlatList data={results} keyExtractor={item => item.uid || item.id}
            renderItem={({ item, index }) => <UserCard item={item} navigation={navigation} index={index} />}
            showsVerticalScrollIndicator={false} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  header: { paddingTop: 50, paddingHorizontal: 20, paddingBottom: 15, backgroundColor: '#16213e' },
  headerTitle: { fontSize: 26, fontWeight: 'bold', color: '#ff6b35' },
  headerSub: { color: '#888', fontSize: 13, marginTop: 2 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#16213e', margin: 15, borderRadius: 15, paddingHorizontal: 15, borderWidth: 1, borderColor: '#0f3460' },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, color: '#fff', fontSize: 16, paddingVertical: 14 },
  clearBtn: { color: '#888', fontSize: 16, padding: 5 },
  noResult: { alignItems: 'center', marginTop: 50 },
  noResultEmoji: { fontSize: 50 },
  noResultText: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginTop: 10 },
  topSection: { flex: 1, paddingHorizontal: 15 },
  resultsSection: { flex: 1, paddingHorizontal: 15 },
  sectionTitle: { color: '#ff6b35', fontWeight: 'bold', fontSize: 15, marginBottom: 10 },
  card: { marginBottom: 10 },
  cardInner: { backgroundColor: '#16213e', borderRadius: 15, padding: 12, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#0f3460' },
  avatar: { width: 55, height: 55, borderRadius: 28, justifyContent: 'center', alignItems: 'center', borderWidth: 2, marginRight: 12 },
  avatarText: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  userInfo: { flex: 1 },
  username: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  rankRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  rankEmoji: { fontSize: 12, marginRight: 4 },
  rankText: { fontSize: 12, fontWeight: 'bold' },
  bioText: { color: '#666', fontSize: 12, marginTop: 3 },
  rightSection: { alignItems: 'flex-end' },
  coinText: { color: '#ffd700', fontSize: 12, fontWeight: 'bold' },
  followerBadge: { backgroundColor: '#0f3460', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, marginTop: 5 },
  followerText: { color: '#888', fontSize: 11 },
});
