import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, Modal, TextInput, Dimensions, ScrollView
} from 'react-native';
import { db, auth } from '../../firebase/config';
import {
  doc, setDoc, onSnapshot, updateDoc, serverTimestamp, getDoc
} from 'firebase/firestore';

const { width: SW } = Dimensions.get('window');
const BOARD = SW - 32;
const CELL = Math.floor(BOARD / 15);

const COLORS = ['#e94560', '#4caf50', '#ffd700', '#2196f3'];
const PLAYER_NAMES = ['Red', 'Green', 'Yellow', 'Blue'];
const HOME_POSITIONS = { 0: [1,1], 1: [9,1], 2: [9,9], 3: [1,9] };
const SAFE_SQUARES = [1,9,14,22,27,35,40,48];

const generateRoomCode = () => 'LUDO-' + Math.random().toString(36).substr(2,4).toUpperCase();

export default function LudoGame() {
  const [mode, setMode] = useState(null); // 'solo', 'online'
  const [roomCode, setRoomCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [gameState, setGameState] = useState(null);
  const [dice, setDice] = useState(null);
  const [myPlayerIdx, setMyPlayerIdx] = useState(0);
  const [roomModal, setRoomModal] = useState(false);
  const [chatModal, setChatModal] = useState(false);
  const [chatMsg, setChatMsg] = useState('');
  const [messages, setMessages] = useState([]);
  const unsubRef = useRef(null);
  const myUid = auth.currentUser?.uid;

  const initBoard = (playerCount = 2) => {
    const pieces = {};
    for (let p = 0; p < playerCount; p++) {
      pieces[p] = [-1, -1, -1, -1]; // -1 = home
    }
    return {
      pieces,
      currentPlayer: 0,
      playerCount,
      dice: null,
      winner: null,
      players: {},
      messages: [],
      status: 'playing',
    };
  };

  const startSolo = () => {
    setMode('solo');
    setMyPlayerIdx(0);
    setGameState(initBoard(2));
  };

  const createRoom = async () => {
    const code = generateRoomCode();
    setRoomCode(code);
    const state = {
      ...initBoard(2),
      players: { [myUid]: 0 },
      hostUid: myUid,
      status: 'waiting',
      messages: [],
    };
    await setDoc(doc(db, 'ludoRooms', code), state);
    setMyPlayerIdx(0);
    setMode('online');
    setGameState(state);
    listenRoom(code);
  };

  const joinRoom = async () => {
    const code = joinCode.toUpperCase().trim();
    if (!code) { Alert.alert('Code daalo!'); return; }
    try {
      const snap = await getDoc(doc(db, 'ludoRooms', code));
      if (!snap.exists()) { Alert.alert('Room nahi mila!'); return; }
      const data = snap.data();
      if (data.status !== 'waiting') { Alert.alert('Game shuru ho chuka hai!'); return; }
      const playerIdx = Object.keys(data.players).length;
      await updateDoc(doc(db, 'ludoRooms', code), {
        [`players.${myUid}`]: playerIdx,
        status: 'playing',
      });
      setMyPlayerIdx(playerIdx);
      setRoomCode(code);
      setMode('online');
      listenRoom(code);
    } catch (e) { Alert.alert('Error', 'Room join nahi hua!'); }
    setRoomModal(false);
  };

  const listenRoom = (code) => {
    if (unsubRef.current) unsubRef.current();
    unsubRef.current = onSnapshot(doc(db, 'ludoRooms', code), (snap) => {
      if (snap.exists()) {
        setGameState(snap.data());
        setMessages(snap.data().messages || []);
      }
    });
  };

  const rollDice = async () => {
    if (!gameState) return;
    if (gameState.currentPlayer !== myPlayerIdx && mode === 'online') return;
    const roll = Math.floor(Math.random() * 6) + 1;
    setDice(roll);
    if (mode === 'solo') {
      const newState = { ...gameState, dice: roll };
      setGameState(newState);
    } else {
      await updateDoc(doc(db, 'ludoRooms', roomCode), { dice: roll });
    }
    if (mode === 'solo') {
      setTimeout(() => computerMove(roll), 1200);
    }
  };

  const computerMove = (roll) => {
    setGameState(prev => {
      if (!prev) return prev;
      const newState = { ...prev };
      const pieces = { ...newState.pieces };
      const compPieces = [...(pieces[1] || [-1,-1,-1,-1])];
      let moved = false;
      for (let i = 0; i < 4; i++) {
        if (compPieces[i] === -1 && roll === 6) {
          compPieces[i] = 0; moved = true; break;
        } else if (compPieces[i] >= 0) {
          compPieces[i] = Math.min(compPieces[i] + roll, 56);
          moved = true; break;
        }
      }
      pieces[1] = compPieces;
      const allHome1 = compPieces.every(p => p === 56);
      return {
        ...newState, pieces,
        currentPlayer: 0,
        winner: allHome1 ? 1 : newState.winner,
        dice: null,
      };
    });
  };

  const movePiece = async (pieceIdx) => {
    if (!gameState || gameState.dice === null && dice === null) return;
    if (gameState.currentPlayer !== myPlayerIdx) return;
    const roll = gameState.dice || dice;
    const newPieces = { ...gameState.pieces };
    const myPieces = [...(newPieces[myPlayerIdx] || [-1,-1,-1,-1])];
    if (myPieces[pieceIdx] === -1 && roll === 6) {
      myPieces[pieceIdx] = 0;
    } else if (myPieces[pieceIdx] >= 0) {
      myPieces[pieceIdx] = Math.min(myPieces[pieceIdx] + roll, 56);
    } else return;
    newPieces[myPlayerIdx] = myPieces;
    const won = myPieces.every(p => p === 56);
    const next = won ? myPlayerIdx : (gameState.currentPlayer + 1) % gameState.playerCount;
    const newState = { ...gameState, pieces: newPieces, currentPlayer: next, dice: null, winner: won ? myPlayerIdx : null };
    if (mode === 'solo') {
      setGameState(newState);
      setDice(null);
    } else {
      await updateDoc(doc(db, 'ludoRooms', roomCode), newState);
    }
    if (won) Alert.alert('🏆 Jeet Gaye!', `${PLAYER_NAMES[myPlayerIdx]} jeet gaya!`);
  };

  const sendMessage = async () => {
    if (!chatMsg.trim()) return;
    const snap = await getDoc(doc(db, 'users', myUid));
    const username = snap.data()?.username || 'Player';
    const msg = { uid: myUid, username, text: chatMsg.trim(), time: Date.now() };
    const newMsgs = [...messages, msg];
    setMessages(newMsgs);
    if (mode === 'online') {
      await updateDoc(doc(db, 'ludoRooms', roomCode), { messages: newMsgs });
    }
    setChatMsg('');
  };

  useEffect(() => () => { if (unsubRef.current) unsubRef.current(); }, []);

  if (!mode) {
    return (
      <View style={styles.modeContainer}>
        <Text style={styles.modeTitle}>🎲 Ludo</Text>
        <TouchableOpacity style={styles.modeBtn} onPress={startSolo}>
          <Text style={styles.modeBtnText}>🤖 Computer Se Khelo</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.modeBtn, { backgroundColor: '#4caf50' }]} onPress={createRoom}>
          <Text style={styles.modeBtnText}>🌐 Room Banao</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.modeBtn, { backgroundColor: '#2196f3' }]} onPress={() => setRoomModal(true)}>
          <Text style={styles.modeBtnText}>🔗 Room Join Karo</Text>
        </TouchableOpacity>

        <Modal visible={roomModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>Room Join Karo</Text>
              <TextInput style={styles.input} placeholder="Room Code (LUDO-XXXX)"
                placeholderTextColor="#666" value={joinCode}
                onChangeText={t => setJoinCode(t.toUpperCase())} autoCapitalize="characters" />
              <TouchableOpacity style={styles.modeBtn} onPress={joinRoom}>
                <Text style={styles.modeBtnText}>Join Karo ✅</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setRoomModal(false)}>
                <Text style={{ color: '#888', textAlign: 'center', marginTop: 10 }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  const currentDice = gameState?.dice || dice;
  const isMyTurn = gameState?.currentPlayer === myPlayerIdx;
  const myPieces = gameState?.pieces?.[myPlayerIdx] || [-1,-1,-1,-1];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#1a1a2e' }}>
      {/* Room info */}
      {mode === 'online' && (
        <View style={styles.roomBar}>
          <Text style={styles.roomCode}>Room: {roomCode}</Text>
          <Text style={styles.roomStatus}>
            {gameState?.status === 'waiting' ? '⏳ Dost ka wait...' : '🎮 Game On!'}
          </Text>
        </View>
      )}

      {/* Turn indicator */}
      <View style={[styles.turnBar, { backgroundColor: COLORS[gameState?.currentPlayer || 0] + '33' }]}>
        <Text style={[styles.turnText, { color: COLORS[gameState?.currentPlayer || 0] }]}>
          {isMyTurn ? '🎯 Tumhari Baari!' : `⏳ ${PLAYER_NAMES[gameState?.currentPlayer || 0]} ki baari`}
        </Text>
        {currentDice && <Text style={styles.diceDisplay}>🎲 {currentDice}</Text>}
      </View>

      {/* Simple board visualization */}
      <View style={styles.boardContainer}>
        <View style={styles.boardBg}>
          {/* Player pieces display */}
          {Object.entries(gameState?.pieces || {}).map(([pIdx, pieces]) => (
            <View key={pIdx} style={styles.playerPiecesRow}>
              <Text style={[styles.playerLabel, { color: COLORS[parseInt(pIdx)] }]}>
                {PLAYER_NAMES[parseInt(pIdx)]}:
              </Text>
              {pieces.map((pos, i) => (
                <TouchableOpacity key={i}
                  onPress={() => parseInt(pIdx) === myPlayerIdx ? movePiece(i) : null}
                  style={[styles.piece, {
                    backgroundColor: COLORS[parseInt(pIdx)],
                    opacity: pos === 56 ? 0.4 : 1,
                    borderWidth: parseInt(pIdx) === myPlayerIdx && isMyTurn ? 2 : 0,
                    borderColor: '#fff',
                  }]}>
                  <Text style={styles.pieceText}>
                    {pos === -1 ? '🏠' : pos === 56 ? '✅' : pos}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </View>
      </View>

      {/* Controls */}
      {isMyTurn && !currentDice && (
        <TouchableOpacity style={styles.rollBtn} onPress={rollDice}>
          <Text style={styles.rollBtnText}>🎲 Dice Phenko!</Text>
        </TouchableOpacity>
      )}
      {isMyTurn && currentDice && (
        <Text style={styles.selectHint}>Upar apna piece tap karo move karne ke liye!</Text>
      )}

      {/* Chat Button */}
      <TouchableOpacity style={styles.chatBtn} onPress={() => setChatModal(true)}>
        <Text style={styles.chatBtnText}>💬 Chat ({messages.length})</Text>
      </TouchableOpacity>

      {/* Chat Modal */}
      <Modal visible={chatModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { maxHeight: '60%' }]}>
            <Text style={styles.modalTitle}>💬 Game Chat</Text>
            <ScrollView style={{ maxHeight: 200 }}>
              {messages.map((m, i) => (
                <View key={i} style={styles.msgRow}>
                  <Text style={styles.msgUser}>{m.username}: </Text>
                  <Text style={styles.msgText}>{m.text}</Text>
                </View>
              ))}
              {messages.length === 0 && <Text style={{ color: '#888', textAlign: 'center' }}>Koi message nahi</Text>}
            </ScrollView>
            <View style={styles.msgInputRow}>
              <TextInput style={styles.msgInput} placeholder="Message..."
                placeholderTextColor="#666" value={chatMsg} onChangeText={setChatMsg} />
              <TouchableOpacity style={styles.sendBtn} onPress={sendMessage}>
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>Send</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={() => setChatModal(false)}>
              <Text style={{ color: '#888', textAlign: 'center', marginTop: 12 }}>Bandh Karo</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  modeContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  modeTitle: { color: '#fff', fontSize: 32, fontWeight: 'bold', marginBottom: 30 },
  modeBtn: { backgroundColor: '#ff6b35', borderRadius: 14, padding: 16, width: '100%', alignItems: 'center', marginBottom: 14 },
  modeBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  roomBar: { flexDirection: 'row', justifyContent: 'space-between', padding: 12, backgroundColor: '#16213e' },
  roomCode: { color: '#ffd700', fontWeight: 'bold' },
  roomStatus: { color: '#4caf50', fontSize: 13 },
  turnBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, margin: 12, borderRadius: 12 },
  turnText: { fontWeight: 'bold', fontSize: 16 },
  diceDisplay: { fontSize: 24 },
  boardContainer: { padding: 12 },
  boardBg: { backgroundColor: '#16213e', borderRadius: 16, padding: 16, borderWidth: 2, borderColor: '#0f3460' },
  playerPiecesRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 8 },
  playerLabel: { fontWeight: 'bold', fontSize: 13, width: 55 },
  piece: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  pieceText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  rollBtn: { backgroundColor: '#ff6b35', borderRadius: 14, padding: 16, margin: 12, alignItems: 'center' },
  rollBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  selectHint: { color: '#ffd700', textAlign: 'center', fontSize: 13, marginBottom: 8 },
  chatBtn: { backgroundColor: '#0f3460', borderRadius: 12, padding: 12, margin: 12, alignItems: 'center' },
  chatBtnText: { color: '#aaa', fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: '#000000cc', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#16213e', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
  input: { backgroundColor: '#0f3460', color: '#fff', borderRadius: 12, padding: 14, fontSize: 15, marginBottom: 12 },
  msgRow: { flexDirection: 'row', padding: 6, borderBottomWidth: 1, borderColor: '#0f3460' },
  msgUser: { color: '#ff6b35', fontWeight: 'bold', fontSize: 13 },
  msgText: { color: '#ddd', fontSize: 13 },
  msgInputRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  msgInput: { flex: 1, backgroundColor: '#0f3460', color: '#fff', borderRadius: 10, padding: 10, fontSize: 14 },
  sendBtn: { backgroundColor: '#ff6b35', borderRadius: 10, padding: 10, justifyContent: 'center' },
});
