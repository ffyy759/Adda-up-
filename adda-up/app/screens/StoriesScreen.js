import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  StatusBar, FlatList, TextInput, Alert,
  Modal, Animated, Dimensions
} from 'react-native';
import { db, auth } from '../firebase/config';
import {
  collection, query, orderBy, getDocs, addDoc,
  serverTimestamp, where, doc, getDoc
} from 'firebase/firestore';

const { width: SW } = Dimensions.get('window');
const STORY_COLORS = [
  '#ff6b35', '#00bcd4', '#9c27b0', '#f44336',
  '#4caf50', '#ffd700', '#ff4081', '#00e5ff',
];

export default function StoriesScreen({ navigation }) {
  const [stories, setStories] = useState([]);
  const [myStory, setMyStory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [addModal, setAddModal] = useState(false);
  const [viewModal, setViewModal] = useState(false);
  const [storyText, setStoryText] = useState('');
  const [selectedColor, setSelectedColor] = useState('#ff6b35');
  const [viewingStory, setViewingStory] = useState(null);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const progressTimer = useRef(null);

  useEffect(() => { fetchStories(); }, []);

  const fetchStories = async () => {
    try {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const q = query(
        collection(db, 'stories'),
        where('expiresAt', '>', since.toISOString()),
        orderBy('expiresAt', 'desc')
      );
      const snap = await getDocs(q);
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const me = all.find(s => s.uid === auth.currentUser.uid);
      setMyStory(me || null);
      setStories(all.filter(s => s.uid !== auth.currentUser.uid));
    } catch (e) {}
    setLoading(false);
  };

  const postStory = async () => {
    if (!storyText.trim()) {
      Alert.alert('Arre!', 'Kuch likho toh!');
      return;
    }
    if (storyText.length > 200) {
      Alert.alert('Zyada!', '200 characters se zyada mat likho!');
      return;
    }
    try {
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      const userData = userDoc.data();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      await addDoc(collection(db, 'stories'), {
        uid: auth.currentUser.uid,
        username: userData.username,
        text: storyText.trim(),
        color: selectedColor,
        createdAt: serverTimestamp(),
        expiresAt,
        views: [],
      });
      Alert.alert('Ho gaya!', 'Story post ho gayi! 24 ghante tak rahegi 🎉');
      setAddModal(false);
      setStoryText('');
      fetchStories();
    } catch (e) {
      Alert.alert('Error', 'Story post nahi hui. Try karo!');
    }
  };

  const openStory = (story) => {
    setViewingStory(story);
    setViewModal(true);
    progressAnim.setValue(0);
    progressTimer.current = Animated.timing(progressAnim, {
      toValue: 1, duration: 5000, useNativeDriver: false,
    });
    progressTimer.current.start(({ finished }) => {
      if (finished) setViewModal(false);
    });
  };

  const closeStory = () => {
    progressTimer.current?.stop();
    setViewModal(false);
  };

  const getTimeLeft = (expiresAt) => {
    const left = new Date(expiresAt) - Date.now();
    const hrs = Math.floor(left / 3600000);
    return hrs > 0 ? `${hrs}h bachi` : 'Khatam hone wali';
  };

  const renderStoryItem = ({ item }) => (
    <TouchableOpacity style={styles.storyItem} onPress={() => openStory(item)}>
      <View style={[styles.storyRing, { borderColor: item.color || '#ff6b35' }]}>
        <View style={[styles.storyAvatar, { backgroundColor: item.color + '33' }]}>
          <Text style={[styles.storyAvatarText, { color: item.color }]}>
            {item.username?.charAt(0).toUpperCase()}
          </Text>
        </View>
      </View>
      <Text style={styles.storyUsername} numberOfLines={1}>{item.username}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#16213e" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>📸 Stories</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* My Story + Add */}
      <View style={styles.myStoryRow}>
        <TouchableOpacity
          style={styles.addStoryBtn}
          onPress={myStory ? () => openStory(myStory) : () => setAddModal(true)}
        >
          {myStory ? (
            <>
              <View style={[styles.storyRing, { borderColor: myStory.color }]}>
                <View style={[styles.storyAvatar, { backgroundColor: myStory.color + '33' }]}>
                  <Text style={[styles.storyAvatarText, { color: myStory.color }]}>
                    {myStory.username?.charAt(0).toUpperCase()}
                  </Text>
                </View>
              </View>
              <Text style={styles.myStoryLabel}>Meri Story</Text>
            </>
          ) : (
            <>
              <View style={styles.addCircle}>
                <Text style={styles.addIcon}>+</Text>
              </View>
              <Text style={styles.myStoryLabel}>Story Daalo</Text>
            </>
          )}
        </TouchableOpacity>

        <FlatList
          data={stories}
          renderItem={renderStoryItem}
          keyExtractor={item => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.storiesRow}
          ListEmptyComponent={
            !loading && (
              <View style={styles.emptyStories}>
                <Text style={styles.emptyStoriesText}>
                  Abhi kisi ne story nahi daali 😴
                </Text>
              </View>
            )
          }
        />
      </View>

      {/* All Stories Grid */}
      <Text style={styles.sectionTitle}>Sabki Stories 🔥</Text>
      {loading ? (
        <View style={styles.center}>
          <Text style={styles.loadingText}>Load ho raha hai... ⏳</Text>
        </View>
      ) : stories.length === 0 && !myStory ? (
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>📸</Text>
          <Text style={styles.emptyText}>Koi story nahi!</Text>
          <Text style={styles.emptySubText}>Pehli story tum daalo 🔥</Text>
          <TouchableOpacity style={styles.addFirstBtn} onPress={() => setAddModal(true)}>
            <Text style={styles.addFirstBtnText}>+ Story Daalo</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={stories}
          keyExtractor={item => item.id}
          numColumns={2}
          contentContainerStyle={styles.grid}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.storyCard, { borderColor: item.color }]}
              onPress={() => openStory(item)}
            >
              <View style={[styles.storyCardBg, { backgroundColor: item.color + '15' }]}>
                <Text style={[styles.storyCardText, { color: item.color }]}>
                  {item.text}
                </Text>
              </View>
              <View style={styles.storyCardFooter}>
                <Text style={styles.storyCardUser}>👤 {item.username}</Text>
                <Text style={styles.storyCardTime}>{getTimeLeft(item.expiresAt)}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      {/* Add Story Modal */}
      <Modal visible={addModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>📸 Naya Status</Text>

            <View style={[styles.previewBox, { backgroundColor: selectedColor + '22', borderColor: selectedColor }]}>
              <Text style={[styles.previewText, { color: selectedColor }]}>
                {storyText || 'Yahan dikhega...'}
              </Text>
            </View>

            <TextInput
              style={styles.storyInput}
              placeholder="Kya chal raha hai? (200 chars)"
              placeholderTextColor="#666"
              value={storyText}
              onChangeText={setStoryText}
              multiline
              maxLength={200}
            />

            <Text style={styles.colorLabel}>Rang chuno:</Text>
            <FlatList
              data={STORY_COLORS}
              horizontal
              keyExtractor={c => c}
              renderItem={({ item: c }) => (
                <TouchableOpacity
                  style={[styles.colorDot, { backgroundColor: c },
                    selectedColor === c && styles.colorDotSelected]}
                  onPress={() => setSelectedColor(c)}
                />
              )}
              contentContainerStyle={styles.colorRow}
            />

            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setAddModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.postBtn} onPress={postStory}>
                <Text style={styles.postBtnText}>Post Karo 🚀</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* View Story Modal */}
      <Modal visible={viewModal} transparent animationType="fade">
        <TouchableOpacity style={styles.storyViewOverlay} onPress={closeStory} activeOpacity={1}>
          {viewingStory && (
            <View style={styles.storyViewBox}>
              <View style={styles.storyProgressBar}>
                <Animated.View
                  style={[styles.storyProgress, {
                    width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                    backgroundColor: viewingStory.color,
                  }]}
                />
              </View>
              <Text style={styles.storyViewUser}>👤 {viewingStory.username}</Text>
              <View style={[styles.storyViewContent, { backgroundColor: viewingStory.color + '22' }]}>
                <Text style={[styles.storyViewText, { color: viewingStory.color }]}>
                  {viewingStory.text}
                </Text>
              </View>
              <Text style={styles.storyViewHint}>Tap anywhere to close</Text>
            </View>
          )}
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, paddingTop: 50, backgroundColor: '#16213e',
    borderBottomWidth: 1, borderBottomColor: '#0f3460',
  },
  backBtn: { padding: 4 },
  backIcon: { color: '#ff6b35', fontSize: 22, fontWeight: 'bold' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  myStoryRow: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14, borderBottomWidth: 1, borderBottomColor: '#0f3460',
  },
  addStoryBtn: { alignItems: 'center', marginRight: 14 },
  addCircle: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: '#ff6b3522', borderWidth: 2, borderColor: '#ff6b35',
    borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center',
  },
  addIcon: { color: '#ff6b35', fontSize: 28, fontWeight: 'bold' },
  myStoryLabel: { color: '#888', fontSize: 11, marginTop: 5 },
  storyRing: { borderWidth: 2.5, borderRadius: 33, padding: 2 },
  storyAvatar: {
    width: 54, height: 54, borderRadius: 27,
    justifyContent: 'center', alignItems: 'center',
  },
  storyAvatarText: { fontSize: 22, fontWeight: 'bold' },
  storiesRow: { paddingRight: 10 },
  storyItem: { alignItems: 'center', marginRight: 14 },
  storyUsername: { color: '#888', fontSize: 11, marginTop: 5, width: 60, textAlign: 'center' },
  emptyStories: { justifyContent: 'center', paddingLeft: 10 },
  emptyStoriesText: { color: '#555', fontSize: 13 },
  sectionTitle: { color: '#888', fontWeight: 'bold', fontSize: 13, padding: 14, paddingBottom: 6 },
  grid: { padding: 10 },
  storyCard: {
    flex: 1, margin: 6, borderRadius: 14, borderWidth: 1, overflow: 'hidden',
  },
  storyCardBg: { padding: 16, minHeight: 120, justifyContent: 'center' },
  storyCardText: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  storyCardFooter: {
    flexDirection: 'row', justifyContent: 'space-between',
    padding: 8, backgroundColor: '#0f346080',
  },
  storyCardUser: { color: '#aaa', fontSize: 10 },
  storyCardTime: { color: '#666', fontSize: 10 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#888' },
  emptyEmoji: { fontSize: 50, marginBottom: 14 },
  emptyText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  emptySubText: { color: '#888', fontSize: 14, marginTop: 8 },
  addFirstBtn: {
    backgroundColor: '#ff6b35', borderRadius: 12,
    paddingHorizontal: 24, paddingVertical: 12, marginTop: 20,
  },
  addFirstBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  modalOverlay: {
    flex: 1, backgroundColor: '#000000cc',
    justifyContent: 'flex-end',
  },
  modalBox: {
    backgroundColor: '#16213e', borderTopLeftRadius: 24,
    borderTopRightRadius: 24, padding: 24,
  },
  modalTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 16 },
  previewBox: {
    borderWidth: 1, borderRadius: 14, padding: 20,
    minHeight: 80, justifyContent: 'center', marginBottom: 14,
  },
  previewText: { fontSize: 18, fontWeight: '600', textAlign: 'center' },
  storyInput: {
    backgroundColor: '#1a1a2e', color: '#fff', borderRadius: 12,
    padding: 14, fontSize: 15, borderWidth: 1, borderColor: '#0f3460',
    marginBottom: 14, minHeight: 80, textAlignVertical: 'top',
  },
  colorLabel: { color: '#888', fontSize: 13, marginBottom: 10 },
  colorRow: { paddingBottom: 16 },
  colorDot: { width: 32, height: 32, borderRadius: 16, marginRight: 10 },
  colorDotSelected: { borderWidth: 3, borderColor: '#fff' },
  modalBtns: { flexDirection: 'row', gap: 12 },
  cancelBtn: {
    flex: 1, backgroundColor: '#0f3460', borderRadius: 12,
    padding: 14, alignItems: 'center',
  },
  cancelBtnText: { color: '#888', fontWeight: 'bold', fontSize: 15 },
  postBtn: {
    flex: 2, backgroundColor: '#ff6b35', borderRadius: 12,
    padding: 14, alignItems: 'center',
  },
  postBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  storyViewOverlay: {
    flex: 1, backgroundColor: '#000000ee',
    justifyContent: 'center', alignItems: 'center',
  },
  storyViewBox: { width: SW * 0.88, alignItems: 'center' },
  storyProgressBar: {
    width: '100%', height: 3, backgroundColor: '#333',
    borderRadius: 2, marginBottom: 16, overflow: 'hidden',
  },
  storyProgress: { height: 3, borderRadius: 2 },
  storyViewUser: { color: '#ccc', fontSize: 14, marginBottom: 20 },
  storyViewContent: {
    width: '100%', borderRadius: 20, padding: 30,
    minHeight: 200, justifyContent: 'center', alignItems: 'center',
  },
  storyViewText: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', lineHeight: 32 },
  storyViewHint: { color: '#555', fontSize: 12, marginTop: 20 },
});
