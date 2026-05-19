import { io } from 'socket.io-client';

const BACKEND_URL = 'https://munich-shuttle-lending-lives.trycloudflare.com'; 

export const socket = io(BACKEND_URL, {
  autoConnect: false,
  transports: ['websocket'], 
});