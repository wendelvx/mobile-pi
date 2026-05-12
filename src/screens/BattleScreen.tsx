import React, { useEffect, useState, useRef } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Alert,
  ActivityIndicator,
  Animated,
  Image
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { socket } from '../services/socket';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
// Ícone básico provisório caso não tenha lucide-react-native instalado
const LockIcon = () => <Text style={{fontSize: 40}}>🔒</Text>; 

type RootStackParamList = {
  Login: undefined;
  Battle: { roomId: string; nickname: string; playerClass: string };
};

type Props = NativeStackScreenProps<RootStackParamList, 'Battle'>;

export default function BattleScreen({ route, navigation }: Props) {
  const { roomId, nickname, playerClass } = route.params;

  const [gameState, setGameState] = useState<any>(null);
  const [onCooldown, setOnCooldown] = useState(false);
  
  // Estados para os Mini-Games
  const [sequenceInputs, setSequenceInputs] = useState<string[]>([]);
  const [clickCount, setClickCount] = useState(0);
  
  // Animação de erro no botão de ataque
  const shakeAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    socket.on('disconnect', () => {
      setTimeout(() => socket.connect(), 1000);
    });

    socket.on('boss_update', (data) => {
      setGameState(data);
      
      if (data.status === 'victory') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      
      // Se o incidente foi resolvido (ou acabou), limpa os estados dos mini-games locais
      if (!data.active_incident) {
        setSequenceInputs([]);
        setClickCount(0);
      }
    });

    socket.on('room_reset', () => {
       Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
       Alert.alert('Atenção, Turma!', 'O Professor resetou a masmorra. Preparem-se para um novo round!');
    });

    return () => {
      socket.off('boss_update');
      socket.off('room_reset');
      socket.off('disconnect');
    };
  }, [navigation]);

  // Função para fazer o botão tremer
  const triggerShake = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    Animated.sequence([
      Animated.timing(shakeAnimation, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: 0, duration: 50, useNativeDriver: true })
    ]).start();
  };

  const handleAttack = () => {
    if (onCooldown || gameState?.status !== 'fighting') return;

    // BLOQUEIO FRONT-END: Se há incidente de outra classe, o ataque é bloqueado na tela
    if (gameState.active_incident && gameState.active_incident.target_class !== playerClass) {
        triggerShake();
        return;
    }

    socket.emit('attack');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setOnCooldown(true);
    setTimeout(() => setOnCooldown(false), 150);
  };

  const submitResolution = (payload: string) => {
    socket.emit('resolve_incident', { payload });
  };

  // --- Funções dos Mini-Games ---
  const handleSequenceClick = (num: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newSeq = [...sequenceInputs, num];
    setSequenceInputs(newSeq);
    
    // Supondo que a solução do tipo SEQUENCE sempre tenha 3 dígitos (ex: 1-3-2)
    if (newSeq.length === 3) {
      submitResolution(newSeq.join('-'));
      setSequenceInputs([]); 
    }
  };

  const handleRapidClick = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const newCount = clickCount + 1;
    setClickCount(newCount);
    
    if (newCount.toString() === gameState.active_incident.solution) {
      submitResolution(newCount.toString());
    }
  };

  if (!gameState) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.loadingText}>Sincronizando com a Masmorra...</Text>
      </View>
    );
  }

  const hpPercentage = Math.max(0, (gameState.boss_hp / gameState.current_boss.max_hp) * 100);
  const hasIncident = gameState.active_incident !== null;
  const isMyIncident = hasIncident && gameState.active_incident.target_class === playerClass;
  const bossAvatarUrl = `https://api.dicebear.com/7.x/bottts/png?seed=${gameState.current_boss?.id || 'default'}&backgroundColor=1e293b`;

  return (
    <View style={styles.container}>
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.roomText}>SALA: {roomId}</Text>
        <Text style={styles.playerText}>{nickname} <Text style={styles.classText}>[{playerClass.toUpperCase()}]</Text></Text>
      </View>

      {/* Área do Boss COM FOTO */}
      <View style={styles.bossArea}>
        <Image source={{ uri: bossAvatarUrl }} style={styles.bossAvatar} />
        <Text style={styles.bossName}>{gameState.current_boss.name}</Text>
        <Text style={styles.hpText}>{gameState.boss_hp} HP</Text>
        
        <View style={styles.hpBarContainer}>
          <View style={[styles.hpBarFill, { width: `${hpPercentage}%`, backgroundColor: hpPercentage < 20 ? '#f43f5e' : '#6366f1' }]} />
        </View>
      </View>

      {/* ÁREA DE INCIDENTE INTERATIVA */}
      {hasIncident ? (
        isMyIncident ? (
          // SOU O ALVO DO INCIDENTE (Mini-games)
          <View style={[styles.incidentArea, styles.incidentActiveBorder]}>
            <Text style={styles.incidentTitle}>⚠️ AÇÃO REQUERIDA!</Text>
            <Text style={styles.incidentDesc}>{gameState.active_incident.description}</Text>
            <Text style={styles.incidentTimer}>⏳ {gameState.incident_timer}s restantes</Text>
            
            {/* Jogo 1: SEQUÊNCIA */}
            {gameState.active_incident.type === 'SEQUENCE' && (
              <View style={styles.miniGameContainer}>
                <Text style={styles.miniGameHint}>Aperte a sequência correta:</Text>
                <View style={styles.sequenceButtons}>
                  {['1', '2', '3'].map(num => (
                    <TouchableOpacity key={num} style={styles.seqBtn} onPress={() => handleSequenceClick(num)}>
                      <Text style={styles.seqBtnText}>{num}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.seqDisplay}>Digitado: {sequenceInputs.join(' - ') || '...'}</Text>
              </View>
            )}

            {/* Jogo 2: RAPID CLICK */}
            {gameState.active_incident.type === 'RAPID_CLICK' && (
              <View style={styles.miniGameContainer}>
                <Text style={styles.miniGameHint}>Esmague o botão para resolver!</Text>
                <TouchableOpacity style={styles.smashBtn} onPress={handleRapidClick}>
                  <Text style={styles.smashText}>ESMAGAR ({clickCount}/{gameState.active_incident.solution})</Text>
                </TouchableOpacity>
                <View style={styles.progressBar}>
                   <View style={{height: '100%', backgroundColor: '#10b981', width: `${(clickCount / parseInt(gameState.active_incident.solution || "1")) * 100}%`}} />
                </View>
              </View>
            )}

             {/* Jogo 3: PUZZLE (Múltipla escolha técnica) */}
             {gameState.active_incident.type === 'PUZZLE' && (
              <View style={styles.miniGameContainer}>
                <Text style={styles.miniGameHint}>Selecione a correção rápida:</Text>
                <View style={styles.puzzleGrid}>
                   <TouchableOpacity style={styles.puzzleBtn} onPress={() => submitResolution('DROP_TABLE')}><Text style={styles.puzzleText}>Drop Table</Text></TouchableOpacity>
                   <TouchableOpacity style={styles.puzzleBtn} onPress={() => submitResolution('PREPARED_STMT')}><Text style={styles.puzzleText}>Prepared Stmt</Text></TouchableOpacity>
                   <TouchableOpacity style={styles.puzzleBtn} onPress={() => submitResolution('RUN_SMOKE')}><Text style={styles.puzzleText}>Smoke Test</Text></TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        ) : (
          // INCIDENTE DE OUTRA CLASSE (Tela de bloqueio e espera)
          <View style={[styles.incidentArea, styles.incidentLockedBorder]}>
             <LockIcon />
             <Text style={styles.lockedTitle}>SISTEMA COMPROMETIDO</Text>
             <Text style={styles.lockedDesc}>Seus ataques falham na infraestrutura atual.</Text>
             <Text style={styles.lockedTarget}>
               Aguardando equipe de <Text style={{color: '#f43f5e', fontWeight: '900'}}>{gameState.active_incident.target_class.toUpperCase()}</Text>.
             </Text>
             <Text style={styles.incidentTimerLock}>⏳ {gameState.incident_timer}s para falha total</Text>
          </View>
        )
      ) : (
        // NÃO HÁ INCIDENTE (Espaçador invisível para layout não pular)
        <View style={styles.spacerBox} />
      )}

      {/* Botão Gigante de Ataque */}
      <View style={styles.actionArea}>
        <Animated.View style={{ transform: [{ translateX: shakeAnimation }] }}>
          <TouchableOpacity 
            style={[
              styles.attackButton, 
              (onCooldown || (hasIncident && !isMyIncident)) && styles.attackButtonDisabled,
              (hasIncident && !isMyIncident) && { backgroundColor: '#1e293b' }
            ]} 
            onPress={handleAttack}
            activeOpacity={0.7}
          >
            {(hasIncident && !isMyIncident) ? <LockIcon /> : <Text style={styles.attackText}>ATACAR</Text>}
          </TouchableOpacity>
        </Animated.View>
      </View>
      
      <View style={styles.logArea}>
        <Text style={styles.logText}>{gameState.last_action}</Text>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0b10', padding: 20, paddingTop: 50 },
  loadingContainer: { flex: 1, backgroundColor: '#0a0b10', justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#94a3b8', marginTop: 10 },
  header: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#1e293b', paddingBottom: 15, marginBottom: 10 },
  roomText: { color: '#64748b', fontWeight: 'bold', fontSize: 12 },
  playerText: { color: '#cbd5e1', fontSize: 12 },
  classText: { color: '#6366f1', fontWeight: 'bold' },
  
  bossArea: { alignItems: 'center', marginBottom: 20 },
  bossAvatar: { width: 80, height: 80, borderRadius: 16, backgroundColor: '#1e293b', marginBottom: 10, borderWidth: 1, borderColor: '#334155' },
  bossName: { color: '#f8fafc', fontSize: 20, fontWeight: '900', marginBottom: 5 },
  hpText: { color: '#94a3b8', fontSize: 14, marginBottom: 10 },
  hpBarContainer: { width: '100%', height: 16, backgroundColor: '#1e293b', borderRadius: 8, overflow: 'hidden' },
  hpBarFill: { height: '100%', borderRadius: 8 },
  
  spacerBox: { height: 190 }, 
  incidentArea: { borderRadius: 12, padding: 15, marginBottom: 10, height: 210, justifyContent: 'center' },
  incidentActiveBorder: { backgroundColor: '#4c0519', borderColor: '#e11d48', borderWidth: 1 },
  incidentLockedBorder: { backgroundColor: '#0f172a', borderColor: '#334155', borderWidth: 1, borderStyle: 'dashed' },
  incidentTitle: { color: '#fda4af', fontWeight: '900', fontSize: 16, marginBottom: 2, textAlign: 'center' },
  incidentDesc: { color: '#fecdd3', marginBottom: 5, textAlign: 'center', fontSize: 12 },
  incidentTimer: { color: '#f43f5e', fontWeight: 'bold', marginBottom: 10, textAlign: 'center', fontSize: 16 },
  incidentTimerLock: { color: '#64748b', fontWeight: 'bold', marginTop: 15, textAlign: 'center', fontSize: 14 },
  
  lockedTitle: { color: '#94a3b8', fontWeight: '900', fontSize: 18, textAlign: 'center', letterSpacing: 1 },
  lockedDesc: { color: '#64748b', textAlign: 'center', marginTop: 5, fontSize: 12 },
  lockedTarget: { color: '#cbd5e1', textAlign: 'center', marginTop: 10, fontSize: 12 },
  
  miniGameContainer: { alignItems: 'center' },
  miniGameHint: { color: '#f8fafc', marginBottom: 10, fontSize: 12, fontWeight: 'bold' },
  sequenceButtons: { flexDirection: 'row', gap: 15, justifyContent: 'center' },
  seqBtn: { backgroundColor: '#e11d48', width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  seqBtnText: { color: 'white', fontWeight: 'bold', fontSize: 20 },
  seqDisplay: { color: '#fda4af', marginTop: 10, fontFamily: 'monospace', letterSpacing: 2 },
  smashBtn: { backgroundColor: '#e11d48', width: '100%', padding: 15, borderRadius: 8, alignItems: 'center' },
  smashText: { color: 'white', fontWeight: 'bold', letterSpacing: 1 },
  progressBar: { width: '100%', height: 5, backgroundColor: '#1e293b', marginTop: 10, borderRadius: 3, overflow: 'hidden' },
  puzzleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  puzzleBtn: { backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#e11d48', padding: 8, borderRadius: 8 },
  puzzleText: { color: '#fda4af', fontSize: 12, fontWeight: 'bold' },
  
  actionArea: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  attackButton: { width: 180, height: 180, backgroundColor: '#6366f1', borderRadius: 90, justifyContent: 'center', alignItems: 'center', shadowColor: '#6366f1', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 20, elevation: 10 },
  attackButtonDisabled: { transform: [{ scale: 0.95 }], opacity: 0.8 },
  attackText: { color: '#fff', fontSize: 28, fontWeight: '900', letterSpacing: 2 },
  
  logArea: { marginTop: 'auto', paddingTop: 10, alignItems: 'center' },
  logText: { color: '#64748b', fontStyle: 'italic', textAlign: 'center', fontSize: 11 },
});