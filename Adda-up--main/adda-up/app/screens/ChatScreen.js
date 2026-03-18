import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, StatusBar, FlatList,
  TouchableOpacity, TextInput, Modal, Alert
} from 'react-native';
import { db, auth } from '../firebase/config';
import {
  collection, query, orderBy, onSnapshot,
  doc, getDoc, addDoc, setDoc, getDocs,
  serverTimestamp, where, limit
} from 'firebase/firestore';

const getDMId = (uid1, uid2) => [uid1, uid2].sort().join('_');

export default function ChatScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('dm');
  const [conversations, setConversations] = useState([]);
  const [groups, setGroups] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState({});
  const [searchModal, setSearchModal] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [groupModal, setGroupModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [loading, setLoading] = useState(true);
  const myUid = auth.currentUser?.uid;

  useEffect(() => {
    setOnlinePresence();
    const unsubOnline = listenOnlineUsers();
    const unsubDMs = listenConversations();
    const unsubGroups = listenGroups();
    return () => {
      unsubOnline?.();
      unsubDMs?.();
      unsubGroups?.();
    };
  }, []);

  const setOnlinePresence = async () => {
    try {
      await setDoc(doc(db, 'presence', myUid), {
        uid: myUid, online: true, lastSeen: serverTimestamp()
      }, { merge: true });
    } catch (e) {}
  };

  const listenOnlineUsers = () => {
    return onSnapshot(collection(db, 'presence'), (snap) => {
      const map = {};
      snap.docs.forEach(d => { map[d.id] = d.data().online === true; });
      setOnlineUsers(map);
    });
  };

  const listenConversations = () => {
    const q = query(
      collection(db, 'conversations'),
      where('members', 'array-contains', myUid),
      orderBy('updatedAt', 'desc')
    );
    return onSnapshot(q, async (snap) => {
      const list = [];
      for (const d of snap.docs) {
        const data = d.data();
        const otherUid = data.members?.find(m => m !== myUid);
        if (otherUid) {
          const userDoc = await getDoc(doc(db, 'users', otherUid));
          if (userDoc.exists()) {
            list.push({
              id: d.id,
              uid: otherUid,
              name: userDoc.data().username,
              profilePic: userDoc.data().profilePic,
              lastMessage: data.lastMessage || '',
              updatedAt: data.updatedAt,
              unread: data.unreadCount?.[myUid] || 0,
            });
          }
        }
      }
      setConversations(list);
      setLoading(false);
    });
  };

  const listenGroups = () => {
    const q = query(
      collection(db, 'groups'),
      where('members', 'array-contains', myUid),
      orderBy('updatedAt', 'desc')
    );
    return onSnapshot(q, (snap) => {
      setGroups(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  };

  const searchUsers = async (text) => {
    if (!text.trim()) { setSearchResults([]); return; }
    try {
      const q = query(
        collection(db, 'users'),
        where('username', '>=', text),
        where('username', '<=', text + '\uf8ff'),
        limit(10)
      );
      const snap = await getDocs(q);
      setSearchResults(
        snap.docs
          .map(d => ({ uid: d.id, ...d.data() }))
          .filter(u => u.uid !== myUid)
      );
    } catch (e) {}
  };

  const startChat = async (user) => {
    const dmId = getDMId(myUid, user.uid);
    try {
      await setDoc(doc(db, 'conversations', dmId), {
        members: [myUid, user.uid],
        lastMessage: '',
        updatedAt: serverTimestamp(),
        unreadCount: { [myUid]: 0, [user.uid]: 0 },
      }, { merge: true });
    } catch (e) {}
    setSearchModal(false);
    setSearchText('');
    setSearchResults([]);
    navigation.navigate('DM', { otherUid: user.uid, otherName: user.username });
  };

  const createGroup = async () => {
    if (!groupName.trim()) {
      Alert.alert('Arre!', 'Group ka naam toh daalo!');
      return;
    }
    try {
      await addDoc(collection(db, 'groups'), {
        name: groupName.trim(),
        members: [myUid],
        createdBy: myUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastMessage: '',
      });
      Alert.alert('✅', `"${groupName}" group ban gaya!`);
      setGroupModal(false);
      setGroupName('');
    } catch (e) {
      Alert.alert('Error', 'Group nahi bana, dobara try karo!');
    }
  };

  const renderDMItem = ({ item }) => (
    <TouchableOpacity
      style={styles.chatItem}
      onPress={() => navigation.navigate('DM', { otherUid: item.uid, otherName: item.name })}
      activeOpacity={0.8}
    >
      <View style={styles.avatarWrapper}>
        <View style={styles.chatAvatar}>
          <Text style={styles.chatAvatarText}>{item.name?.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={[styles.onlineDot, { backgroundColor: onlineUsers[item.uid] ? '#4caf50' : '#555' }]} />
      </View>
      <View style={styles.chatInfo}>
        <View style={styles.chatTopRow}>
          <Text style={styles.chatName}>{item.name}</Text>
          <Text style={[styles.onlineStatus, { color: onlineUsers[item.uid] ? '#4caf50' : '#555' }]}>
            {onlineUsers[item.uid] ? '● Online' : '● Offline'}
          </Text>
        </View>
        <Text style={styles.chatLastMsg} numberOfLines={1}>
          {item.lastMessage || 'Baat shuru karo! 👋'}
        </Text>
      </View>
      {item.unread > 0 && (
        <View style={styles.unreadBadge}>
          <Text style={styles.unreadText}>{item.unread}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const renderGroupItem = ({ item }) => (
    <TouchableOpacity
      style={styles.chatItem}
      onPress={() => navigation.navigate('GroupChat', { groupId: item.id, groupName: item.name })}
      activeOpacity={0.8}
    >
      <View style={styles.chatAvatar}>
        <Text style={{ fontSize: 22 }}>👥</Text>
      </View>
      <View style={styles.chatInfo}>
        <Text style={styles.chatName}>{item.name}</Text>
        <Text style={styles.chatLastMsg} numberOfLines={1}>
          {item.lastMessage || 'Group mein kuch bolo!'}
        </Text>
      </View>
      <Text style={styles.memberCount}>{item.members?.length || 0} members</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#16213e" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>💬 Baatein</Text>
          <Text style={styles.onlineCountText}>
            {Object.values(onlineUsers).filter(Boolean).length} log online hain
          </Text>
        </View>
        <TouchableOpacity style={styles.searchBtn} onPress={() => setSearchModal(true)}>
          <Text style={styles.searchBtnText}>🔍 Search</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'dm' && styles.tabActive]}
          onPress={() => setActiveTab('dm')}
        >
          <Text style={[styles.tabText, activeTab === 'dm' && styles.tabTextActive]}>💬 DM</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'groups' && styles.tabActive]}
          onPress={() => setActiveTab('groups')}
        >
          <Text style={[styles.tabText, activeTab === 'groups' && styles.tabTextActive]}>👥 Groups</Text>
        </TouchableOpacity>
      </View>

      {/* DM List */}
      {activeTab === 'dm' && (
        conversations.length === 0
          ? <View style={styles.center}>
            <Text style={styles.emptyEmoji}>💬</Text>
            <Text style={styles.emptyText}>Koi baat nahi hui abhi!</Text>
            <Text style={styles.emptySub}>Search karo aur pehli baat shuru karo 👆</Text>
          </View>
          : <FlatList
            data={conversations}
            renderItem={renderDMItem}
            keyExtractor={item => item.id}
            contentContainerStyle={{ padding: 12 }}
          />
      )}

      {/* Groups List */}
      {activeTab === 'groups' && (
        <View style={{ flex: 1 }}>
          {groups.length === 0
            ? <View style={styles.center}>
              <Text style={styles.emptyEmoji}>👥</Text>
              <Text style={styles.emptyText}>Koi group nahi hai!</Text>
            </View>
            : <FlatList
              data={groups}
              renderItem={renderGroupItem}
              keyExtractor={item => item.id}
              contentContainerStyle={{ padding: 12 }}
            />
          }
          <TouchableOpacity style={styles.createGroupBtn} onPress={() => setGroupModal(true)}>
            <Text style={styles.createGroupBtnText}>👥 Naya Group Banao</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Search Modal */}
      <Modal visible={searchModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>🔍 User Dhundo</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Username likho..."
              placeholderTextColor="#666"
              value={searchText}
              onChangeText={(t) => { setSearchText(t); searchUsers(t); }}
              autoFocus
            />
            <FlatList
              data={searchResults}
              keyExtractor={item => item.uid}
              style={{ maxHeight: 300 }}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.searchResultItem} onPress={() => startChat(item)}>
                  <View style={styles.searchAvatar}>
                    <Text style={styles.searchAvatarText}>{item.username?.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.searchName}>{item.username}</Text>
                    <Text style={styles.searchSub}>Tap karo baat karne ke liye 💬</Text>
                  </View>
                  <View style={[styles.smallDot, { backgroundColor: onlineUsers[item.uid] ? '#4caf50' : '#555' }]} />
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                searchText.length > 0
                  ? <Text style={styles.noResult}>Koi nahi mila '{searchText}'</Text>
                  : null
              }
            />
            <TouchableOpacity style={styles.closeBtn} onPress={() => { setSearchModal(false); setSearchText(''); setSearchResults([]); }}>
              <Text style={styles.closeBtnText}>Bandh Karo</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Create Group Modal */}
      <Modal visible={groupModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>👥 Naya Group</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Group ka naam daalo..."
              placeholderTextColor="#666"
              value={groupName}
              onChangeText={setGroupName}
              autoFocus
            />
            <TouchableOpacity style={styles.createBtn} onPress={createGroup}>
              <Text style={styles.createBtnText}>Group Banao ✅</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setGroupModal(false)}>
              <Text style={styles.closeBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#ff6b35' },
  onlineCountText: { color: '#4caf50', fontSize: 12, marginTop: 2 },
  searchBtn: {
    backgroundColor: '#0f3460', paddingHorizontal: 14,
    paddingVertical: 8, borderRadius: 20,
  },
  searchBtnText: { color: '#fff', fontSize: 13 },
  tabRow: {
    flexDirection: 'row', backgroundColor: '#16213e',
    borderBottomWidth: 1, borderBottomColor: '#0f3460',
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 13 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#ff6b35' },
  tabText: { color: '#666', fontWeight: '600', fontSize: 14 },
  tabTextActive: { color: '#ff6b35' },
  chatItem: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#16213e', borderRadius: 14,
    padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: '#0f3460',
  },
  avatarWrapper: { position: 'relative', marginRight: 12 },
  chatAvatar: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: '#ff6b3533', justifyContent: 'center',
    alignItems: 'center', borderWidth: 2, borderColor: '#ff6b35',
  },
  chatAvatarText: { color: '#ff6b35', fontWeight: 'bold', fontSize: 20 },
  onlineDot: {
    position: 'absolute', bottom: 1, right: 1,
    width: 13, height: 13, borderRadius: 7,
    borderWidth: 2, borderColor: '#1a1a2e',
  },
  chatInfo: { flex: 1 },
  chatTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chatName: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  onlineStatus: { fontSize: 11 },
  chatLastMsg: { color: '#888', fontSize: 13, marginTop: 3 },
  unreadBadge: {
    backgroundColor: '#ff6b35', borderRadius: 10,
    minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 5,
  },
  unreadText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  memberCount: { color: '#888', fontSize: 11 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyEmoji: { fontSize: 50, marginBottom: 12 },
  emptyText: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
  emptySub: { color: '#888', fontSize: 13, marginTop: 8 },
  createGroupBtn: {
    margin: 16, backgroundColor: '#9c27b0', borderRadius: 14,
    padding: 16, alignItems: 'center',
  },
  createGroupBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: '#000000cc', justifyContent: 'flex-end' },
  modalBox: {
    backgroundColor: '#16213e', borderTopLeftRadius: 24,
    borderTopRightRadius: 24, padding: 24,
  },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
  searchInput: {
    backgroundColor: '#0f3460', color: '#fff', borderRadius: 12,
    padding: 14, fontSize: 15, marginBottom: 12,
  },
  searchResultItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 1, borderColor: '#0f3460', gap: 12,
  },
  searchAvatar: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: '#ff6b3533', justifyContent: 'center', alignItems: 'center',
  },
  searchAvatarText: { color: '#ff6b35', fontWeight: 'bold', fontSize: 18 },
  searchName: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  searchSub: { color: '#666', fontSize: 12 },
  smallDot: { width: 10, height: 10, borderRadius: 5 },
  noResult: { color: '#888', textAlign: 'center', padding: 16 },
  createBtn: {
    backgroundColor: '#9c27b0', borderRadius: 12,
    padding: 14, alignItems: 'center', marginBottom: 10,
  },
  createBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  closeBtn: {
    backgroundColor: '#0f3460', borderRadius: 12,
    padding: 14, alignItems: 'center',
  },
  closeBtnText: { color: '#888', fontWeight: 'bold' },
});
