import React, { useEffect, useState, useRef } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Alert,
  ActivityIndicator,
  Animated,
  Image,
  Platform
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { socket } from '../services/socket';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

// Ícones básicos provisórios
const LockIcon = () => <Text style={{fontSize: 40}}>🔒</Text>; 
const HourglassIcon = () => <Text style={{fontSize: 40}}>⏳</Text>; // NOVO ÍCONE DE ESPERA
const TrophyIcon = () => <Text style={{fontSize: 80, marginBottom: 20}}>🏆</Text>;
const SkullIcon = () => <Text style={{fontSize: 80, marginBottom: 20}}>💀</Text>;

type RootStackParamList = {
  Login: undefined;
  Battle: { roomId: string; nickname: string; playerClass: string };
};

type Props = NativeStackScreenProps<RootStackParamList, 'Battle'>;

// MAPEAMENTO DAS FOTOS LOCAIS
const BOSS_AVATARS: Record<string, any> = {
  'infra_boss': require('../../assets/infra_boss.jpg'),
  'logic_boss': require('../../assets/logic_boss.jpg'),
  'security_boss': require('../../assets/security_boss.jpg'),
};

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
      } else if (data.status === 'defeat') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      
      // Se o incidente foi resolvido (ou acabou), limpa os estados dos mini-games locais
      if (!data.active_incident) {
        setSequenceInputs([]);
        setClickCount(0);
      }
    });

    socket.on('room_reset', () => {
       Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
       Alert.alert('Nova Tentativa', 'O Professor resetou a masmorra. Preparem-se para um novo round!');
    });

    return () => {
      socket.off('boss_update');
      socket.off('room_reset');
      socket.off('disconnect');
    };
  }, [navigation]);

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
    if (onCooldown) return;
    
    // NOVO: Se estiver aguardando o professor, treme o botão e recusa o ataque
    if (gameState?.status === 'waiting') {
        triggerShake();
        return;
    }
    
    if (gameState?.status !== 'fighting') return;

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

  const handleSequenceClick = (num: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newSeq = [...sequenceInputs, num];
    setSequenceInputs(newSeq);
    
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
      setClickCount(0);
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

  // ==========================================
  // TELAS DE FIM DE JOGO (VITÓRIA / DERROTA)
  // ==========================================
  if (gameState.status === 'victory' || gameState.status === 'defeat') {
    const isVictory = gameState.status === 'victory';
    return (
      <View style={[styles.endGameContainer, isVictory ? styles.bgVictory : styles.bgDefeat]}>
        {isVictory ? <TrophyIcon /> : <SkullIcon />}
        <Text style={styles.endGameTitle}>{isVictory ? 'SISTEMA RESTAURADO!' : 'SISTEMA COMPROMETIDO'}</Text>
        <Text style={styles.endGameSubtitle}>
          {isVictory ? 'A equipe derrotou o incidente final.' : 'A integridade da equipe chegou a zero.'}
        </Text>
        
        {/* Painel do MVP */}
        {gameState.mvp && (
          <View style={styles.mvpPanel}>
            <Text style={styles.mvpLabel}>🌟 DESTAQUE TÉCNICO (MVP) 🌟</Text>
            <Text style={styles.mvpName}>{gameState.mvp.nickname}</Text>
            <Text style={styles.mvpClass}>Esquadrão: {gameState.mvp.class.toUpperCase()}</Text>
            <Text style={styles.mvpDamage}>{gameState.mvp.damage} de Dano Causado</Text>
          </View>
        )}
      </View>
    );
  }

  // ==========================================
  // ESTADO NORMAL (EM COMBATE OU ESPERANDO)
  // ==========================================
  const bossHpPercent = Math.max(0, (gameState.boss_hp / gameState.current_boss.max_hp) * 100);
  const teamHpPercent = Math.max(0, ((gameState.team_hp || 100) / (gameState.max_team_hp || 100)) * 100); 

  const isWaiting = gameState.status === 'waiting'; // NOVO: Flag de espera
  const hasIncident = gameState.active_incident !== null;
  const isMyIncident = hasIncident && gameState.active_incident.target_class === playerClass;
  const bossAvatarSource = BOSS_AVATARS[gameState.current_boss?.id] || BOSS_AVATARS['infra_boss'];
  const isCriticalHp = bossHpPercent < 20 && !isWaiting;

  return (
    <View style={styles.container}>
      
      {/* Header COM BARRA DE VIDA DA EQUIPE */}
      <View style={styles.header}>
        <View style={{flex: 1}}>
          <Text style={styles.playerText}>{nickname} <Text style={styles.classText}>[{playerClass.toUpperCase()}]</Text></Text>
          <Text style={styles.roomText}>SALA: {roomId}</Text>
        </View>

        <View style={styles.teamHpContainer}>
          <Text style={styles.teamHpLabel}>❤️ EQUIPE</Text>
          <View style={styles.teamHpBar}>
            <View style={[styles.teamHpFill, { width: `${teamHpPercent}%`, backgroundColor: teamHpPercent < 30 ? '#dc2626' : '#22c55e' }]} />
          </View>
        </View>
      </View>

      {/* Área do Boss */}
      <View style={styles.bossArea}>
        <View style={[
            styles.avatarContainer, 
            isCriticalHp && styles.avatarCritical,
            isWaiting && { opacity: 0.5 } // Deixa o Boss meio apagado enquanto aguarda
        ]}>
            <Image 
                source={bossAvatarSource} 
                style={styles.bossAvatar} 
                resizeMode="cover" 
            />
        </View>
        
        <Text style={styles.bossName}>{gameState.current_boss.name}</Text>
        <Text style={[styles.hpText, isCriticalHp && { color: '#f43f5e', fontWeight: 'bold' }]}>
            {gameState.boss_hp} / {gameState.current_boss.max_hp} HP
        </Text>
        
        <View style={styles.hpBarContainer}>
          <View style={[styles.hpBarFill, { width: `${bossHpPercent}%`, backgroundColor: isCriticalHp ? '#f43f5e' : '#6366f1' }]} />
        </View>
      </View>

      {/* ÁREA DE INCIDENTE INTERATIVA / TELA DE ESPERA */}
      {isWaiting ? (
        // NOVO: PAINEL DE "AGUARDANDO START"
        <View style={[styles.incidentArea, styles.waitingBorder]}>
           <HourglassIcon />
           <Text style={styles.lockedTitle}>AGUARDANDO LIBERAÇÃO</Text>
           <Text style={styles.lockedDesc}>A masmorra está selada.</Text>
           <Text style={styles.lockedTarget}>
             Aguarde o Professor iniciar a batalha no painel principal para liberar os ataques!
           </Text>
        </View>
      ) : hasIncident ? (
        isMyIncident ? (
          <View style={[styles.incidentArea, styles.incidentActiveBorder]}>
            <Text style={styles.incidentTitle}>⚠️ INCIDENTE CRÍTICO!</Text>
            <Text style={styles.incidentDesc}>{gameState.active_incident.description}</Text>
            
            <Text style={styles.incidentProgress}>
              Progresso da Equipe: {gameState.active_incident.current_resolutions} / {gameState.active_incident.required_resolutions}
            </Text>

            <Text style={styles.incidentTimer}>⏳ {gameState.incident_timer}s restantes</Text>
            
            {/* 1. JOGO: SEQUENCE (HACKER TERMINAL) */}
            {gameState.active_incident.type === 'SEQUENCE' && (
              <View style={styles.terminalGameContainer}>
                <Text style={styles.terminalHint}>INJETAR PATCH DE CORREÇÃO:</Text>
                
                <View style={styles.terminalSlots}>
                  {[0, 1, 2].map((index) => (
                    <View key={index} style={styles.terminalSlot}>
                      <Text style={styles.terminalSlotText}>
                        {sequenceInputs[index] ? sequenceInputs[index] : '_'}
                      </Text>
                    </View>
                  ))}
                </View>

                <View style={styles.terminalKeyboard}>
                  {['1', '2', '3'].map(num => (
                    <TouchableOpacity key={num} style={styles.terminalBtn} onPress={() => handleSequenceClick(num)}>
                      <Text style={styles.terminalBtnText}>{num}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* 2. JOGO: RAPID CLICK (BOTÃO DE PÂNICO) */}
            {gameState.active_incident.type === 'RAPID_CLICK' && (
              <View style={styles.panicGameContainer}>
                <Text style={styles.panicHint}>SISTEMA SOBRECARREGADO! RESFRIE O SERVIDOR!</Text>
                
                <TouchableOpacity style={styles.panicBtn} onPress={handleRapidClick} activeOpacity={0.5}>
                  <Text style={styles.panicBtnIcon}>🔥</Text>
                  <Text style={styles.panicText}>PUMPAR RESFRIAMENTO</Text>
                </TouchableOpacity>

                <View style={styles.panicProgressBar}>
                   <View style={{
                     height: '100%', 
                     backgroundColor: (clickCount / parseInt(gameState.active_incident.solution || "1")) > 0.7 ? '#10b981' : '#f59e0b', 
                     width: `${(clickCount / parseInt(gameState.active_incident.solution || "1")) * 100}%`
                   }} />
                </View>
                <Text style={styles.panicCountText}>{clickCount} / {gameState.active_incident.solution} RPM</Text>
              </View>
            )}

             {/* 3. JOGO: PUZZLE (TRIAGEM DE CÓDIGO) */}
             {gameState.active_incident.type === 'PUZZLE' && (
              <View style={styles.puzzleGameContainer}>
                <Text style={styles.puzzleHint}>APLIQUE A SOLUÇÃO IMEDIATA:</Text>
                <View style={styles.puzzleCardsGrid}>
                   
                   <TouchableOpacity style={styles.puzzleCard} onPress={() => submitResolution('DROP_TABLE')}>
                     <Text style={styles.puzzleCardIcon}>💥</Text>
                     <Text style={styles.puzzleCardText}>Drop Table</Text>
                   </TouchableOpacity>

                   <TouchableOpacity style={styles.puzzleCard} onPress={() => submitResolution('PREPARED_STMT')}>
                     <Text style={styles.puzzleCardIcon}>🛡️</Text>
                     <Text style={styles.puzzleCardText}>Prepared Stmt</Text>
                   </TouchableOpacity>

                   <TouchableOpacity style={styles.puzzleCard} onPress={() => submitResolution('RUN_SMOKE')}>
                     <Text style={styles.puzzleCardIcon}>💨</Text>
                     <Text style={styles.puzzleCardText}>Smoke Test</Text>
                   </TouchableOpacity>

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
             
             <Text style={[styles.incidentProgress, {marginTop: 10}]}>
               Progresso: {gameState.active_incident.current_resolutions} / {gameState.active_incident.required_resolutions}
             </Text>

             <Text style={styles.incidentTimerLock}>⏳ {gameState.incident_timer}s para falha total</Text>
          </View>
        )
      ) : (
        // NÃO HÁ INCIDENTE E NÃO ESTÁ WAITING
        <View style={styles.spacerBox} />
      )}

      {/* Botão Gigante de Ataque (AGORA MUDA COM O WAITING) */}
      <View style={styles.actionArea}>
        <Animated.View style={{ transform: [{ translateX: shakeAnimation }] }}>
          <TouchableOpacity 
            style={[
              styles.attackButton, 
              (onCooldown || (hasIncident && !isMyIncident) || isWaiting) && styles.attackButtonDisabled,
              ((hasIncident && !isMyIncident) || isWaiting) && { backgroundColor: '#1e293b', shadowOpacity: 0 }
            ]} 
            onPress={handleAttack}
            activeOpacity={0.7}
          >
            {isWaiting ? <HourglassIcon /> : (hasIncident && !isMyIncident) ? <LockIcon /> : <Text style={styles.attackText}>ATACAR</Text>}
          </TouchableOpacity>
        </Animated.View>
      </View>
      
      <View style={styles.logArea}>
        <Text style={[styles.logText, isWaiting && {color: '#f59e0b', fontWeight: 'bold'}]}>
          {gameState.last_action}
        </Text>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0b10', padding: 20, paddingTop: 50 },
  loadingContainer: { flex: 1, backgroundColor: '#0a0b10', justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#94a3b8', marginTop: 10 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#1e293b', paddingBottom: 15, marginBottom: 10 },
  roomText: { color: '#64748b', fontWeight: 'bold', fontSize: 11, marginTop: 2 },
  playerText: { color: '#cbd5e1', fontSize: 13, fontWeight: 'bold' },
  classText: { color: '#6366f1', fontWeight: '900' },
  
  teamHpContainer: { width: 120 },
  teamHpLabel: { color: '#cbd5e1', fontSize: 10, fontWeight: 'bold', marginBottom: 4, textAlign: 'right' },
  teamHpBar: { height: 8, backgroundColor: '#1e293b', borderRadius: 4, overflow: 'hidden', borderWidth: 1, borderColor: '#334155' },
  teamHpFill: { height: '100%', borderRadius: 4 },

  endGameContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  bgVictory: { backgroundColor: '#064e3b' }, 
  bgDefeat: { backgroundColor: '#450a0a' }, 
  endGameTitle: { fontSize: 36, fontWeight: '900', color: 'white', marginBottom: 10, textAlign: 'center', letterSpacing: 1 },
  endGameSubtitle: { fontSize: 16, color: '#cbd5e1', textAlign: 'center', marginBottom: 40 },
  mvpPanel: { backgroundColor: 'rgba(0,0,0,0.4)', padding: 25, borderRadius: 16, borderWidth: 2, borderColor: '#fbbf24', width: '100%', alignItems: 'center' },
  mvpLabel: { color: '#fbbf24', fontWeight: '900', fontSize: 14, marginBottom: 15, letterSpacing: 2 },
  mvpName: { color: 'white', fontSize: 32, fontWeight: 'bold', textTransform: 'uppercase' },
  mvpClass: { color: '#cbd5e1', fontSize: 16, marginTop: 5, fontWeight: 'bold' },
  mvpDamage: { color: '#38bdf8', fontSize: 22, fontWeight: '900', marginTop: 15 },

  bossArea: { alignItems: 'center', marginBottom: 20 },
  avatarContainer: {
    width: 86, 
    height: 86, 
    borderRadius: 43, 
    backgroundColor: '#1e293b', 
    marginBottom: 12, 
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2, 
    borderColor: '#334155',
    overflow: 'hidden', 
  },
  avatarCritical: {
    borderColor: '#f43f5e',
    shadowColor: '#f43f5e',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 8,
  },
  bossAvatar: { width: '100%', height: '100%' },
  bossName: { color: '#f8fafc', fontSize: 22, fontWeight: '900', marginBottom: 5, letterSpacing: 1 },
  hpText: { color: '#94a3b8', fontSize: 14, marginBottom: 10 },
  hpBarContainer: { width: '100%', height: 16, backgroundColor: '#1e293b', borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#0f172a' },
  hpBarFill: { height: '100%', borderRadius: 8 },
  
  spacerBox: { height: 230 }, 
  incidentArea: { borderRadius: 12, padding: 15, marginBottom: 10, minHeight: 230, justifyContent: 'center', alignItems: 'center' },
  incidentActiveBorder: { backgroundColor: '#4c0519', borderColor: '#e11d48', borderWidth: 2 },
  incidentLockedBorder: { backgroundColor: '#0f172a', borderColor: '#334155', borderWidth: 1, borderStyle: 'dashed' },
  
  // NOVO: Borda temática para quando o jogo está aguardando o professor
  waitingBorder: { backgroundColor: '#1e293b', borderColor: '#f59e0b', borderWidth: 1, borderStyle: 'dashed' },

  incidentTitle: { color: '#fda4af', fontWeight: '900', fontSize: 18, marginBottom: 2, textAlign: 'center', letterSpacing: 1 },
  incidentDesc: { color: '#fecdd3', marginBottom: 5, textAlign: 'center', fontSize: 13 },
  
  incidentProgress: { color: '#38bdf8', fontWeight: 'bold', fontSize: 14, textAlign: 'center', marginBottom: 5 },
  
  incidentTimer: { color: '#f43f5e', fontWeight: 'bold', marginBottom: 10, textAlign: 'center', fontSize: 16 },
  incidentTimerLock: { color: '#64748b', fontWeight: 'bold', marginTop: 10, textAlign: 'center', fontSize: 14 },
  
  lockedTitle: { color: '#94a3b8', fontWeight: '900', fontSize: 18, textAlign: 'center', letterSpacing: 1, marginTop: 10 },
  lockedDesc: { color: '#64748b', textAlign: 'center', marginTop: 5, fontSize: 13 },
  lockedTarget: { color: '#cbd5e1', textAlign: 'center', marginTop: 10, fontSize: 13, paddingHorizontal: 20 },
  
  terminalGameContainer: { alignItems: 'center', backgroundColor: '#020617', padding: 10, borderRadius: 12, borderWidth: 1, borderColor: '#166534', width: '100%' },
  terminalHint: { color: '#22c55e', marginBottom: 10, fontSize: 11, fontWeight: '900', letterSpacing: 2, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  terminalSlots: { flexDirection: 'row', gap: 15, marginBottom: 15 },
  terminalSlot: { width: 40, height: 50, borderBottomWidth: 3, borderBottomColor: '#22c55e', justifyContent: 'center', alignItems: 'center', backgroundColor: '#064e3b' },
  terminalSlotText: { color: '#4ade80', fontSize: 28, fontWeight: 'bold', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  terminalKeyboard: { flexDirection: 'row', gap: 15 },
  terminalBtn: { backgroundColor: '#14532d', width: 50, height: 50, borderRadius: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#22c55e' },
  terminalBtnText: { color: '#bbf7d0', fontWeight: 'bold', fontSize: 24, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },

  panicGameContainer: { alignItems: 'center', width: '100%' },
  panicHint: { color: '#fb923c', marginBottom: 10, fontSize: 11, fontWeight: 'bold', letterSpacing: 1, textAlign: 'center' },
  panicBtn: { backgroundColor: '#dc2626', width: '100%', paddingVertical: 12, borderRadius: 12, alignItems: 'center', elevation: 6, borderWidth: 3, borderColor: '#991b1b', shadowColor: '#dc2626', shadowOpacity: 0.5, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, flexDirection: 'row', justifyContent: 'center', gap: 10 },
  panicBtnIcon: { fontSize: 24 },
  panicText: { color: 'white', fontWeight: '900', letterSpacing: 1, fontSize: 16 },
  panicProgressBar: { width: '100%', height: 10, backgroundColor: '#450a0a', marginTop: 15, borderRadius: 5, overflow: 'hidden', borderWidth: 1, borderColor: '#7f1d1d' },
  panicCountText: { color: '#fca5a5', marginTop: 5, fontSize: 12, fontWeight: 'bold' },

  puzzleGameContainer: { alignItems: 'center', width: '100%' },
  puzzleHint: { color: '#93c5fd', marginBottom: 10, fontSize: 12, fontWeight: 'bold', letterSpacing: 1 },
  puzzleCardsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', width: '100%' },
  puzzleCard: { backgroundColor: '#1e3a8a', width: '30%', paddingVertical: 15, borderRadius: 12, alignItems: 'center', borderWidth: 2, borderColor: '#3b82f6', elevation: 4 },
  puzzleCardIcon: { fontSize: 24, marginBottom: 5 },
  puzzleCardText: { color: '#bfdbfe', fontSize: 10, fontWeight: '900', textAlign: 'center', textTransform: 'uppercase' },
  
  actionArea: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  attackButton: { width: 190, height: 190, backgroundColor: '#6366f1', borderRadius: 95, justifyContent: 'center', alignItems: 'center', shadowColor: '#6366f1', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.6, shadowRadius: 20, elevation: 12, borderWidth: 4, borderColor: '#4f46e5' },
  attackButtonDisabled: { transform: [{ scale: 0.95 }], opacity: 0.9 },
  attackText: { color: '#fff', fontSize: 32, fontWeight: '900', letterSpacing: 3, textShadowColor: 'rgba(0, 0, 0, 0.3)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 },
  
  logArea: { marginTop: 'auto', paddingTop: 15, alignItems: 'center', borderTopWidth: 1, borderTopColor: '#1e293b' },
  logText: { color: '#64748b', fontStyle: 'italic', textAlign: 'center', fontSize: 12 },
});