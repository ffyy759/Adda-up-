import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';

const { width: SW } = Dimensions.get('window');
const COLS = 20, ROWS = 20;
const CELL = Math.floor((SW - 32) / COLS);

const randomFood = () => ({ x: Math.floor(Math.random()*COLS), y: Math.floor(Math.random()*ROWS) });

export default function SnakeGame() {
  const [snake, setSnake] = useState([{x:10,y:10}]);
  const [food, setFood] = useState(randomFood());
  const [dir, setDir] = useState({x:1,y:0});
  const [running, setRunning] = useState(false);
  const [score, setScore] = useState(0);
  const [dead, setDead] = useState(false);
  const dirRef = useRef({x:1,y:0});
  const timerRef = useRef(null);

  useEffect(() => {
    if (running) {
      timerRef.current = setInterval(tick, 180);
      return () => clearInterval(timerRef.current);
    }
  }, [running, snake]);

  const tick = () => {
    setSnake(prev => {
      const head = { x: prev[0].x + dirRef.current.x, y: prev[0].y + dirRef.current.y };
      if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS ||
        prev.some(s => s.x === head.x && s.y === head.y)) {
        setRunning(false); setDead(true); clearInterval(timerRef.current); return prev;
      }
      let newSnake = [head, ...prev];
      if (head.x === food.x && head.y === food.y) {
        setFood(randomFood()); setScore(s => s + 10);
      } else { newSnake.pop(); }
      return newSnake;
    });
  };

  const move = (dx, dy) => { dirRef.current = {x:dx,y:dy}; setDir({x:dx,y:dy}); };
  const reset = () => { setSnake([{x:10,y:10}]); setDir({x:1,y:0}); dirRef.current={x:1,y:0}; setScore(0); setDead(false); setRunning(false); setFood(randomFood()); };

  return (
    <View style={styles.container}>
      <Text style={styles.score}>Score: {score}</Text>
      <View style={[styles.board, {width: COLS*CELL, height: ROWS*CELL}]}>
        {snake.map((s,i) => (
          <View key={i} style={[styles.snakeCell, {left:s.x*CELL, top:s.y*CELL, width:CELL-1, height:CELL-1, backgroundColor: i===0?'#4caf50':'#81c784'}]} />
        ))}
        <View style={[styles.foodCell, {left:food.x*CELL, top:food.y*CELL, width:CELL-1, height:CELL-1}]} />
      </View>
      {dead && <Text style={styles.deadText}>💀 Game Over! Score: {score}</Text>}
      <View style={styles.controls}>
        <TouchableOpacity style={styles.dpad} onPress={() => move(0,-1)}><Text style={styles.dpadText}>▲</Text></TouchableOpacity>
        <View style={styles.dpadRow}>
          <TouchableOpacity style={styles.dpad} onPress={() => move(-1,0)}><Text style={styles.dpadText}>◄</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.dpad, {backgroundColor:'#ff6b35'}]} onPress={() => { if(dead) reset(); else setRunning(r=>!r); }}>
            <Text style={styles.dpadText}>{dead ? '🔄' : running ? '⏸' : '▶'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.dpad} onPress={() => move(1,0)}><Text style={styles.dpadText}>►</Text></TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.dpad} onPress={() => move(0,1)}><Text style={styles.dpadText}>▼</Text></TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex:1, alignItems:'center', paddingTop:16 },
  score: { color:'#fff', fontSize:18, fontWeight:'bold', marginBottom:10 },
  board: { backgroundColor:'#0f3460', position:'relative', borderWidth:2, borderColor:'#555' },
  snakeCell: { position:'absolute', borderRadius:2 },
  foodCell: { position:'absolute', backgroundColor:'#f44336', borderRadius:CELL/2 },
  deadText: { color:'#f44336', fontSize:16, fontWeight:'bold', marginTop:10 },
  controls: { alignItems:'center', marginTop:20 },
  dpadRow: { flexDirection:'row' },
  dpad: { width:56, height:56, backgroundColor:'#16213e', justifyContent:'center', alignItems:'center', margin:3, borderRadius:10, borderWidth:1, borderColor:'#0f3460' },
  dpadText: { color:'#fff', fontSize:22, fontWeight:'bold' },
});
