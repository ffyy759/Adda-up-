import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  StatusBar, ScrollView, Modal
} from 'react-native';
import LudoGame from '../components/games/LudoGame';
import ChessGame from '../components/games/ChessGame';
import SnakeGame from '../components/games/SnakeGame';
import Game2048 from '../components/games/Game2048';

const GAMES = [
  { id: 'ludo', name: 'Ludo', emoji: '🎲', color: '#ff6b35', desc: 'Friends ke saath ya Computer se khelo!', hasMultiplayer: true },
  { id: 'chess', name: 'Chess', emoji: '♟️', color: '#9c27b0', desc: 'Dimag lagao — Chess khelo!', hasMultiplayer: true },
  { id: 'snake', name: 'Snake', emoji: '🐍', color: '#4caf50', desc: 'Classic snake game!', hasMultiplayer: false },
  { id: 'game2048', name: '2048', emoji: '🔢', color: '#ff9800', desc: '2048 tak pahuncho!', hasMultiplayer: false },
];

export default function GamesScreen({ navigation }) {
  const [activeGame, setActiveGame] = useState(null);

  const openGame = (game) => setActiveGame(game);
  const closeGame = () => setActiveGame(null);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#16213e" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🎮 Games</Text>
        <Text style={styles.headerSub}>Khelo aur coins kamao!</Text>
      </View>

      <ScrollView contentContainerStyle={styles.grid}>
        {GAMES.map(game => (
          <TouchableOpacity key={game.id} style={[styles.gameCard, { borderColor: game.color }]}
            onPress={() => openGame(game)} activeOpacity={0.85}>
            <Text style={styles.gameEmoji}>{game.emoji}</Text>
            <Text style={[styles.gameName, { color: game.color }]}>{game.name}</Text>
            <Text style={styles.gameDesc}>{game.desc}</Text>
            {game.hasMultiplayer && (
              <View style={[styles.multiTag, { backgroundColor: game.color + '33' }]}>
                <Text style={[styles.multiTagText, { color: game.color }]}>🌐 Online</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Game Modal */}
      <Modal visible={!!activeGame} animationType="slide">
        <View style={{ flex: 1, backgroundColor: '#1a1a2e' }}>
          <View style={styles.gameHeader}>
            <TouchableOpacity onPress={closeGame} style={styles.backBtn}>
              <Text style={styles.backBtnText}>← Wapas</Text>
            </TouchableOpacity>
            <Text style={styles.gameTitle}>
              {activeGame?.emoji} {activeGame?.name}
            </Text>
            <View style={{ width: 80 }} />
          </View>
          {activeGame?.id === 'ludo' && <LudoGame navigation={navigation} />}
          {activeGame?.id === 'chess' && <ChessGame navigation={navigation} />}
          {activeGame?.id === 'snake' && <SnakeGame />}
          {activeGame?.id === 'game2048' && <Game2048 />}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  header: {
    padding: 16, paddingTop: 50, backgroundColor: '#16213e',
    borderBottomWidth: 1, borderBottomColor: '#0f3460',
  },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#ff6b35' },
  headerSub: { color: '#888', fontSize: 12, marginTop: 2 },
  grid: { padding: 14, flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  gameCard: {
    width: '47%', backgroundColor: '#16213e', borderRadius: 16,
    padding: 18, alignItems: 'center', borderWidth: 1.5,
  },
  gameEmoji: { fontSize: 40, marginBottom: 10 },
  gameName: { fontSize: 18, fontWeight: 'bold', marginBottom: 6 },
  gameDesc: { color: '#888', fontSize: 12, textAlign: 'center', lineHeight: 18 },
  multiTag: { marginTop: 10, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  multiTagText: { fontSize: 11, fontWeight: 'bold' },
  gameHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, paddingTop: 50, backgroundColor: '#16213e',
    borderBottomWidth: 1, borderBottomColor: '#0f3460',
  },
  backBtn: { padding: 4 },
  backBtnText: { color: '#ff6b35', fontWeight: 'bold', fontSize: 15 },
  gameTitle: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
});
