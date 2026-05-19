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
  Platform,
} from 'react-native';
import { socket } from '../services/socket';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

type RootStackParamList = {
  Login: undefined;
  Battle: { roomId: string; nickname: string; playerClass: string };
};

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Login'>;
};

const CLASSES = [
  { 
    id: 'front-end', 
    name: 'Front-end', 
    color: '#38bdf8', 
    short: 'UI/UX & Layout',
    desc: 'Os artistas da interface. Você é responsável por manter a estrutura visual intacta. Seus ataques são rápidos e focados no lado do cliente.',
    perk: 'Dano crítico contra Layout Shifts e bugs de CSS.' 
  },
  { 
    id: 'back-end', 
    name: 'Back-end', 
    color: '#818cf8', 
    short: 'Lógica & APIs',
    desc: 'Os arquitetos da lógica. Você lida com o peso do processamento de dados. Seus ataques causam dano consistente e estrutural.',
    perk: 'Especialista em resolver Deadlocks no Banco de Dados.' 
  },
  { 
    id: 'devops', 
    name: 'DevOps', 
    color: '#f59e0b', 
    short: 'Infra & Deploy',
    desc: 'Os guardiões da infraestrutura. Você mantém o servidor respirando. Classe vital para a sobrevivência do time em momentos de caos.',
    perk: 'Restaura a estabilidade apagando picos de CPU.' 
  },
  { 
    id: 'qa', 
    name: 'QA Tester', 
    color: '#10b981', 
    short: 'Testes & Qualidade',
    desc: 'Os caçadores de bugs. Nada escapa aos seus olhos. Você encontra as fraquezas sistêmicas que as outras classes deixam passar.',
    perk: 'Habilidade única de barrar regressões em Produção.' 
  },
  { 
    id: 'security', 
    name: 'Security', 
    color: '#f43f5e', 
    short: 'Segurança & WAF',
    desc: 'A linha de defesa final. Você protege a aplicação contra ameaças externas e injeções maliciosas.',
    perk: 'Neutraliza ataques de Brute Force e SQL Injection.' 
  },
];

export default function LoginScreen({ navigation }: Props) {
  const [roomId, setRoomId] = useState('');
  const [nickname, setNickname] = useState('');
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
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
    if (!roomId.trim() || !nickname.trim() || !selectedClassId) {
      Alert.alert('Atenção', 'Preencha o ID da Sala, seu Nickname e escolha uma Classe.');
      return;
    }

    setIsConnecting(true);
    socket.connect();
    
    socket.emit('join_game', { 
      nickname: nickname.trim(), 
      class: selectedClassId, 
      room_id: roomId.trim().toUpperCase() 
    });
  };

  const selectedClassDetails = CLASSES.find(c => c.id === selectedClassId);

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        
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
                  selectedClassId === cls.id && { borderColor: cls.color, backgroundColor: `${cls.color}20` }
                ]}
                onPress={() => setSelectedClassId(cls.id)}
              >
                <Text style={[styles.className, selectedClassId === cls.id && { color: cls.color }]}>
                  {cls.name}
                </Text>
                <Text style={styles.classDesc}>{cls.short}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Um bloco reservado para manter a altura estável */}
          <View style={styles.detailsContainer}>
            {selectedClassDetails ? (
              <View style={[styles.detailsPanel, { borderColor: selectedClassDetails.color }]}>
                <Text style={styles.detailsTitle}>Informações da Classe</Text>
                <Text style={styles.detailsDesc}>{selectedClassDetails.desc}</Text>
                <View style={styles.perkBadge}>
                  <Text style={[styles.perkText, { color: selectedClassDetails.color }]}>
                    ✨ Habilidade: {selectedClassDetails.perk}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.detailsPlaceholder}>
                <Text style={styles.placeholderText}>Selecione uma classe para ver seus detalhes.</Text>
              </View>
            )}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0b10', 
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 60, 
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
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
  detailsContainer: {
    marginTop: 20,
    minHeight: 140, // Mantém a altura reservada para não pular
  },
  detailsPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 16,
  },
  placeholderText: {
    color: '#475569',
    fontSize: 13,
    textAlign: 'center',
  },
  detailsPanel: {
    padding: 16,
    backgroundColor: '#111827', 
    borderWidth: 1,
    borderRadius: 12,
    borderStyle: 'dashed', 
  },
  detailsTitle: {
    color: '#cbd5e1',
    fontWeight: 'bold',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  detailsDesc: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 12,
  },
  perkBadge: {
    backgroundColor: '#1e293b',
    padding: 8,
    borderRadius: 8,
  },
  perkText: {
    fontSize: 12,
    fontWeight: 'bold',
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