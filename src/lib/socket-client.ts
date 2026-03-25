import { io, Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from './types';

type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: GameSocket | null = null;

export function getSocket(): GameSocket {
  if (!socket) {
    const url = typeof window !== 'undefined' ? window.location.origin : '';
    socket = io(url, {
      path: '/api/socketio',
      transports: ['websocket', 'polling'],
    });
  }
  return socket;
}
