import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';

import LoginScreen from './src/screens/LoginScreen';
import BattleScreen from './src/screens/BattleScreen';

// 1. Exportamos a tipagem das rotas para que o Stack saiba o que enviar para cada tela
export type RootStackParamList = {
  Login: undefined;
  Battle: { roomId: string; nickname: string; playerClass: string };
};

// 2. Passamos a tipagem na criação do Stack!
const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <Stack.Navigator 
        initialRouteName="Login"
        screenOptions={{
          // Deixa o visual mais imersivo e sem o cabeçalho padrão
          headerShown: false,
          contentStyle: { backgroundColor: '#0a0b10' } // Fundo escuro premium
        }}
      >
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Battle" component={BattleScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}