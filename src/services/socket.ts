import { io } from 'socket.io-client';

const BACKEND_URL = 'https://gap-practice-tim-can.trycloudflare.com'; 

export const socket = io(BACKEND_URL, {
  autoConnect: false,
  transports: ['websocket'], // Essencial para o Cloudflare Tunnel + React Native
});