import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar,
  FlatList, Alert, TextInput, ScrollView, Modal, Share, Clipboard
} from 'react-native';
import { db, auth } from '../firebase/config';
import {
  collection, query, orderBy, onSnapshot,
  addDoc, doc, updateDoc, getDoc, getDocs,
  serverTimestamp, where, deleteDoc, increment
} from 'firebase/firestore';

const BATTLE_TYPES = [
  { id: 'vote', label: 'Vote Battle', emoji: '🗳️', color: '#00bcd4', desc: 'Do options — log vote karein!' },
  { id: 'prediction', label: 'Prediction', emoji: '🔮', color: '#9c27b0', desc: 'True ya False — coins jito!' },
  { id: 'roast', label: 'Roast Battle', emoji: '🔥', color: '#f44336', desc: 'Sabse tez roast — jeet ka badge!' },
];

const generateCode = () => 'BTL-' + Math.random().toString(36).substr(2, 5).toUpperCase();

const getTimeLeft = (expiresAt) => {
  if (!expiresAt) return '24h baaki';
  const diff = new Date(expiresAt) - Date.now();
  if (diff <= 0) return 'Khatam';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m baaki` : `${m}m baaki`;
};

export default function BattleScreen({ navigation }) {
  const [battles, setBattles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Sab');
  const [createModal, setCreateModal] = useState(false);
  const [shareModal, setShareModal] = useState(false);
  const [shareBattle, setShareBattle] = useState(null);
  const [followers, setFollowers] = useState([]);
  const [selectedFollowers, setSelectedFollowers] = useState([]);
  const [codeSearchModal, setCodeSearchModal] = useState(false);
  const [searchCode, setSearchCode] = useState('');
  const [battleType, setBattleType] = useState('vote');
  const [question, setQuestion] = useState('');
  const [optionA, setOptionA] = useState('');
  const [optionB, setOptionB] = useState('');
  const myUid = auth.currentUser?.uid;

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'battles'), orderBy('createdAt', 'desc')),
      (snap) => {
        const now = Date.now();
        const list = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(b => {
            if (!b.expiresAt) return true;
            const exp = new Date(b.expiresAt).getTime();
            const resultExp = exp + 48 * 3600000;
            if (now > resultExp) {
              deleteDoc(doc(db, 'battles', b.id));
              return false;
            }
            return true;
          });
        setBattles(list);
        setLoading(false);
      }
    );
    fetchFollowers();
    return () => unsub();
  }, []);

  const fetchFollowers = async () => {
    try {
      const userDoc = await getDoc(doc(db, 'users', myUid));
      const followingIds = userDoc.data()?.following || [];
      const list = [];
      for (const uid of followingIds.slice(0, 50)) {
        const d = await getDoc(doc(db, 'users', uid));
        if (d.exists()) list.push({ uid: d.id, ...d.data() });
      }
      setFollowers(list);
    } catch (e) {}
  };

  const createBattle = async () => {
    if (!question.trim()) { Alert.alert('Arre!', 'Question daalo!'); return; }
    if (battleType === 'vote' && (!optionA.trim() || !optionB.trim())) {
      Alert.alert('Arre!', 'Dono options daalo!'); return;
    }
    // Check duplicate prevention
    try {
      const existing = await getDocs(query(
        collection(db, 'battles'),
        where('createdByUid', '==', myUid),
        where('type', '==', battleType),
        where('active', '==', true)
      ));
      if (!existing.empty) {
        Alert.alert('Ruko!', `Ek ${battleType} battle pehle se active hai! Pehle woh khatam hone do.`);
        return;
      }
    } catch (e) {}

    const expiresAt = new Date(Date.now() + 24 * 3600000).toISOString();
    const userDoc = await getDoc(doc(db, 'users', myUid));
    const username = userDoc.data()?.username || 'User';
    const code = generateCode();

    try {
      await addDoc(collection(db, 'battles'), {
        type: battleType,
        question: question.trim(),
        optionA: optionA.trim() || 'True',
        optionB: optionB.trim() || 'False',
        votesA: 0, votesB: 0,
        voters: [],
        createdBy: username,
        createdByUid: myUid,
        coins: battleType === 'prediction' ? 20 : 10,
        totalVotes: 0,
        active: true,
        code,
        expiresAt,
        createdAt: serverTimestamp(),
      });
      Alert.alert('Battle Ready! 🔥', `Code: ${code}\n\nShare karo dosto ke saath!`);
      setCreateModal(false);
      setQuestion(''); setOptionA(''); setOptionB('');
    } catch (e) {
      Alert.alert('Error', 'Battle nahi bana!');
    }
  };

  const handleVote = async (battleId, side, battle) => {
    if (battle.voters?.includes(myUid)) {
      Alert.alert('Pehle vote kar chuke ho!', 'Ek battle mein sirf ek baar vote kar sakte ho.');
      return;
    }
    try {
      const field = side === 'A' ? 'votesA' : 'votesB';
      await updateDoc(doc(db, 'battles', battleId), {
        [field]: increment(1),
        totalVotes: increment(1),
        voters: [...(battle.voters || []), myUid],
      });
      await updateDoc(doc(db, 'users', myUid), { coins: increment(1) });
    } catch (e) {}
  };

  const openShare = (battle) => {
    setShareBattle(battle);
    setSelectedFollowers([]);
    setShareModal(true);
  };

  const toggleFollower = (uid) => {
    setSelectedFollowers(prev =>
      prev.includes(uid) ? prev.filter(f => f !== uid) : [...prev, uid]
    );
  };

  const shareBattleToFollowers = async () => {
    if (!shareBattle) return;
    const uids = selectedFollowers.length > 0 ? selectedFollowers : followers.map(f => f.uid);
    for (const uid of uids) {
      try {
        await addDoc(collection(db, 'notifications'), {
          toUid: uid,
          type: 'battle_share',
          message: `${auth.currentUser.displayName || 'Kisi ne'} ne tumhe battle share kiya: "${shareBattle.question}"`,
          battleCode: shareBattle.code,
          read: false,
          createdAt: serverTimestamp(),
        });
      } catch (e) {}
    }
    Alert.alert('Share ho gaya! ✅', `${uids.length} logon ko share kiya!`);
    setShareModal(false);
  };

  const searchByCode = () => {
    const found = battles.find(b => b.code === searchCode.toUpperCase().trim());
    if (found) {
      setCodeSearchModal(false);
      setSearchCode('');
      navigation.navigate('BattleDetail', { battle: found });
    } else {
      Alert.alert('Nahi mila!', 'Ye code kisi battle ka nahi hai. Sahi code daalo!');
    }
  };

  const isExpired = (b) => b.expiresAt && new Date(b.expiresAt) < new Date();

  const filtered = activeTab === 'Sab' ? battles
    : battles.filter(b => b.type === activeTab.toLowerCase());

  const renderBattle = ({ item }) => {
    const expired = isExpired(item);
    const typeColors = { vote: '#00bcd4', prediction: '#9c27b0', roast: '#f44336' };
    const color = typeColors[item.type] || '#ff6b35';
    const totalVotes = (item.votesA || 0) + (item.votesB || 0);
    const pctA = totalVotes > 0 ? Math.round((item.votesA / totalVotes) * 100) : 0;
    const pctB = totalVotes > 0 ? Math.round((item.votesB / totalVotes) * 100) : 0;
    const hasVoted = item.voters?.includes(myUid);

    return (
      <View style={[styles.battleCard, { borderLeftColor: color, borderLeftWidth: 4 },
        expired && styles.expiredCard]}>
        <View style={styles.cardHeader}>
          <View style={[styles.typeBadge, { backgroundColor: color + '22' }]}>
            <Text style={[styles.typeText, { color }]}>
              {item.type === 'vote' ? '🗳️' : item.type === 'prediction' ? '🔮' : '🔥'} {item.type?.toUpperCase()}
            </Text>
          </View>
          <View style={styles.cardHeaderRight}>
            <Text style={styles.coinText}>🪙 {item.coins || 10}</Text>
            {item.code && <Text style={styles.codeText}>#{item.code}</Text>}
          </View>
        </View>

        <Text style={styles.question}>{item.question}</Text>

        {expired ? (
          <View style={styles.resultBox}>
            <Text style={styles.resultTitle}>⏰ Battle Khatam — Result:</Text>
            <View style={styles.resultRow}>
              <Text style={styles.resultOpt}>{item.optionA || 'True'}</Text>
              <Text style={[styles.resultPct, { color: pctA >= pctB ? '#4caf50' : '#e94560' }]}>{pctA}%</Text>
            </View>
            <View style={styles.resultRow}>
              <Text style={styles.resultOpt}>{item.optionB || 'False'}</Text>
              <Text style={[styles.resultPct, { color: pctB >= pctA ? '#4caf50' : '#e94560' }]}>{pctB}%</Text>
            </View>
          </View>
        ) : (
          <>
            {item.type === 'vote' && (
              <View style={styles.voteRow}>
                <TouchableOpacity
                  style={[styles.voteBtn, { borderColor: '#00bcd4' }, hasVoted && styles.votedBtn]}
                  onPress={() => handleVote(item.id, 'A', item)}
                  disabled={hasVoted}
                >
                  <Text style={styles.voteBtnText} numberOfLines={1}>👊 {item.optionA}</Text>
                  {hasVoted && <Text style={styles.votePct}>{pctA}%</Text>}
                </TouchableOpacity>
                <Text style={styles.vsText}>VS</Text>
                <TouchableOpacity
                  style={[styles.voteBtn, { borderColor: '#f44336' }, hasVoted && styles.votedBtn]}
                  onPress={() => handleVote(item.id, 'B', item)}
                  disabled={hasVoted}
                >
                  <Text style={styles.voteBtnText} numberOfLines={1}>👊 {item.optionB}</Text>
                  {hasVoted && <Text style={styles.votePct}>{pctB}%</Text>}
                </TouchableOpacity>
              </View>
            )}

            {item.type === 'prediction' && (
              <View style={styles.voteRow}>
                <TouchableOpacity
                  style={[styles.voteBtn, { borderColor: '#4caf50' }, hasVoted && styles.votedBtn]}
                  onPress={() => handleVote(item.id, 'A', item)}
                  disabled={hasVoted}
                >
                  <Text style={styles.voteBtnText}>✅ True</Text>
                  {hasVoted && <Text style={styles.votePct}>{pctA}%</Text>}
                </TouchableOpacity>
                <Text style={styles.vsText}>YA</Text>
                <TouchableOpacity
                  style={[styles.voteBtn, { borderColor: '#f44336' }, hasVoted && styles.votedBtn]}
                  onPress={() => handleVote(item.id, 'B', item)}
                  disabled={hasVoted}
                >
                  <Text style={styles.voteBtnText}>❌ False</Text>
                  {hasVoted && <Text style={styles.votePct}>{pctB}%</Text>}
                </TouchableOpacity>
              </View>
            )}

            {item.type === 'roast' && !hasVoted && (
              <TouchableOpacity
                style={[styles.voteBtn, { borderColor: '#f44336', flex: 0, paddingHorizontal: 20 }]}
                onPress={() => handleVote(item.id, 'A', item)}
              >
                <Text style={styles.voteBtnText}>🔥 Roast Karo!</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        <View style={styles.cardFooter}>
          <Text style={styles.footerText}>👤 {item.createdBy}</Text>
          <Text style={styles.footerText}>🗳️ {item.totalVotes || 0} votes</Text>
          <Text style={[styles.timeText, expired && { color: '#e94560' }]}>
            ⏰ {getTimeLeft(item.expiresAt)}
          </Text>
        </View>

        {!expired && (
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.actionBtn} onPress={() => openShare(item)}>
              <Text style={styles.actionBtnText}>📤 Share</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={() => {
              Clipboard.setString(item.code || '');
              Alert.alert('✅', 'Code copy ho gaya!');
            }}>
              <Text style={styles.actionBtnText}>📋 Code Copy</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#16213e" />

      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>⚔️ Battles</Text>
          <Text style={styles.headerSub}>Lado — Jeeto — Coins Kamao!</Text>
        </View>
        <TouchableOpacity style={styles.codeSearchBtn} onPress={() => setCodeSearchModal(true)}>
          <Text style={styles.codeSearchBtnText}>🔍 Code</Text>
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll}>
        {['Sab', 'Vote', 'Prediction', 'Roast'].map(tab => (
          <TouchableOpacity key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}>
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.center}><Text style={styles.loadingText}>Load ho raha hai... ⏳</Text></View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>Koi battle nahi! 😴</Text>
          <Text style={styles.emptySub}>Pehla battle tum shuru karo! 🔥</Text>
        </View>
      ) : (
        <FlatList data={filtered} renderItem={renderBattle} keyExtractor={i => i.id}
          contentContainerStyle={{ padding: 14 }} showsVerticalScrollIndicator={false} />
      )}

      {/* Create Battle FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => setCreateModal(true)}>
        <Text style={styles.fabText}>⚔️ Naya Battle</Text>
      </TouchableOpacity>

      {/* Create Modal */}
      <Modal visible={createModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ScrollView>
            <View style={[styles.modalBox, { marginTop: 60 }]}>
              <Text style={styles.modalTitle}>⚔️ Naya Battle Banao</Text>

              <View style={styles.typeRow}>
                {BATTLE_TYPES.map(t => (
                  <TouchableOpacity key={t.id}
                    style={[styles.typeBtn, battleType === t.id && { borderColor: t.color, backgroundColor: t.color + '22' }]}
                    onPress={() => setBattleType(t.id)}>
                    <Text style={{ fontSize: 20 }}>{t.emoji}</Text>
                    <Text style={[styles.typeBtnText, battleType === t.id && { color: t.color }]}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput style={styles.input} placeholder="Question likho..."
                placeholderTextColor="#666" value={question} onChangeText={setQuestion} multiline />

              {battleType === 'vote' && (
                <>
                  <TextInput style={styles.input} placeholder="Option A"
                    placeholderTextColor="#666" value={optionA} onChangeText={setOptionA} />
                  <TextInput style={styles.input} placeholder="Option B"
                    placeholderTextColor="#666" value={optionB} onChangeText={setOptionB} />
                </>
              )}

              {battleType === 'prediction' && (
                <Text style={styles.predHint}>
                  🔮 Users True ya False vote karenge. Zyada True votes = voters ko coins milenge!
                </Text>
              )}

              <TouchableOpacity style={styles.createBtn} onPress={createBattle}>
                <Text style={styles.createBtnText}>Battle Shuru Karo 🔥</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setCreateModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Share Modal */}
      <Modal visible={shareModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { maxHeight: '75%' }]}>
            <Text style={styles.modalTitle}>📤 Share Battle</Text>
            {shareBattle && (
              <View style={styles.shareBattlePreview}>
                <Text style={styles.shareBattleQ} numberOfLines={2}>{shareBattle.question}</Text>
                <Text style={styles.shareBattleCode}>Code: {shareBattle.code}</Text>
              </View>
            )}
            <View style={styles.selectAllRow}>
              <Text style={styles.selectAllLabel}>Followers select karo:</Text>
              <TouchableOpacity onPress={() =>
                setSelectedFollowers(selectedFollowers.length === followers.length ? [] : followers.map(f => f.uid))}>
                <Text style={styles.selectAllBtn}>
                  {selectedFollowers.length === followers.length ? 'Deselect All' : 'Select All'}
                </Text>
              </TouchableOpacity>
            </View>
            <FlatList data={followers} keyExtractor={i => i.uid} style={{ maxHeight: 250 }}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.followerRow} onPress={() => toggleFollower(item.uid)}>
                  <View style={styles.followerAvatar}>
                    <Text style={styles.followerAvatarText}>{item.username?.charAt(0).toUpperCase()}</Text>
                  </View>
                  <Text style={styles.followerName}>{item.username}</Text>
                  <View style={[styles.checkbox, selectedFollowers.includes(item.uid) && styles.checkboxSelected]}>
                    {selectedFollowers.includes(item.uid) && <Text style={{ color: '#fff', fontSize: 12 }}>✓</Text>}
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={styles.noFollowers}>Koi followers nahi hain abhi</Text>}
            />
            <TouchableOpacity style={styles.createBtn} onPress={shareBattleToFollowers}>
              <Text style={styles.createBtnText}>
                Share Karo {selectedFollowers.length > 0 ? `(${selectedFollowers.length})` : '(Sabko)'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShareModal(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Code Search Modal */}
      <Modal visible={codeSearchModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>🔍 Battle Code Se Dhundo</Text>
            <TextInput style={styles.input} placeholder="BTL-XXXXX"
              placeholderTextColor="#666" value={searchCode}
              onChangeText={text => setSearchCode(text.toUpperCase())}
              autoCapitalize="characters" autoFocus />
            <TouchableOpacity style={styles.createBtn} onPress={searchByCode}>
              <Text style={styles.createBtnText}>Battle Dhundo 🔍</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => { setCodeSearchModal(false); setSearchCode(''); }}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
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
  headerSub: { color: '#888', fontSize: 12, marginTop: 2 },
  codeSearchBtn: { backgroundColor: '#0f3460', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  codeSearchBtnText: { color: '#fff', fontSize: 13 },
  tabScroll: { paddingHorizontal: 12, paddingVertical: 8, maxHeight: 50, backgroundColor: '#16213e' },
  tab: {
    paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20,
    marginRight: 8, backgroundColor: '#0f3460',
  },
  tabActive: { backgroundColor: '#ff6b35' },
  tabText: { color: '#888', fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#888' },
  emptyText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  emptySub: { color: '#888', fontSize: 13, marginTop: 8 },
  battleCard: {
    backgroundColor: '#16213e', borderRadius: 14, padding: 14,
    marginBottom: 14, borderWidth: 1, borderColor: '#0f3460',
  },
  expiredCard: { opacity: 0.75 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  typeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  typeText: { fontWeight: 'bold', fontSize: 11 },
  cardHeaderRight: { alignItems: 'flex-end' },
  coinText: { color: '#ffd700', fontWeight: 'bold', fontSize: 12 },
  codeText: { color: '#555', fontSize: 10, marginTop: 2 },
  question: { color: '#fff', fontSize: 15, fontWeight: 'bold', marginBottom: 14, lineHeight: 22 },
  voteRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  voteBtn: {
    flex: 1, borderWidth: 1.5, borderRadius: 10, padding: 10,
    alignItems: 'center', backgroundColor: '#0f3460',
  },
  votedBtn: { opacity: 0.8 },
  voteBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  votePct: { color: '#ffd700', fontWeight: 'bold', fontSize: 13, marginTop: 3 },
  vsText: { color: '#ff6b35', fontWeight: 'bold', fontSize: 13 },
  resultBox: { backgroundColor: '#0f3460', borderRadius: 10, padding: 12, marginBottom: 10 },
  resultTitle: { color: '#ff6b35', fontWeight: 'bold', fontSize: 12, marginBottom: 8 },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  resultOpt: { color: '#ccc', fontSize: 13 },
  resultPct: { fontWeight: 'bold', fontSize: 14 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  footerText: { color: '#666', fontSize: 11 },
  timeText: { color: '#888', fontSize: 11 },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  actionBtn: {
    flex: 1, backgroundColor: '#0f3460', borderRadius: 8,
    padding: 8, alignItems: 'center',
  },
  actionBtnText: { color: '#aaa', fontSize: 12 },
  fab: {
    position: 'absolute', bottom: 20, left: 20, right: 20,
    backgroundColor: '#ff6b35', borderRadius: 14, padding: 16, alignItems: 'center',
  },
  fabText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: '#000000cc', justifyContent: 'flex-end' },
  modalBox: {
    backgroundColor: '#16213e', borderTopLeftRadius: 24,
    borderTopRightRadius: 24, padding: 24,
  },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
  typeRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  typeBtn: {
    flex: 1, alignItems: 'center', backgroundColor: '#0f3460',
    borderRadius: 12, padding: 10, borderWidth: 1.5, borderColor: '#0f3460',
  },
  typeBtnText: { color: '#888', fontSize: 11, marginTop: 4, fontWeight: '600' },
  input: {
    backgroundColor: '#0f3460', color: '#fff', borderRadius: 12,
    padding: 14, fontSize: 15, marginBottom: 12,
  },
  predHint: { color: '#9c27b0', fontSize: 13, marginBottom: 14, fontStyle: 'italic' },
  createBtn: { backgroundColor: '#ff6b35', borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 10 },
  createBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  cancelBtn: { backgroundColor: '#0f3460', borderRadius: 12, padding: 14, alignItems: 'center' },
  cancelBtnText: { color: '#888', fontWeight: 'bold' },
  shareBattlePreview: {
    backgroundColor: '#0f3460', borderRadius: 10, padding: 12, marginBottom: 14,
  },
  shareBattleQ: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  shareBattleCode: { color: '#ff6b35', fontSize: 12, marginTop: 4 },
  selectAllRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  selectAllLabel: { color: '#888', fontSize: 13 },
  selectAllBtn: { color: '#ff6b35', fontWeight: 'bold', fontSize: 13 },
  followerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12, borderBottomWidth: 1, borderColor: '#0f3460' },
  followerAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#ff6b3533', justifyContent: 'center', alignItems: 'center' },
  followerAvatarText: { color: '#ff6b35', fontWeight: 'bold' },
  followerName: { flex: 1, color: '#fff', fontSize: 14 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#555', justifyContent: 'center', alignItems: 'center' },
  checkboxSelected: { backgroundColor: '#ff6b35', borderColor: '#ff6b35' },
  noFollowers: { color: '#888', textAlign: 'center', padding: 16 },
});
