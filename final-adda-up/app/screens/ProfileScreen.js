import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  StatusBar, ScrollView, TextInput, Alert,
  Image, FlatList, Modal, ActivityIndicator
} from 'react-native';
import { db, auth } from '../firebase/config';
import {
  doc, onSnapshot, updateDoc, addDoc, serverTimestamp,
  collection, query, where, getDocs, getDoc
} from 'firebase/firestore';
import { logoutUser } from '../firebase/auth';
import * as ImagePicker from 'expo-image-picker';

const CLOUD_NAME = 'dhqnhhuob';
const UPLOAD_PRESET = 'adda_up_preset';

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

const getRank = (coins) => {
  let rank = RANKS[0];
  for (const r of RANKS) { if (coins >= r.min) rank = r; }
  return rank;
};

const uploadToCloudinary = async (uri) => {
  const formData = new FormData();
  formData.append('file', { uri, type: 'image/jpeg', name: 'photo.jpg' });
  formData.append('upload_preset', UPLOAD_PRESET);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: 'POST', body: formData });
  const data = await res.json();
  return data.secure_url;
};

export default function ProfileScreen({ navigation, route }) {
  const [userData, setUserData] = useState(null);
  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('battles');
  const [userBattles, setUserBattles] = useState([]);
  const [followersList, setFollowersList] = useState([]);
  const [followingList, setFollowingList] = useState([]);
  const [uploadingDP, setUploadingDP] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showFollowModal, setShowFollowModal] = useState(false);
  const [followModalType, setFollowModalType] = useState('followers');
  const [leaderPos, setLeaderPos] = useState(null);
  const [settingsModal, setSettingsModal] = useState(false);

  const viewingUid = route?.params?.uid || auth.currentUser?.uid;
  const isOwnProfile = viewingUid === auth.currentUser?.uid;

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'users', viewingUid), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setUserData(data);
        setBio(data.bio || '');
        setUsername(data.username || '');
      }
      setLoading(false);
    });
    fetchBattles();
    fetchLeaderPos();
    return () => unsub();
  }, [viewingUid]);

  const fetchBattles = async () => {
    try {
      const q = query(collection(db, 'battles'), where('createdByUid', '==', viewingUid));
      const snap = await getDocs(q);
      setUserBattles(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {}
  };

  const fetchLeaderPos = async () => {
    try {
      const snap = await getDocs(collection(db, 'users'));
      const sorted = snap.docs.map(d => ({ uid: d.id, coins: d.data().coins || 0 })).sort((a, b) => b.coins - a.coins);
      const pos = sorted.findIndex(u => u.uid === viewingUid);
      if (pos !== -1) setLeaderPos(pos + 1);
    } catch (e) {}
  };

  const fetchFollowDetails = async (type) => {
    const ids = type === 'followers' ? (userData?.followers || []) : (userData?.following || []);
    const list = [];
    for (const uid of ids.slice(0, 30)) {
      const d = await getDoc(doc(db, 'users', uid));
      if (d.exists()) list.push({ uid: d.id, ...d.data() });
    }
    type === 'followers' ? setFollowersList(list) : setFollowingList(list);
  };

  const openFollowModal = async (type) => {
    setFollowModalType(type);
    setShowFollowModal(true);
    await fetchFollowDetails(type);
  };

  const pickDP = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission chahiye', 'Gallery access do!'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.7,
    });
    if (!result.canceled) {
      setUploadingDP(true);
      try {
        const url = await uploadToCloudinary(result.assets[0].uri);
        await updateDoc(doc(db, 'users', auth.currentUser.uid), { profilePic: url });
        Alert.alert('✅', 'DP update ho gayi!');
      } catch (e) { Alert.alert('Error', 'Upload nahi hua, dobara try karo!'); }
      setUploadingDP(false);
    }
  };

  const pickPhoto = async () => {
    if ((userData?.photos || []).length >= 5) { Alert.alert('Limit!', 'Maximum 5 photos hi upload kar sakte ho!'); return; }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, quality: 0.7,
    });
    if (!result.canceled) {
      setUploadingPhoto(true);
      try {
        const url = await uploadToCloudinary(result.assets[0].uri);
        const newPhotos = [...(userData?.photos || []), url];
        await updateDoc(doc(db, 'users', auth.currentUser.uid), { photos: newPhotos });
        Alert.alert('✅', 'Photo upload ho gayi!');
      } catch (e) { Alert.alert('Error', 'Upload nahi hua!'); }
      setUploadingPhoto(false);
    }
  };

  const deletePhoto = async (url) => {
    Alert.alert('Delete?', 'Ye photo delete karni hai?', [
      { text: 'Nahi', style: 'cancel' },
      { text: 'Haan', style: 'destructive', onPress: async () => {
        const newPhotos = (userData?.photos || []).filter(p => p !== url);
        await updateDoc(doc(db, 'users', auth.currentUser.uid), { photos: newPhotos });
      }}
    ]);
  };

  const handleFollow = async () => {
    try {
      const currentUid = auth.currentUser.uid;
      const targetRef = doc(db, 'users', viewingUid);
      const currentRef = doc(db, 'users', currentUid);
      const targetDoc = await getDoc(targetRef);
      const currentDoc = await getDoc(currentRef);
      const targetFollowers = targetDoc.data().followers || [];
      const currentFollowing = currentDoc.data().following || [];
      const isFollowing = targetFollowers.includes(currentUid);
      if (isFollowing) {
        await updateDoc(targetRef, { followers: targetFollowers.filter(id => id !== currentUid) });
        await updateDoc(currentRef, { following: currentFollowing.filter(id => id !== viewingUid) });
      } else {
        await updateDoc(targetRef, { followers: [...targetFollowers, currentUid] });
        await updateDoc(currentRef, { following: [...currentFollowing, viewingUid] });
        // Send notification
        try {
          const myDoc = await getDoc(doc(db, 'users', currentUid));
          const myName = myDoc.data()?.username || 'Kisi ne';
          await addDoc(collection(db, 'notifications'), {
            toUid: viewingUid, fromUid: currentUid, fromName: myName,
            type: 'follow',
            message: `${myName} ne tumhe follow kiya! 👤`,
            read: false, createdAt: serverTimestamp(),
          });
        } catch(e) {}
      }
    } catch (e) {}
  };

  const handleSave = async () => {
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), { bio, username });
      Alert.alert('Done!', 'Profile update ho gaya! ✅');
      setEditing(false);
    } catch (e) { Alert.alert('Error!', 'Update nahi hua, dobara try karo!'); }
  };

  if (loading) return (
    <View style={styles.center}><ActivityIndicator color="#ff6b35" size="large" /></View>
  );

  const rank = getRank(userData?.coins || 0);
  const battlesWon = userData?.battlesWon || 0;
  const battlesLost = userData?.battlesLost || 0;
  const battlesCreated = userBattles.length;
  const currentFollowers = userData?.followers || [];
  const currentFollowing = userData?.following || [];

  return (
    <View style={{ flex: 1, backgroundColor: '#1a1a2e' }}>
      <StatusBar barStyle="light-content" backgroundColor="#16213e" />

      <Modal visible={settingsModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>⚙️ Settings</Text>
            <TouchableOpacity style={styles.settingItem} onPress={() => { setSettingsModal(false); setEditing(true); }}>
              <Text style={styles.settingText}>✏️ Profile Edit Karo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.settingItem} onPress={() => { setSettingsModal(false); pickDP(); }}>
              <Text style={styles.settingText}>📸 DP Change Karo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.settingItem} onPress={() => { setSettingsModal(false); navigation.navigate('Notifications'); }}>
              <Text style={styles.settingText}>🔔 Notifications</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.settingItem, { borderColor: '#e9456040' }]}
              onPress={async () => { setSettingsModal(false); await logoutUser(); }}>
              <Text style={[styles.settingText, { color: '#e94560' }]}>🚪 Logout</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setSettingsModal(false)}>
              <Text style={styles.modalCloseBtnText}>Bandh Karo</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showFollowModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { maxHeight: '70%' }]}>
            <Text style={styles.modalTitle}>
              {followModalType === 'followers' ? '👥 Followers' : '➡️ Following'}
            </Text>
            <FlatList
              data={followModalType === 'followers' ? followersList : followingList}
              keyExtractor={item => item.uid}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.followUserRow}
                  onPress={() => { setShowFollowModal(false); navigation.push('Profile', { uid: item.uid }); }}>
                  {item.profilePic
                    ? <Image source={{ uri: item.profilePic }} style={styles.followAvatar} />
                    : <View style={[styles.followAvatar, styles.followAvatarDefault]}>
                        <Text style={styles.followAvatarText}>{item.username?.charAt(0).toUpperCase()}</Text>
                      </View>
                  }
                  <View style={{ flex: 1 }}>
                    <Text style={styles.followUsername}>{item.username}</Text>
                    <Text style={[styles.followRank, { color: getRank(item.coins || 0).color }]}>
                      {getRank(item.coins || 0).emoji} {getRank(item.coins || 0).name}
                    </Text>
                  </View>
                  <Text style={styles.followArrow}>→</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={{ color: '#888', textAlign: 'center', padding: 20 }}>Koi nahi hai abhi</Text>}
            />
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowFollowModal(false)}>
              <Text style={styles.modalCloseBtnText}>Bandh Karo</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ScrollView>
        <View style={styles.header}>
          {isOwnProfile && (
            <TouchableOpacity style={styles.settingsBtn} onPress={() => setSettingsModal(true)}>
              <Text style={styles.settingsIcon}>⚙️</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={isOwnProfile ? pickDP : null} disabled={uploadingDP}>
            <View style={styles.avatarWrapper}>
              {userData?.profilePic
                ? <Image source={{ uri: userData.profilePic }} style={styles.avatarImg} />
                : <View style={styles.avatarCircle}>
                    <Text style={styles.avatarText}>{userData?.username?.charAt(0).toUpperCase() || '?'}</Text>
                  </View>
              }
              {isOwnProfile && (
                <View style={styles.cameraIcon}>
                  <Text style={{ fontSize: 14 }}>{uploadingDP ? '⏳' : '📷'}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>

          {editing ? (
            <View style={styles.editForm}>
              <TextInput style={styles.input} value={username} onChangeText={setUsername}
                placeholder="Username" placeholderTextColor="#888" />
              <TextInput style={[styles.input, { height: 70, textAlignVertical: 'top' }]}
                value={bio} onChangeText={setBio} placeholder="Bio likho..." placeholderTextColor="#888" multiline />
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                <Text style={styles.saveBtnText}>Save Karo ✅</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setEditing(false)}>
                <Text style={{ color: '#888', textAlign: 'center', marginTop: 8 }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ alignItems: 'center' }}>
              <Text style={styles.username}>{userData?.username}</Text>
              <Text style={[styles.rankText, { color: rank.color }]}>{rank.emoji} {rank.name}</Text>
              {leaderPos && <Text style={styles.leaderPosText}>🏆 Rank #{leaderPos} in UP</Text>}
              <Text style={styles.bio}>{userData?.bio || 'Koi bio nahi — edit karo!'}</Text>
              <View style={styles.coinsRow}>
                <Text style={styles.coinText}>🪙 {userData?.coins || 0} Coins</Text>
                <Text style={styles.referralText}>Code: {userData?.referralCode}</Text>
              </View>
            </View>
          )}

          {!isOwnProfile && (
            <TouchableOpacity
              style={[styles.followBtn, currentFollowers.includes(auth.currentUser?.uid) && styles.followingBtn]}
              onPress={handleFollow}>
              <Text style={styles.followBtnText}>
                {currentFollowers.includes(auth.currentUser?.uid) ? '✅ Following' : '➕ Follow Karo'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.statsRow}>
          <TouchableOpacity style={styles.statItem} onPress={() => setActiveTab('battles')}>
            <Text style={styles.statNumber}>{battlesCreated}</Text>
            <Text style={styles.statLabel}>Battles</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.statItem} onPress={() => openFollowModal('followers')}>
            <Text style={styles.statNumber}>{currentFollowers.length}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.statItem} onPress={() => openFollowModal('following')}>
            <Text style={styles.statNumber}>{currentFollowing.length}</Text>
            <Text style={styles.statLabel}>Following</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.battleStatsRow}>
          <View style={[styles.battleStat, { borderColor: '#4caf50' }]}>
            <Text style={[styles.battleStatNum, { color: '#4caf50' }]}>{battlesWon}</Text>
            <Text style={styles.battleStatLabel}>Jeete</Text>
          </View>
          <View style={[styles.battleStat, { borderColor: '#e94560' }]}>
            <Text style={[styles.battleStatNum, { color: '#e94560' }]}>{battlesLost}</Text>
            <Text style={styles.battleStatLabel}>Hare</Text>
          </View>
          <View style={[styles.battleStat, { borderColor: '#ff6b35' }]}>
            <Text style={[styles.battleStatNum, { color: '#ff6b35' }]}>{battlesCreated}</Text>
            <Text style={styles.battleStatLabel}>Banaye</Text>
          </View>
        </View>

        <View style={styles.tabs}>
          {['battles', 'badges', 'photos'].map(tab => (
            <TouchableOpacity key={tab} style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}>
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab === 'battles' ? '⚔️ Battles' : tab === 'badges' ? '🏅 Badges' : '📸 Photos'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {activeTab === 'battles' && (
          <View style={styles.tabContent}>
            {userBattles.length === 0
              ? <Text style={styles.emptyText}>Koi battle nahi banaya abhi!</Text>
              : userBattles.map(b => (
                <View key={b.id} style={styles.battleItem}>
                  <Text style={styles.battleItemType}>
                    {b.type === 'vote' ? '🗳️' : b.type === 'prediction' ? '🔮' : '🔥'} {b.type?.toUpperCase()}
                  </Text>
                  <Text style={styles.battleItemQ} numberOfLines={2}>{b.question}</Text>
                  <Text style={styles.battleItemVotes}>🗳️ {b.totalVotes || 0} votes</Text>
                </View>
              ))
            }
          </View>
        )}

        {activeTab === 'badges' && (
          <View style={styles.tabContent}>
            <View style={styles.allRanksContainer}>
              {RANKS.map((r, i) => {
                const unlocked = (userData?.coins || 0) >= r.min;
                return (
                  <View key={i} style={[styles.rankBadge, !unlocked && styles.rankBadgeLocked, { borderColor: unlocked ? r.color : '#333' }]}>
                    <Text style={[styles.rankBadgeEmoji, !unlocked && { opacity: 0.3 }]}>{r.emoji}</Text>
                    <Text style={[styles.rankBadgeName, { color: unlocked ? r.color : '#555' }]}>{r.name}</Text>
                    <Text style={styles.rankBadgeCoins}>{r.min === 0 ? 'Start' : `${r.min}🪙`}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {activeTab === 'photos' && (
          <View style={styles.tabContent}>
            <View style={styles.photosGrid}>
              {(userData?.photos || []).map((url, i) => (
                <TouchableOpacity key={i} style={styles.photoItem} onLongPress={() => isOwnProfile && deletePhoto(url)}>
                  <Image source={{ uri: url }} style={styles.photoImg} />
                </TouchableOpacity>
              ))}
              {isOwnProfile && (userData?.photos || []).length < 5 && (
                <TouchableOpacity style={styles.addPhotoBtn} onPress={pickPhoto} disabled={uploadingPhoto}>
                  <Text style={styles.addPhotoIcon}>{uploadingPhoto ? '⏳' : '+'}</Text>
                  <Text style={styles.addPhotoText}>{(userData?.photos || []).length}/5</Text>
                </TouchableOpacity>
              )}
            </View>
            {isOwnProfile && <Text style={styles.photoHint}>Photo pe long press karo delete karne ke liye</Text>}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a2e' },
  header: { padding: 20, paddingTop: 50, alignItems: 'center', backgroundColor: '#16213e', position: 'relative' },
  settingsBtn: { position: 'absolute', top: 52, right: 16, backgroundColor: '#0f3460', borderRadius: 20, width: 38, height: 38, justifyContent: 'center', alignItems: 'center' },
  settingsIcon: { fontSize: 18 },
  avatarWrapper: { position: 'relative', marginBottom: 14 },
  avatarImg: { width: 90, height: 90, borderRadius: 45, borderWidth: 3, borderColor: '#ff6b35' },
  avatarCircle: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#ff6b35', justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#ff6b3580' },
  avatarText: { fontSize: 38, fontWeight: 'bold', color: '#fff' },
  cameraIcon: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#16213e', borderRadius: 12, padding: 3, borderWidth: 1, borderColor: '#0f3460' },
  username: { fontSize: 22, fontWeight: 'bold', color: '#fff', marginBottom: 4 },
  rankText: { fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  leaderPosText: { color: '#ffd700', fontSize: 13, marginBottom: 6 },
  bio: { color: '#888', fontSize: 13, textAlign: 'center', marginBottom: 8 },
  coinsRow: { flexDirection: 'row', gap: 16, marginTop: 4 },
  coinText: { color: '#ffd700', fontWeight: 'bold', fontSize: 13 },
  referralText: { color: '#ff6b35', fontWeight: 'bold', fontSize: 13 },
  editForm: { width: '100%', marginTop: 10 },
  input: { backgroundColor: '#0f3460', color: '#fff', borderRadius: 10, padding: 12, marginBottom: 10, fontSize: 15 },
  saveBtn: { backgroundColor: '#ff6b35', padding: 12, borderRadius: 10, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  followBtn: { marginTop: 12, backgroundColor: '#ff6b35', paddingHorizontal: 28, paddingVertical: 10, borderRadius: 20 },
  followingBtn: { backgroundColor: '#0f3460' },
  followBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  statsRow: { flexDirection: 'row', backgroundColor: '#16213e', borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#0f3460' },
  statItem: { flex: 1, alignItems: 'center', paddingVertical: 14 },
  statNumber: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  statLabel: { color: '#888', fontSize: 12, marginTop: 2 },
  battleStatsRow: { flexDirection: 'row', padding: 12, gap: 10, backgroundColor: '#1a1a2e' },
  battleStat: { flex: 1, alignItems: 'center', backgroundColor: '#16213e', borderRadius: 12, paddingVertical: 12, borderWidth: 1 },
  battleStatNum: { fontSize: 22, fontWeight: 'bold' },
  battleStatLabel: { color: '#888', fontSize: 11, marginTop: 3 },
  tabs: { flexDirection: 'row', backgroundColor: '#16213e', borderBottomWidth: 1, borderColor: '#0f3460' },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#ff6b35' },
  tabText: { color: '#666', fontSize: 12 },
  tabTextActive: { color: '#ff6b35', fontWeight: 'bold' },
  tabContent: { padding: 14 },
  battleItem: { backgroundColor: '#16213e', borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#0f3460' },
  battleItemType: { color: '#ff6b35', fontWeight: 'bold', fontSize: 11, marginBottom: 5 },
  battleItemQ: { color: '#fff', fontSize: 14, marginBottom: 6 },
  battleItemVotes: { color: '#888', fontSize: 12 },
  allRanksContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  rankBadge: { alignItems: 'center', backgroundColor: '#16213e', borderRadius: 14, padding: 14, width: '30%', borderWidth: 1.5 },
  rankBadgeLocked: { backgroundColor: '#111' },
  rankBadgeEmoji: { fontSize: 26, marginBottom: 4 },
  rankBadgeName: { fontWeight: 'bold', fontSize: 12, marginBottom: 2 },
  rankBadgeCoins: { color: '#666', fontSize: 10 },
  photosGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoItem: { width: '31%', aspectRatio: 1, borderRadius: 10, overflow: 'hidden' },
  photoImg: { width: '100%', height: '100%' },
  addPhotoBtn: { width: '31%', aspectRatio: 1, borderRadius: 10, backgroundColor: '#16213e', borderWidth: 1.5, borderColor: '#0f3460', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center' },
  addPhotoIcon: { color: '#ff6b35', fontSize: 28, fontWeight: 'bold' },
  addPhotoText: { color: '#888', fontSize: 11, marginTop: 4 },
  photoHint: { color: '#555', fontSize: 11, marginTop: 10, textAlign: 'center' },
  emptyText: { color: '#888', fontSize: 14, textAlign: 'center', paddingVertical: 20 },
  modalOverlay: { flex: 1, backgroundColor: '#000000cc', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#16213e', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
  settingItem: { padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#0f3460', marginBottom: 10 },
  settingText: { color: '#fff', fontSize: 15 },
  modalCloseBtn: { backgroundColor: '#0f3460', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 8 },
  modalCloseBtnText: { color: '#888', fontWeight: 'bold' },
  followUserRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderColor: '#0f3460', gap: 12 },
  followAvatar: { width: 44, height: 44, borderRadius: 22 },
  followAvatarDefault: { backgroundColor: '#ff6b35', justifyContent: 'center', alignItems: 'center' },
  followAvatarText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  followUsername: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  followRank: { fontSize: 12, marginTop: 2 },
  followArrow: { color: '#ff6b35', fontSize: 18 },
});
