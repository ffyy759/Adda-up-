import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, ScrollView, TextInput
} from 'react-native';
import { db, auth } from '../../firebase/config';
import {
  collection, addDoc, doc, onSnapshot,
  updateDoc, getDoc, serverTimestamp, query, where, getDocs
} from 'firebase/firestore';

const PIECES = {
  wK:'♔',wQ:'♕',wR:'♖',wB:'♗',wN:'♘',wP:'♙',
  bK:'♚',bQ:'♛',bR:'♜',bB:'♝',bN:'♞',bP:'♟'
};
const INIT_BOARD = [
  ['bR','bN','bB','bQ','bK','bB','bN','bR'],
  ['bP','bP','bP','bP','bP','bP','bP','bP'],
  [null,null,null,null,null,null,null,null],
  [null,null,null,null,null,null,null,null],
  [null,null,null,null,null,null,null,null],
  [null,null,null,null,null,null,null,null],
  ['wP','wP','wP','wP','wP','wP','wP','wP'],
  ['wR','wN','wB','wQ','wK','wB','wN','wR'],
];

function cloneBoard(b) { return b.map(r => [...r]); }
function pieceColor(p) { return p ? p[0] : null; }

function getValidMoves(board, r, c, piece) {
  const moves = [];
  const col = pieceColor(piece);
  const type = piece[1];
  const opp = col === 'w' ? 'b' : 'w';
  const addIfValid = (nr, nc) => {
    if (nr < 0 || nr > 7 || nc < 0 || nc > 7) return false;
    const target = board[nr][nc];
    if (target && pieceColor(target) === col) return false;
    moves.push([nr, nc]);
    return !target; // false if blocked
  };

  if (type === 'P') {
    const dir = col === 'w' ? -1 : 1;
    const startRow = col === 'w' ? 6 : 1;
    if (!board[r+dir]?.[c]) {
      moves.push([r+dir, c]);
      if (r === startRow && !board[r+dir*2]?.[c]) moves.push([r+dir*2, c]);
    }
    [-1,1].forEach(dc => {
      if (board[r+dir]?.[c+dc] && pieceColor(board[r+dir][c+dc]) === opp)
        moves.push([r+dir, c+dc]);
    });
  } else if (type === 'N') {
    [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]].forEach(([dr,dc]) => addIfValid(r+dr, c+dc));
  } else if (type === 'R') {
    [[0,1],[0,-1],[1,0],[-1,0]].forEach(([dr,dc]) => {
      for(let i=1;i<8;i++) { if(!addIfValid(r+dr*i, c+dc*i)) break; }
    });
  } else if (type === 'B') {
    [[1,1],[1,-1],[-1,1],[-1,-1]].forEach(([dr,dc]) => {
      for(let i=1;i<8;i++) { if(!addIfValid(r+dr*i, c+dc*i)) break; }
    });
  } else if (type === 'Q') {
    [[0,1],[0,-1],[1,0],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]].forEach(([dr,dc]) => {
      for(let i=1;i<8;i++) { if(!addIfValid(r+dr*i, c+dc*i)) break; }
    });
  } else if (type === 'K') {
    [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]].forEach(([dr,dc]) => addIfValid(r+dr, c+dc));
  }
  return moves;
}

function computerChessMove(board) {
  // Simple AI: capture if possible, else random move
  const allMoves = [];
  const captureMoves = [];
  for(let r=0;r<8;r++) for(let c=0;c<8;c++) {
    if(board[r][c] && pieceColor(board[r][c]) === 'b') {
      const moves = getValidMoves(board, r, c, board[r][c]);
      moves.forEach(([nr,nc]) => {
        const entry = { from:[r,c], to:[nr,nc] };
        allMoves.push(entry);
        if(board[nr][nc] && pieceColor(board[nr][nc]) === 'w') captureMoves.push(entry);
      });
    }
  }
  const pool = captureMoves.length > 0 ? captureMoves : allMoves;
  if(pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

export default function ChessGame({ navigation }) {
  const [mode, setMode] = useState(null);
  const [board, setBoard] = useState(INIT_BOARD.map(r => [...r]));
  const [turn, setTurn] = useState('w');
  const [selected, setSelected] = useState(null);
  const [validMoves, setValidMoves] = useState([]);
  const [captured, setCaptured] = useState({ w: [], b: [] });
  const [roomId, setRoomId] = useState(null);
  const [roomCode, setRoomCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [myColor, setMyColor] = useState('w');
  const [gameStatus, setGameStatus] = useState('');
  const [waitingPlayers, setWaitingPlayers] = useState([]);
  const myUid = auth.currentUser?.uid;

  const startComputer = () => {
    setBoard(INIT_BOARD.map(r => [...r]));
    setTurn('w'); setSelected(null); setValidMoves([]);
    setCaptured({ w: [], b: [] }); setMyColor('w');
    setMode('computer'); setGameStatus('');
  };

  const createRoom = async () => {
    try {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const userDoc = await getDoc(doc(db, 'users', myUid));
      const username = userDoc.data()?.username || 'Player';
      const ref = await addDoc(collection(db, 'chess_rooms'), {
        code, status: 'waiting',
        players: { [myUid]: { color: 'w', name: username } },
        colorMap: { [myUid]: 'w' },
        board: INIT_BOARD, turn: 'w',
        captured: { w: [], b: [] },
        createdAt: serverTimestamp(),
      });
      setRoomId(ref.id); setRoomCode(code);
      setMyColor('w'); setMode('room');
      subscribeChessRoom(ref.id);
    } catch(e) { Alert.alert('Error', 'Room nahi bana!'); }
  };

  const joinRoom = async () => {
    try {
      const q = query(collection(db, 'chess_rooms'), where('code', '==', joinCode.toUpperCase()));
      const snap = await getDocs(q);
      if(snap.empty) { Alert.alert('Nahi mila!'); return; }
      const roomDoc = snap.docs[0];
      const data = roomDoc.data();
      const usedColors = Object.values(data.colorMap || {});
      const myNewColor = usedColors.includes('w') ? 'b' : 'w';
      const userDoc = await getDoc(doc(db, 'users', myUid));
      const username = userDoc.data()?.username || 'Player';
      await updateDoc(doc(db, 'chess_rooms', roomDoc.id), {
        [`players.${myUid}`]: { color: myNewColor, name: username },
        [`colorMap.${myUid}`]: myNewColor,
        status: 'playing',
      });
      setRoomId(roomDoc.id); setMyColor(myNewColor); setMode('room');
      subscribeChessRoom(roomDoc.id);
    } catch(e) { Alert.alert('Error', 'Join nahi ho saka!'); }
  };

  const subscribeChessRoom = (rid) => {
    onSnapshot(doc(db, 'chess_rooms', rid), (snap) => {
      if(!snap.exists()) return;
      const data = snap.data();
      setBoard(data.board || INIT_BOARD);
      setTurn(data.turn || 'w');
      setCaptured(data.captured || { w: [], b: [] });
      setGameStatus(data.winner ? `${data.winner === 'w' ? 'White' : 'Black'} Jeet Gaya! 🎉` : '');
      setWaitingPlayers(Object.values(data.players || {}).map(p => p.name));
    });
  };

  const handleSquarePress = async (r, c) => {
    const isMyTurn = mode === 'computer' ? turn === myColor :
      (/* room */true); // simplified
    if (!isMyTurn) return;

    const piece = board[r][c];

    if (selected) {
      const isValid = validMoves.some(([vr,vc]) => vr === r && vc === c);
      if (isValid) {
        await makeMove(selected[0], selected[1], r, c);
      } else if (piece && pieceColor(piece) === turn) {
        const moves = getValidMoves(board, r, c, piece);
        setSelected([r, c]);
        setValidMoves(moves);
      } else {
        setSelected(null); setValidMoves([]);
      }
    } else {
      if (piece && pieceColor(piece) === turn) {
        const moves = getValidMoves(board, r, c, piece);
        setSelected([r, c]);
        setValidMoves(moves);
      }
    }
  };

  const makeMove = async (fr, fc, tr, tc) => {
    const newBoard = cloneBoard(board);
    const movedPiece = newBoard[fr][fc];
    const capturedPiece = newBoard[tr][tc];
    newBoard[tr][tc] = movedPiece;
    newBoard[fr][fc] = null;

    // Pawn promotion
    if (movedPiece === 'wP' && tr === 0) newBoard[tr][tc] = 'wQ';
    if (movedPiece === 'bP' && tr === 7) newBoard[tr][tc] = 'bQ';

    const newCaptured = { ...captured };
    if (capturedPiece) {
      const capColor = pieceColor(capturedPiece);
      newCaptured[capColor] = [...(newCaptured[capColor] || []), capturedPiece];
    }

    const nextTurn = turn === 'w' ? 'b' : 'w';

    // Check if king captured
    const winner = capturedPiece === 'wK' ? 'b' : capturedPiece === 'bK' ? 'w' : null;

    setBoard(newBoard); setCaptured(newCaptured);
    setSelected(null); setValidMoves([]);

    if (mode === 'room' && roomId) {
      await updateDoc(doc(db, 'chess_rooms', roomId), {
        board: newBoard, turn: nextTurn, captured: newCaptured,
        ...(winner ? { winner } : {}),
      });
    } else {
      setTurn(nextTurn);
      if (winner) {
        Alert.alert('Game Over!', winner === 'w' ? '♔ White Jeet Gaya!' : '♚ Black Jeet Gaya!');
        return;
      }
      // Computer move
      if (nextTurn === 'b' && mode === 'computer') {
        setTimeout(() => {
          const move = computerChessMove(newBoard);
          if (move) {
            makeMove(move.from[0], move.from[1], move.to[0], move.to[1]);
          }
        }, 600);
      }
    }
  };

  const resetGame = () => {
    setBoard(INIT_BOARD.map(r => [...r]));
    setTurn('w'); setSelected(null); setValidMoves([]);
    setCaptured({ w: [], b: [] }); setGameStatus('');
  };

  if (!mode) {
    return (
      <View style={styles.lobby}>
        <Text style={styles.lobbyTitle}>♟️ Chess</Text>
        <TouchableOpacity style={[styles.lobbyBtn, { backgroundColor: '#9c27b0' }]} onPress={startComputer}>
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

  if (mode === 'room' && waitingPlayers.length < 2 && !gameStatus) {
    return (
      <View style={styles.lobby}>
        <Text style={styles.lobbyTitle}>⏳ Room Code:</Text>
        <Text style={styles.roomCodeText}>{roomCode}</Text>
        <Text style={styles.waitText}>Dost ka intezar hai...</Text>
        {waitingPlayers.map((n, i) => <Text key={i} style={styles.playerName}>✅ {n}</Text>)}
      </View>
    );
  }

  const BOARD_SIZE = 320;
  const SQ = BOARD_SIZE / 8;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#1a1a2e' }}>
      <View style={styles.chessHeader}>
        <Text style={styles.chessStatus}>
          {gameStatus || `${turn === 'w' ? '⚪' : '⚫'} ${turn === 'w' ? 'White' : 'Black'} ki baari`}
        </Text>
      </View>

      {/* Captured pieces */}
      <View style={styles.capturedRow}>
        <Text style={styles.capturedTxt}>⚫ {captured.b?.map(p => PIECES[p] || '').join(' ')}</Text>
      </View>

      {/* Board */}
      <View style={[styles.chessBoard, { width: BOARD_SIZE, height: BOARD_SIZE }]}>
        {board.map((row, r) =>
          row.map((piece, c) => {
            const isLight = (r + c) % 2 === 0;
            const isSelected = selected && selected[0] === r && selected[1] === c;
            const isValidMove = validMoves.some(([vr, vc]) => vr === r && vc === c);
            const isCapture = isValidMove && piece;
            return (
              <TouchableOpacity
                key={`${r}${c}`}
                style={[
                  styles.square,
                  { width: SQ, height: SQ, left: c * SQ, top: r * SQ },
                  isLight ? styles.sqLight : styles.sqDark,
                  isSelected && styles.sqSelected,
                  isValidMove && styles.sqValidMove,
                  isCapture && styles.sqCapture,
                ]}
                onPress={() => handleSquarePress(r, c)}
                activeOpacity={0.8}
              >
                {piece && (
                  <Text style={[styles.chessPiece, { fontSize: SQ * 0.62 }]}>
                    {PIECES[piece]}
                  </Text>
                )}
                {isValidMove && !piece && <View style={styles.moveDot} />}
              </TouchableOpacity>
            );
          })
        )}
      </View>

      <View style={styles.capturedRow}>
        <Text style={styles.capturedTxt}>⚪ {captured.w?.map(p => PIECES[p] || '').join(' ')}</Text>
      </View>

      <TouchableOpacity style={styles.resetBtn} onPress={resetGame}>
        <Text style={styles.resetBtnTxt}>🔄 Reset</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  lobby: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a2e', padding: 20 },
  lobbyTitle: { color: '#fff', fontSize: 32, fontWeight: 'bold', marginBottom: 30 },
  lobbyBtn: { width: '100%', padding: 16, borderRadius: 14, alignItems: 'center', marginBottom: 14 },
  lobbyBtnText: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
  joinRow: { flexDirection: 'row', width: '100%', gap: 10, marginTop: 6 },
  joinInput: { flex: 1, backgroundColor: '#16213e', color: '#fff', borderRadius: 12, padding: 14, fontSize: 15, borderWidth: 1, borderColor: '#0f3460' },
  joinBtn: { backgroundColor: '#00bcd4', borderRadius: 12, padding: 14, justifyContent: 'center' },
  joinBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  roomCodeText: { color: '#9c27b0', fontSize: 36, fontWeight: 'bold', letterSpacing: 4, marginVertical: 10 },
  waitText: { color: '#888', fontSize: 15, marginBottom: 20 },
  playerName: { color: '#4caf50', fontSize: 15, marginTop: 5 },
  chessHeader: { padding: 14, alignItems: 'center', backgroundColor: '#16213e' },
  chessStatus: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
  capturedRow: { paddingHorizontal: 20, paddingVertical: 6, minHeight: 30 },
  capturedTxt: { color: '#aaa', fontSize: 16 },
  chessBoard: { position: 'relative', alignSelf: 'center', borderWidth: 2, borderColor: '#0f3460', marginVertical: 8 },
  square: { position: 'absolute', justifyContent: 'center', alignItems: 'center' },
  sqLight: { backgroundColor: '#f0d9b5' },
  sqDark: { backgroundColor: '#b58863' },
  sqSelected: { backgroundColor: '#7fc97f' },
  sqValidMove: { backgroundColor: '#aed6ae' },
  sqCapture: { backgroundColor: '#e06060' },
  chessPiece: { textAlign: 'center' },
  moveDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#00000055' },
  resetBtn: { backgroundColor: '#9c27b0', padding: 14, borderRadius: 14, alignItems: 'center', margin: 16 },
  resetBtnTxt: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
