import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, PanResponder } from 'react-native';

const SIZE = 4;
const empty = () => Array(SIZE).fill(null).map(() => Array(SIZE).fill(0));
const addRandom = (g) => {
  const empties = [];
  g.forEach((r,i) => r.forEach((v,j) => { if (!v) empties.push([i,j]); }));
  if (!empties.length) return g;
  const [r,c] = empties[Math.floor(Math.random()*empties.length)];
  const ng = g.map(row=>[...row]);
  ng[r][c] = Math.random()<0.9?2:4;
  return ng;
};
const initGrid = () => { let g = empty(); g = addRandom(g); return addRandom(g); };
const slideRow = (row) => {
  const nums = row.filter(Boolean);
  for (let i = 0; i < nums.length-1; i++) {
    if (nums[i] === nums[i+1]) { nums[i] *= 2; nums.splice(i+1,1); }
  }
  while (nums.length < SIZE) nums.push(0);
  return nums;
};
const COLORS = { 0:'#cdc1b4', 2:'#eee4da', 4:'#ede0c8', 8:'#f2b179', 16:'#f59563', 32:'#f67c5f', 64:'#f65e3b', 128:'#edcf72', 256:'#edcc61', 512:'#edc850', 1024:'#edc53f', 2048:'#edc22e' };

export default function Game2048() {
  const [grid, setGrid] = useState(initGrid());
  const [score, setScore] = useState(0);

  const move = (dir) => {
    let g = grid.map(r=>[...r]);
    let sc = 0;
    const rotate = (g) => g[0].map((_,i) => g.map(r=>r[i]).reverse());
    if (dir==='left') g = g.map(slideRow);
    else if (dir==='right') g = g.map(r=>[...slideRow([...r].reverse())].reverse());
    else if (dir==='up') { g = rotate(rotate(rotate(g))); g = g.map(slideRow); g = rotate(g); }
    else { g = rotate(g); g = g.map(slideRow); g = rotate(rotate(rotate(g))); }
    setGrid(addRandom(g));
  };

  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: () => true,
    onPanResponderRelease: (_, gs) => {
      const { dx, dy } = gs;
      if (Math.abs(dx) > Math.abs(dy)) { if (dx > 30) move('right'); else if (dx < -30) move('left'); }
      else { if (dy > 30) move('down'); else if (dy < -30) move('up'); }
    },
  });

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      <View style={styles.header}>
        <Text style={styles.title}>2048</Text>
        <Text style={styles.score}>Score: {score}</Text>
      </View>
      <Text style={styles.hint}>Swipe karo tiles merge karne ke liye!</Text>
      <View style={styles.grid}>
        {grid.map((row, r) => (
          <View key={r} style={styles.row}>
            {row.map((val, c) => (
              <View key={c} style={[styles.cell, { backgroundColor: COLORS[val] || '#3c3a32' }]}>
                {val ? <Text style={[styles.cellText, val > 64 && { color: '#f9f6f2' }, val >= 1000 && { fontSize: 14 }]}>{val}</Text> : null}
              </View>
            ))}
          </View>
        ))}
      </View>
      <TouchableOpacity style={styles.resetBtn} onPress={() => { setGrid(initGrid()); setScore(0); }}>
        <Text style={styles.resetBtnText}>🔄 Naya Game</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex:1, alignItems:'center', paddingTop:16 },
  header: { flexDirection:'row', justifyContent:'space-between', width:'100%', paddingHorizontal:20, marginBottom:8 },
  title: { color:'#fff', fontSize:28, fontWeight:'bold' },
  score: { color:'#ffd700', fontSize:18, fontWeight:'bold' },
  hint: { color:'#888', fontSize:12, marginBottom:16 },
  grid: { backgroundColor:'#bbada0', borderRadius:8, padding:6 },
  row: { flexDirection:'row' },
  cell: { width:70, height:70, margin:5, borderRadius:6, justifyContent:'center', alignItems:'center' },
  cellText: { fontSize:20, fontWeight:'bold', color:'#776e65' },
  resetBtn: { backgroundColor:'#ff9800', borderRadius:12, padding:12, marginTop:20, paddingHorizontal:30 },
  resetBtnText: { color:'#fff', fontWeight:'bold', fontSize:15 },
});
