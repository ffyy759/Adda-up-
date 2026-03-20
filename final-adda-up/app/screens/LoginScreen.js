import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, StatusBar, Alert, ActivityIndicator } from 'react-native';
import { loginUser } from '../firebase/auth';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) { Alert.alert('Ruko!', 'Email aur password dono daalo!'); return; }
    setLoading(true);
    const result = await loginUser(email, password);
    setLoading(false);
    if (!result.success) Alert.alert('Galat!', 'Email ya password sahi nahi hai!');
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a2e" />
      <View style={styles.topBadge}><Text style={styles.madeInUP}>🧡 Made in UP</Text></View>
      <View style={styles.logoContainer}>
        <Text style={styles.logoText}>Adda UP</Text>
        <Text style={styles.tagline}>UP ka apna adda! 🔥</Text>
      </View>
      <View style={styles.formContainer}>
        <TextInput style={styles.input} placeholder="Email daalo" placeholderTextColor="#888"
          value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
        <TextInput style={styles.input} placeholder="Password daalo" placeholderTextColor="#888"
          value={password} onChangeText={setPassword} secureTextEntry />
        <TouchableOpacity style={[styles.loginBtn, loading && { opacity: 0.7 }]}
          onPress={handleLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.loginBtnText}>Login Karo 🚀</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={styles.signupLink} onPress={() => navigation.navigate('Signup')}>
          <Text style={styles.signupLinkText}>Naya account? <Text style={styles.signupHighlight}>Sign Up Karo</Text></Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  topBadge: { alignItems: 'center', paddingTop: 55, paddingBottom: 10 },
  madeInUP: { color: '#ff6b35', fontWeight: 'bold', fontSize: 13 },
  logoContainer: { alignItems: 'center', paddingVertical: 30 },
  logoText: { fontSize: 42, fontWeight: 'bold', color: '#ff6b35', letterSpacing: 2 },
  tagline: { color: '#888', fontSize: 15, marginTop: 6 },
  formContainer: { paddingHorizontal: 28, marginTop: 10 },
  input: { backgroundColor: '#16213e', color: '#fff', borderRadius: 12, padding: 15, marginBottom: 14, fontSize: 15, borderWidth: 1, borderColor: '#0f3460' },
  loginBtn: { backgroundColor: '#ff6b35', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 6 },
  loginBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  signupLink: { alignItems: 'center', marginTop: 20 },
  signupLinkText: { color: '#888', fontSize: 14 },
  signupHighlight: { color: '#ff6b35', fontWeight: 'bold' },
});
