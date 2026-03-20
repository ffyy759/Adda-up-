import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { auth } from './app/firebase/config';
import { onAuthStateChanged } from 'firebase/auth';
import { View, ActivityIndicator, Platform } from 'react-native';

import LoginScreen from './app/screens/LoginScreen';
import SignupScreen from './app/screens/SignupScreen';
import HomeScreen from './app/screens/HomeScreen';
import ProfileScreen from './app/screens/ProfileScreen';
import SearchScreen from './app/screens/SearchScreen';
import BattleScreen from './app/screens/BattleScreen';
import LeaderboardScreen from './app/screens/LeaderboardScreen';
import ChatScreen from './app/screens/ChatScreen';
import TerritoryScreen from './app/screens/TerritoryScreen';
import CoinsScreen from './app/screens/CoinsScreen';
import DMScreen from './app/screens/DMScreen';
import GroupChatScreen from './app/screens/GroupChatScreen';
import NotificationsScreen from './app/screens/NotificationsScreen';
import StoriesScreen from './app/screens/StoriesScreen';
import GamesScreen from './app/screens/GamesScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#16213e',
          borderTopColor: '#0f3460',
          borderTopWidth: 1,
          height: Platform.OS === 'android' ? 68 : 82,
          paddingBottom: Platform.OS === 'android' ? 12 : 22,
          paddingTop: 6,
          elevation: 10,
        },
        tabBarActiveTintColor: '#ff6b35',
        tabBarInactiveTintColor: '#555',
        tabBarLabelStyle: { fontSize: 18, marginBottom: 2 },
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: '🏠' }} />
      <Tab.Screen name="Battle" component={BattleScreen} options={{ tabBarLabel: '⚔️' }} />
      <Tab.Screen name="Games" component={GamesScreen} options={{ tabBarLabel: '🎮' }} />
      <Tab.Screen name="Leaderboard" component={LeaderboardScreen} options={{ tabBarLabel: '🏆' }} />
      <Tab.Screen name="Chat" component={ChatScreen} options={{ tabBarLabel: '💬' }} />
      <Tab.Screen name="Search" component={SearchScreen} options={{ tabBarLabel: '🔍' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarLabel: '👤' }} />
      <Tab.Screen name="Coins" component={CoinsScreen} options={{ tabBarLabel: '🪙' }} />
    </Tab.Navigator>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  if (loading) return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a2e' }}>
      <ActivityIndicator size="large" color="#ff6b35" />
    </View>
  );

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <Stack.Screen name="Main" component={MainTabs} />
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Signup" component={SignupScreen} />
          </>
        )}
        <Stack.Screen name="DM" component={DMScreen} />
        <Stack.Screen name="GroupChat" component={GroupChatScreen} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} />
        <Stack.Screen name="Stories" component={StoriesScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
