import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, ScrollView, TextInput, Modal, FlatList
} from 'react-native';
import { db, auth } from '../../firebase/config';
import {
  collection, addDoc, doc, onSnapshot,
  updateDoc, getDoc, serverTimestamp, query, where, getDocs
} from 'firebase/firestore';

const COLORS = ['red', 'green', 'yellow', 'blue'];
const COLOR_HEX = { red: '#e53935', green: '#43a047', yellow: '#fdd835', blue: '#1e88e5' };
const COLOR_LIGHT = { red: '#ffcdd2', green: '#c8e6c9', yellow: '#fff9c4', blue: '#bbdefb' };

// Ludo board path (52 squares) - simplified linear track
const TRACK_LENGTH = 52;
const HOME_ENTRY = { red: 51, green: 12, yellow: 25, blue: 38 };
const START_POS = { red: 0, green: 13, yellow: 26, blue: 39 };

function rollDice() { return Math.floor(Math.random() * 6) + 1; }

function computerMove(pieces, currentColor, diceVal) {
  const myPieces = pieces[currentColor];
  // Try to move piece that's on board, prefer pieces closer to home
  const onBoard = myPieces.map((p, i) => ({ i, pos: p })).filter(p => p.pos > 0 && p.pos < 57);
  const atHome = myPieces.map((p, i) => ({ i, pos: p })).filter(p => p.pos === 0);
  if (diceVal === 6 && atHome.length > 0) return atHome[0].i;
  if (onBoard.length > 0) {
    // Move piece closest to finish
    onBoard.sort((a, b) => b.pos - a.pos);
    return onBoard[0].i;
  }
  return -1;
}

export default function LudoGame({ navigation }) {
  const [mode, setMode] = useState(null); // 'computer' | 'room'
  const [gameState, setGameState] = useState(null);
  const [roomId, setRoomId] = useState(null);
  const [roomCode, setRoomCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [dice, setDice] = useState(null);
  const [rolling, setRolling] = useState(false);
  const [selected, setSelected] = useState(null);
  const [chatMsg, setChatMsg] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [chatTarget, setChatTarget] = useState('all');
  const [showChat, setShowChat] = useState(false);
  const [miniChat, setMiniChat] = useState(false);
  const [playerNames, setPlayerNames] = useState({});
  const [myColor, setMyColor] = useState('red');
  const [waitingPlayers, setWaitingPlayers] = useState([]);
  const unsubRef = useRef(null);

  const myUid = auth.currentUser?.uid;

  useEffect(() => {
    return () => { if (unsubRef.current) unsubRef.current(); };
  }, []);

  const startComputer = () => {
    const initialPieces = { red: [0, 0, 0, 0], green: [0, 0, 0, 0] };
    setGameState({
      pieces: initialPieces,
      currentTurn: 'red',
      winner: null,
      players: { red: 'Tum', green: 'Computer' },
      mode: 'computer'
    });
    setMyColor('red');
    setMode('computer');
    setDice(null);
  };

  const createRoom = async () => {
    try {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const userDoc = await getDoc(doc(db, 'users', myUid));
      const username = userDoc.data()?.username || 'Player';
      const ref = await addDoc(collection(db, 'ludo_rooms'), {
        code,
        players: { [myUid]: { color: 'red', name: username } },
        playerCount: 1,
        pieces: { red: [0,0,0,0], green: [0,0,0,0], yellow: [0,0,0,0], blue: [0,0,0,0] },
        currentTurn: 'red',
        colorMap: { [myUid]: 'red' },
        status: 'waiting',
        createdAt: serverTimestamp(),
      });
      setRoomId(ref.id);
      setRoomCode(code);
      setMyColor('red');
      setMode('room');
      subscribeRoom(ref.id);
    } catch (e) { Alert.alert('Error', 'Room nahi bana!'); }
  };

  const joinRoom = async () => {
    try {
      const q = query(collection(db, 'ludo_rooms'), where('code', '==', joinCode.toUpperCase()));
      const snap = await getDocs(q);
      if (snap.empty) { Alert.alert('Nahi mila!', 'Code galat hai!'); return; }
      const roomDoc = snap.docs[0];
      const roomData = roomDoc.data();
      const usedColors = Object.values(roomData.colorMap || {});
      const availColors = COLORS.filter(c => !usedColors.includes(c));
      if (availColors.length === 0) { Alert.alert('Full!', 'Room full hai!'); return; }
      const myNewColor = availColors[0];
      const userDoc = await getDoc(doc(db, 'users', myUid));
      const username = userDoc.data()?.username || 'Player';
      const newPlayers = { ...roomData.players, [myUid]: { color: myNewColor, name: username } };
      const newColorMap = { ...roomData.colorMap, [myUid]: myNewColor };
      await updateDoc(doc(db, 'ludo_rooms', roomDoc.id), {
        players: newPlayers, colorMap: newColorMap,
        playerCount: Object.keys(newPlayers).length,
        status: Object.keys(newPlayers).length >= 2 ? 'playing' : 'waiting',
      });
      setRoomId(roomDoc.id);
      setMyColor(myNewColor);
      setMode('room');
      subscribeRoom(roomDoc.id);
    } catch (e) { Alert.alert('Error', 'Join nahi ho saka!'); }
  };

  const subscribeRoom = (rid) => {
    const unsub = onSnapshot(doc(db, 'ludo_rooms', rid), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      setGameState(data);
      const names = {};
      Object.entries(data.players || {}).forEach(([uid, p]) => {
        names[p.color] = p.name;
      });
      setPlayerNames(names);
      const waiting = Object.values(data.players || {}).map(p => p.name);
      setWaitingPlayers(waiting);
    });
    const chatUnsub = onSnapshot(
      query(collection(db, 'ludo_rooms', rid, 'chat'), where('createdAt', '!=', null)),
      (snap) => {
        setChatMessages(snap.docs.map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)));
      }
    );
    unsubRef.current = () => { unsub(); chatUnsub(); };
  };

  const rollAndMove = async () => {
    if (!gameState || rolling) return;
    if (mode === 'computer' && gameState.currentTurn !== myColor) return;
    if (mode === 'room' && gameState.colorMap?.[myUid] !== gameState.currentTurn) return;

    setRolling(true);
    const val = rollDice();
    setDice(val);

    setTimeout(async () => {
      const pieces = { ...gameState.pieces };
      const color = gameState.currentTurn;
      const myPieces = [...pieces[color]];

      // Find movable pieces
      const canMove = myPieces.map((p, i) => {
        if (p === 0 && val === 6) return i;
        if (p > 0 && p + val <= 57) return i;
        return -1;
      }).filter(i => i !== -1);

      if (canMove.length === 0) {
        // No move possible, next turn
        const nextColor = getNextColor(color, gameState);
        await updateGameState(pieces, nextColor, null);
        setRolling(false);
        return;
      }

      if (mode === 'computer') {
        // Auto select for user if only one option
        if (canMove.length === 1) {
          await doMove(canMove[0], val, pieces, color);
        } else {
          setSelected({ canMove, val, pieces, color });
        }
        setRolling(false);
      } else {
        setSelected({ canMove, val, pieces, color });
        setRolling(false);
      }
    }, 600);
  };

  const doMove = async (pieceIdx, val, pieces, color) => {
    const newPieces = { ...pieces };
    const myPieces = [...newPieces[color]];
    const curPos = myPieces[pieceIdx];
    let newPos = curPos === 0 ? START_POS[color] : curPos + val;
    if (newPos > 57) newPos = curPos; // Can't overshoot home
    myPieces[pieceIdx] = newPos;
    newPieces[color] = myPieces;

    // Check win
    const won = myPieces.every(p => p === 57);
    const nextColor = won ? color : getNextColor(color, gameState);
    await updateGameState(newPieces, nextColor, won ? color : null);
    setSelected(null);

    if (won) {
      Alert.alert('🎉 Jeet Gaye!', `${color.toUpperCase()} ne jeeta!`);
      return;
    }

    // Computer's turn
    if (mode === 'computer' && nextColor === 'green') {
      setTimeout(() => doComputerTurn(newPieces, nextColor), 1000);
    }
  };

  const doComputerTurn = async (pieces, color) => {
    setRolling(true);
    const val = rollDice();
    setDice(val);
    setTimeout(async () => {
      const idx = computerMove(pieces, color, val);
      if (idx >= 0) {
        await doMove(idx, val, pieces, color);
      } else {
        const next = getNextColor(color, { ...gameState, pieces });
        await updateGameState(pieces, next, null);
      }
      setRolling(false);
    }, 800);
  };

  const updateGameState = async (pieces, nextTurn, winner) => {
    if (mode === 'computer') {
      setGameState(prev => ({ ...prev, pieces, currentTurn: nextTurn, winner }));
    } else if (roomId) {
      await updateDoc(doc(db, 'ludo_rooms', roomId), { pieces, currentTurn: nextTurn, winner });
    }
  };

  const getNextColor = (color, state) => {
    const activePlayers = Object.values(state?.players || {}).map(p => p.color);
    const allColors = mode === 'computer' ? ['red', 'green'] : activePlayers;
    const idx = allColors.indexOf(color);
    return allColors[(idx + 1) % allColors.length];
  };

  const sendChatMsg = async () => {
    if (!chatMsg.trim() || !roomId) return;
    const userDoc = await getDoc(doc(db, 'users', myUid));
    const username = userDoc.data()?.username || 'Player';
    await addDoc(collection(db, 'ludo_rooms', roomId, 'chat'), {
      text: chatMsg.trim(), from: username,
      fromColor: myColor, target: chatTarget,
      createdAt: serverTimestamp(),
    });
    setChatMsg('');
  };

  // ─── RENDER LOBBY ───
  if (!mode) {
    return (
      <View style={styles.lobby}>
        <Text style={styles.lobbyTitle}>🎲 Ludo</Text>
        <TouchableOpacity style={[styles.lobbyBtn, { backgroundColor: '#ff6b35' }]} onPress={startComputer}>
          <Text style={styles.lobbyBtnText}>🤖 Computer Se Khelo</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.lobbyBtn, { backgroundColor: '#4caf50' }]} onPress={createRoom}>
          <Text style={styles.lobbyBtnText}>🌐 Room Banao</Text>
        </TouchableOpacity>
        <View style={styles.joinRow}>
          <TextInput style={styles.joinInput} placeholder="Room code daalo..." placeholderTextColor="#666"
            value={joinCode} onChangeText={setJoinCode} autoCapitalize="characters" />
          <TouchableOpacity style={styles.joinBtn} onPress={joinRoom}>
            <Text style={styles.joinBtnText}>Join</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ─── WAITING ROOM ───
  if (mode === 'room' && gameState?.status === 'waiting') {
    return (
      <View style={styles.lobby}>
        <Text style={styles.lobbyTitle}>⏳ Room Code:</Text>
        <Text style={styles.roomCodeText}>{roomCode}</Text>
        <Text style={styles.waitText}>Doston ko code share karo!</Text>
        <Text style={styles.waitSubText}>Players joined:</Text>
        {waitingPlayers.map((n, i) => (
          <Text key={i} style={styles.playerName}>✅ {n}</Text>
        ))}
        <Text style={styles.waitSubText}>2-4 players aane par game shuru hoga</Text>
      </View>
    );
  }

  if (!gameState) return <View style={styles.lobby}><Text style={{ color: '#fff' }}>Loading...</Text></View>;

  const currentTurn = gameState.currentTurn;
  const isMyTurn = mode === 'computer'
    ? currentTurn === myColor
    : gameState.colorMap?.[myUid] === currentTurn;
  const pieces = gameState.pieces || {};

  // ─── GAME BOARD ───
  return (
    <View style={styles.container}>
      {/* Turn indicator */}
      <View style={[styles.turnBar, { backgroundColor: COLOR_HEX[currentTurn] + '33', borderColor: COLOR_HEX[currentTurn] }]}>
        <Text style={[styles.turnText, { color: COLOR_HEX[currentTurn] }]}>
          {isMyTurn ? '🎯 Tumhari Baari!' : `⏳ ${gameState.players?.[currentTurn]?.name || playerNames[currentTurn] || currentTurn} ki Baari`}
        </Text>
        <Text style={styles.diceDisplay}>{dice ? `🎲 ${dice}` : '🎲'}</Text>
      </View>

      {/* Pieces display */}
      <ScrollView style={styles.boardScroll}>
        {Object.entries(pieces).map(([color, pArr]) => {
          if (!pArr || !pArr.some) return null;
          const hasPlayers = mode === 'computer'
            ? ['red', 'green'].includes(color)
            : Object.values(gameState.colorMap || {}).includes(color);
          if (!hasPlayers) return null;
          return (
            <View key={color} style={[styles.playerRow, { borderColor: COLOR_HEX[color] }]}>
              <Text style={[styles.colorLabel, { color: COLOR_HEX[color] }]}>
                {color.charAt(0).toUpperCase() + color.slice(1)}:
              </Text>
              <View style={styles.piecesRow}>
                {pArr.map((pos, i) => {
                  const isSelectable = selected?.canMove?.includes(i) && selected?.color === color;
                  return (
                    <TouchableOpacity key={i}
                      style={[styles.piece,
                        { backgroundColor: COLOR_HEX[color] },
                        pos === 0 && styles.pieceHome,
                        pos === 57 && styles.pieceDone,
                        isSelectable && styles.pieceSelectable,
                      ]}
                      onPress={() => {
                        if (isSelectable) {
                          doMove(i, selected.val, selected.pieces, selected.color);
                        }
                      }}
                    >
                      <Text style={styles.pieceText}>
                        {pos === 0 ? '🏠' : pos === 57 ? '✅' : pos}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          );
        })}

        {selected && <Text style={styles.selectHint}>Upar apna piece tap karo move karne ke liye!</Text>}

        {/* Roll button */}
        {isMyTurn && !selected && !gameState.winner && (
          <TouchableOpacity style={[styles.rollBtn, rolling && styles.rollBtnDisabled]}
            onPress={rollAndMove} disabled={rolling}>
            <Text style={styles.rollBtnText}>{rolling ? 'Roll ho raha hai...' : '🎲 Dice Roll Karo!'}</Text>
          </TouchableOpacity>
        )}

        {/* Chat button */}
        {mode === 'room' && (
          <TouchableOpacity style={styles.chatToggleBtn} onPress={() => setShowChat(!showChat)}>
            <Text style={styles.chatToggleTxt}>💬 Chat ({chatMessages.length})</Text>
          </TouchableOpacity>
        )}

        {/* Mini chat */}
        {mode === 'room' && showChat && (
          <View style={styles.chatBox}>
            <View style={styles.chatTargetRow}>
              <Text style={{ color: '#888', fontSize: 12 }}>Kisko:</Text>
              <TouchableOpacity style={[styles.targetBtn, chatTarget === 'all' && styles.targetBtnActive]}
                onPress={() => setChatTarget('all')}>
                <Text style={styles.targetBtnTxt}>Sabko</Text>
              </TouchableOpacity>
              {Object.entries(playerNames).map(([col, nm]) => (
                col !== myColor && (
                  <TouchableOpacity key={col}
                    style={[styles.targetBtn, chatTarget === col && styles.targetBtnActive,
                      { borderColor: COLOR_HEX[col] }]}
                    onPress={() => setChatTarget(col)}>
                    <Text style={[styles.targetBtnTxt, { color: COLOR_HEX[col] }]}>{nm}</Text>
                  </TouchableOpacity>
                )
              ))}
            </View>
            <View style={styles.chatMessages}>
              {chatMessages.slice(-5).map(m => (
                <Text key={m.id} style={[styles.chatMsgTxt, { color: COLOR_HEX[m.fromColor] || '#fff' }]}>
                  {m.from}: {m.text}
                </Text>
              ))}
            </View>
            <View style={styles.chatInputRow}>
              <TextInput style={styles.chatInput} value={chatMsg} onChangeText={setChatMsg}
                placeholder="Message..." placeholderTextColor="#555" />
              <TouchableOpacity style={styles.chatSendBtn} onPress={sendChatMsg}>
                <Text style={{ color: '#fff' }}>➤</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  lobby: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a2e', padding: 20 },
  lobbyTitle: { color: '#fff', fontSize: 32, fontWeight: 'bold', marginBottom: 30 },
  lobbyBtn: { width: '100%', padding: 16, borderRadius: 14, alignItems: 'center', marginBottom: 14 },
  lobbyBtnText: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
  joinRow: { flexDirection: 'row', width: '100%', gap: 10, marginTop: 6 },
  joinInput: { flex: 1, backgroundColor: '#16213e', color: '#fff', borderRadius: 12, padding: 14, fontSize: 15, borderWidth: 1, borderColor: '#0f3460' },
  joinBtn: { backgroundColor: '#00bcd4', borderRadius: 12, padding: 14, justifyContent: 'center' },
  joinBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  roomCodeText: { color: '#ff6b35', fontSize: 36, fontWeight: 'bold', letterSpacing: 4, marginVertical: 10 },
  waitText: { color: '#888', fontSize: 15, marginBottom: 20 },
  waitSubText: { color: '#aaa', fontSize: 13, marginTop: 10 },
  playerName: { color: '#4caf50', fontSize: 15, marginTop: 5 },
  turnBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderWidth: 1, margin: 10, borderRadius: 14 },
  turnText: { fontWeight: 'bold', fontSize: 16 },
  diceDisplay: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  boardScroll: { flex: 1, padding: 10 },
  playerRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#16213e', borderRadius: 14, padding: 12, marginBottom: 10, borderWidth: 1.5 },
  colorLabel: { fontWeight: 'bold', fontSize: 14, width: 55 },
  piecesRow: { flexDirection: 'row', gap: 8, flex: 1, flexWrap: 'wrap' },
  piece: { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
  pieceHome: { opacity: 0.5 },
  pieceDone: { borderColor: '#ffd700', borderWidth: 3 },
  pieceSelectable: { borderColor: '#fff', borderWidth: 3, transform: [{ scale: 1.15 }], shadowColor: '#fff', shadowOpacity: 0.8, shadowRadius: 8, elevation: 8 },
  pieceText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  selectHint: { color: '#ffd700', textAlign: 'center', fontSize: 13, marginVertical: 8 },
  rollBtn: { backgroundColor: '#ff6b35', padding: 16, borderRadius: 14, alignItems: 'center', marginVertical: 12 },
  rollBtnDisabled: { backgroundColor: '#555' },
  rollBtnText: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
  chatToggleBtn: { backgroundColor: '#0f3460', padding: 12, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  chatToggleTxt: { color: '#fff', fontWeight: 'bold' },
  chatBox: { backgroundColor: '#16213e', borderRadius: 14, padding: 12, marginTop: 8, borderWidth: 1, borderColor: '#0f3460' },
  chatTargetRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' },
  targetBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1, borderColor: '#0f3460' },
  targetBtnActive: { backgroundColor: '#ff6b3530', borderColor: '#ff6b35' },
  targetBtnTxt: { color: '#fff', fontSize: 12 },
  chatMessages: { maxHeight: 100, marginBottom: 8 },
  chatMsgTxt: { fontSize: 13, marginBottom: 3 },
  chatInputRow: { flexDirection: 'row', gap: 8 },
  chatInput: { flex: 1, backgroundColor: '#0f3460', color: '#fff', borderRadius: 10, padding: 10, fontSize: 14 },
  chatSendBtn: { backgroundColor: '#ff6b35', borderRadius: 10, padding: 10, justifyContent: 'center' },
});
