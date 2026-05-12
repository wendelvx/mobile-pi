import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView, 
  Alert,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { socket } from '../services/socket';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

// Tipagem da rota para o TypeScript reconhecer o navigation.replace
type RootStackParamList = {
  Login: undefined;
  Battle: { roomId: string; nickname: string; playerClass: string };
};

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Login'>;
};

const CLASSES = [
  { id: 'front-end', name: 'Front-end', color: '#38bdf8', desc: 'UI/UX & Layout' },
  { id: 'back-end', name: 'Back-end', color: '#818cf8', desc: 'Lógica & APIs' },
  { id: 'devops', name: 'DevOps', color: '#f59e0b', desc: 'Infra & Deploy' },
  { id: 'qa', name: 'QA Tester', color: '#10b981', desc: 'Testes & Qualidade' },
  { id: 'security', name: 'Security', color: '#f43f5e', desc: 'Segurança & WAF' },
];

export default function LoginScreen({ navigation }: Props) {
  const [roomId, setRoomId] = useState('');
  const [nickname, setNickname] = useState('');
  const [selectedClass, setSelectedClass] = useState<string | null>(null); // Tipagem adicionada
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    socket.off('joined');
    socket.off('game_error');

    socket.on('joined', (data) => {
      setIsConnecting(false);
      navigation.replace('Battle', { 
        roomId: data.room_id, 
        nickname: data.nickname, 
        playerClass: data.playerClass 
      });
    });

    socket.on('game_error', (data) => {
      setIsConnecting(false);
      socket.disconnect();
      Alert.alert('Acesso Negado', data.message);
    });

    return () => {
      socket.off('joined');
      socket.off('game_error');
    };
  }, [navigation]);

  const handleJoin = () => {
    if (!roomId.trim() || !nickname.trim() || !selectedClass) {
      Alert.alert('Atenção', 'Preencha o ID da Sala, seu Nickname e escolha uma Classe.');
      return;
    }

    setIsConnecting(true);
    socket.connect();
    
    socket.emit('join_game', { 
      nickname: nickname.trim(), 
      class: selectedClass, 
      room_id: roomId.trim() 
    });
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        <View style={styles.header}>
          <Text style={styles.title}>DUNGEON <Text style={styles.highlight}>MASTER</Text></Text>
          <Text style={styles.subtitle}>Acesso ao Terminal de Batalha</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>ID DA SALA</Text>
          <TextInput 
            style={styles.input}
            placeholder="Ex: ADS-5-NOITE"
            placeholderTextColor="#475569"
            value={roomId}
            onChangeText={setRoomId}
            autoCapitalize="characters"
          />

          <Text style={styles.label}>NICKNAME</Text>
          <TextInput 
            style={styles.input}
            placeholder="Seu apelido na rede"
            placeholderTextColor="#475569"
            value={nickname}
            onChangeText={setNickname}
            maxLength={15}
          />

          <Text style={styles.label}>CLASSE TÉCNICA</Text>
          <View style={styles.classGrid}>
            {CLASSES.map((cls) => (
              <TouchableOpacity 
                key={cls.id}
                style={[
                  styles.classCard, 
                  selectedClass === cls.id && { borderColor: cls.color, backgroundColor: `${cls.color}20` }
                ]}
                onPress={() => setSelectedClass(cls.id)}
              >
                <Text style={[styles.className, selectedClass === cls.id && { color: cls.color }]}>
                  {cls.name}
                </Text>
                <Text style={styles.classDesc}>{cls.desc}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity 
          style={[styles.button, isConnecting && styles.buttonDisabled]}
          onPress={handleJoin}
          disabled={isConnecting}
        >
          <Text style={styles.buttonText}>
            {isConnecting ? 'CONECTANDO...' : 'INICIAR SESSÃO'}
          </Text>
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ... manter o mesmo StyleSheet.create original abaixo ...
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0b10', // Dark Mode
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
    marginTop: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: '#f8fafc',
    letterSpacing: 2,
  },
  highlight: {
    color: '#6366f1',
  },
  subtitle: {
    color: '#64748b',
    marginTop: 8,
    fontSize: 14,
  },
  form: {
    marginBottom: 32,
  },
  label: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: 1,
  },
  input: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    color: '#f8fafc',
    padding: 16,
    fontSize: 16,
    marginBottom: 24,
  },
  classGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  classCard: {
    width: '48%',
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    padding: 16,
  },
  className: {
    color: '#cbd5e1',
    fontWeight: 'bold',
    fontSize: 14,
    marginBottom: 4,
  },
  classDesc: {
    color: '#64748b',
    fontSize: 11,
  },
  button: {
    backgroundColor: '#6366f1',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonDisabled: {
    backgroundColor: '#4338ca',
    opacity: 0.7,
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 1,
  },
});