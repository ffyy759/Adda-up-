import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, PanResponder, Dimensions } from 'react-native';

const SIZE = 4;
function emptyGrid() { return Array(SIZE).fill(null).map(() => Array(SIZE).fill(0)); }

function addRandom(grid) {
  const empty = [];
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++)
      if (grid[r][c] === 0) empty.push([r, c]);
  if (empty.length === 0) return grid;
  const [r, c] = empty[Math.floor(Math.random() * empty.length)];
  const newGrid = grid.map(row => [...row]);
  newGrid[r][c] = Math.random() < 0.9 ? 2 : 4;
  return newGrid;
}

function slideRow(row) {
  let arr = row.filter(x => x !== 0);
  let score = 0;
  for (let i = 0; i < arr.length - 1; i++) {
    if (arr[i] === arr[i + 1]) {
      arr[i] *= 2; score += arr[i]; arr[i + 1] = 0;
    }
  }
  arr = arr.filter(x => x !== 0);
  while (arr.length < SIZE) arr.push(0);
  return { row: arr, score };
}

function move(grid, dir) {
  let newGrid = grid.map(r => [...r]);
  let totalScore = 0;
  let moved = false;

  if (dir === 'left') {
    for (let r = 0; r < SIZE; r++) {
      const { row, score } = slideRow(newGrid[r]);
      if (row.join() !== newGrid[r].join()) moved = true;
      newGrid[r] = row; totalScore += score;
    }
  } else if (dir === 'right') {
    for (let r = 0; r < SIZE; r++) {
      const { row, score } = slideRow([...newGrid[r]].reverse());
      const newRow = row.reverse();
      if (newRow.join() !== newGrid[r].join()) moved = true;
      newGrid[r] = newRow; totalScore += score;
    }
  } else if (dir === 'up') {
    for (let c = 0; c < SIZE; c++) {
      const col = newGrid.map(r => r[c]);
      const { row, score } = slideRow(col);
      if (row.join() !== col.join()) moved = true;
      row.forEach((val, r) => { newGrid[r][c] = val; });
      totalScore += score;
    }
  } else if (dir === 'down') {
    for (let c = 0; c < SIZE; c++) {
      const col = newGrid.map(r => r[c]).reverse();
      const { row, score } = slideRow(col);
      const newCol = row.reverse();
      if (newCol.join() !== newGrid.map(r => r[c]).join()) moved = true;
      newCol.forEach((val, r) => { newGrid[r][c] = val; });
      totalScore += score;
    }
  }

  if (moved) newGrid = addRandom(newGrid);
  return { grid: newGrid, score: totalScore, moved };
}

const TILE_COLORS = {
  0:'#cdc1b4', 2:'#eee4da', 4:'#ede0c8', 8:'#f2b179',
  16:'#f59563', 32:'#f67c5f', 64:'#f65e3b',
  128:'#edcf72', 256:'#edcc61', 512:'#edc850',
  1024:'#edc53f', 2048:'#edc22e',
};

export default function Game2048() {
  const initGrid = addRandom(addRandom(emptyGrid()));
  const [grid, setGrid] = useState(initGrid);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [won, setWon] = useState(false);
  const [over, setOver] = useState(false);
  const panRef = useRef(null);
  const SWIPE_MIN = 30;

  const handleMove = (dir) => {
    if (over) return;
    const { grid: newGrid, score: addScore, moved } = move(grid, dir);
    if (!moved) return;
    const newScore = score + addScore;
    setGrid(newGrid);
    setScore(newScore);
    if (newScore > best) setBest(newScore);
    if (newGrid.some(r => r.includes(2048))) setWon(true);
    // Check game over
    let canMove = false;
    for (let r = 0; r < SIZE && !canMove; r++)
      for (let c = 0; c < SIZE && !canMove; c++) {
        if (newGrid[r][c] === 0) canMove = true;
        if (r < SIZE-1 && newGrid[r][c] === newGrid[r+1][c]) canMove = true;
        if (c < SIZE-1 && newGrid[r][c] === newGrid[r][c+1]) canMove = true;
      }
    if (!canMove) setOver(true);
  };

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderRelease: (_, { dx, dy }) => {
      if (Math.abs(dx) < SWIPE_MIN && Math.abs(dy) < SWIPE_MIN) return;
      if (Math.abs(dx) > Math.abs(dy)) {
        handleMove(dx > 0 ? 'right' : 'left');
      } else {
        handleMove(dy > 0 ? 'down' : 'up');
      }
    },
  });

  const newGame = () => {
    setGrid(addRandom(addRandom(emptyGrid())));
    setScore(0); setWon(false); setOver(false);
  };

  const BOARD_W = Dimensions.get('window').width - 40;
  const TILE_W = (BOARD_W - 20) / 4 - 6;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>2048</Text>
        <View style={styles.scores}>
          <View style={styles.scoreBox}><Text style={styles.scoreLabel}>Score</Text><Text style={styles.scoreVal}>{score}</Text></View>
          <View style={styles.scoreBox}><Text style={styles.scoreLabel}>Best</Text><Text style={styles.scoreVal}>{best}</Text></View>
        </View>
      </View>
      <Text style={styles.hint}>Swipe karo tiles merge karne ke liye!</Text>

      {(won || over) && (
        <View style={styles.overlay}>
          <Text style={styles.overlayTxt}>{won ? '🎉 2048!' : '😢 Game Over!'}</Text>
          <TouchableOpacity style={styles.newGameBtn} onPress={newGame}>
            <Text style={styles.newGameTxt}>Naya Game</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={[styles.board, { width: BOARD_W, height: BOARD_W }]} {...panResponder.panHandlers}>
        {grid.map((row, r) =>
          row.map((val, c) => (
            <View key={`${r}${c}`} style={[
              styles.tile,
              { width: TILE_W, height: TILE_W, backgroundColor: TILE_COLORS[val] || '#3c3a32' }
            ]}>
              {val !== 0 && (
                <Text style={[styles.tileText, { fontSize: val >= 1024 ? TILE_W*0.28 : TILE_W*0.38, color: val <= 4 ? '#776e65' : '#f9f6f2' }]}>
                  {val}
                </Text>
              )}
            </View>
          ))
        )}
      </View>

      <TouchableOpacity style={styles.newGameBtn2} onPress={newGame}>
        <Text style={styles.newGameTxt}>🔄 Naya Game</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#faf8ef', alignItems: 'center', padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', alignItems: 'center', marginBottom: 8 },
  title: { fontSize: 40, fontWeight: 'bold', color: '#776e65' },
  scores: { flexDirection: 'row', gap: 10 },
  scoreBox: { backgroundColor: '#bbada0', borderRadius: 8, padding: 8, alignItems: 'center', minWidth: 60 },
  scoreLabel: { color: '#eee4da', fontSize: 11, fontWeight: 'bold' },
  scoreVal: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  hint: { color: '#776e65', fontSize: 13, marginBottom: 12 },
  board: { backgroundColor: '#bbada0', borderRadius: 8, flexDirection: 'row', flexWrap: 'wrap', padding: 6, gap: 6 },
  tile: { borderRadius: 6, justifyContent: 'center', alignItems: 'center', margin: 2 },
  tileText: { fontWeight: 'bold' },
  overlay: { position: 'absolute', top: 120, left: 20, right: 20, backgroundColor: '#edc22ecc', borderRadius: 16, padding: 20, alignItems: 'center', zIndex: 10 },
  overlayTxt: { fontSize: 32, fontWeight: 'bold', color: '#fff', marginBottom: 12 },
  newGameBtn: { backgroundColor: '#ff6b35', padding: 12, borderRadius: 10 },
  newGameBtn2: { backgroundColor: '#ff9800', padding: 14, borderRadius: 14, marginTop: 16 },
  newGameTxt: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
