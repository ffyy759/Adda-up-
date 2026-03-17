import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Dimensions } from 'react-native';

const { width: SW } = Dimensions.get('window');
const CELL = Math.floor((SW - 32) / 8);
const INIT = [
  ['♜','♞','♝','♛','♚','♝','♞','♜'],
  ['♟','♟','♟','♟','♟','♟','♟','♟'],
  ['','','','','','','',''],
  ['','','','','','','',''],
  ['','','','','','','',''],
  ['','','','','','','',''],
  ['♙','♙','♙','♙','♙','♙','♙','♙'],
  ['♖','♘','♗','♕','♔','♗','♘','♖'],
];
const WHITE = ['♙','♖','♘','♗','♕','♔'];
const BLACK = ['♟','♜','♞','♝','♛','♚'];

export default function ChessGame() {
  const [board, setBoard] = useState(INIT.map(r => [...r]));
  const [selected, setSelected] = useState(null);
  const [turn, setTurn] = useState('white');

  const isWhite = p => WHITE.includes(p);
  const isBlack = p => BLACK.includes(p);

  const selectOrMove = (r, c) => {
    const piece = board[r][c];
    if (selected) {
      const [sr, sc] = selected;
      if (sr === r && sc === c) { setSelected(null); return; }
      const newBoard = board.map(row => [...row]);
      newBoard[r][c] = newBoard[sr][sc];
      newBoard[sr][sc] = '';
      setBoard(newBoard);
      setSelected(null);
      setTurn(turn === 'white' ? 'black' : 'white');
    } else {
      if ((turn === 'white' && isWhite(piece)) || (turn === 'black' && isBlack(piece))) {
        setSelected([r, c]);
      }
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.turnText}>{turn === 'white' ? '⚪ White ki baari' : '⚫ Black ki baari'}</Text>
      <View style={styles.board}>
        {board.map((row, r) => (
          <View key={r} style={styles.row}>
            {row.map((piece, c) => {
              const isLight = (r + c) % 2 === 0;
              const isSel = selected?.[0] === r && selected?.[1] === c;
              return (
                <TouchableOpacity key={c}
                  style={[styles.cell,
                    { backgroundColor: isSel ? '#ff6b3577' : isLight ? '#f0d9b5' : '#b58863' }]}
                  onPress={() => selectOrMove(r, c)}>
                  <Text style={[styles.piece, isWhite(piece) ? styles.white : styles.black]}>{piece}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
      <TouchableOpacity style={styles.resetBtn} onPress={() => { setBoard(INIT.map(r=>[...r])); setTurn('white'); setSelected(null); }}>
        <Text style={styles.resetBtnText}>🔄 Reset</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', paddingTop: 20 },
  turnText: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 14 },
  board: { borderWidth: 2, borderColor: '#555' },
  row: { flexDirection: 'row' },
  cell: { width: CELL, height: CELL, justifyContent: 'center', alignItems: 'center' },
  piece: { fontSize: CELL * 0.65 },
  white: { color: '#fff', textShadowColor: '#333', textShadowRadius: 2, textShadowOffset: {width:1,height:1} },
  black: { color: '#111' },
  resetBtn: { backgroundColor: '#9c27b0', borderRadius: 12, padding: 12, marginTop: 20, paddingHorizontal: 30 },
  resetBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
});
