import io from 'socket.io-client';

const socket = io(import.meta.env.VITE_API_URL, {
  autoConnect: false,
  withCredentials: true
});

let currentAuthToken = null;

export function syncSocketAuth(token) {
  const normalizedToken = typeof token === 'string' && token.trim() ? token.trim() : null;
  const hasAuthChanged = normalizedToken !== currentAuthToken;

  currentAuthToken = normalizedToken;
  socket.auth = normalizedToken ? { token: `Bearer ${normalizedToken}` } : {};

  if (hasAuthChanged && socket.connected) {
    socket.disconnect();
  }

  if (!socket.connected) {
    socket.connect();
  }
}

export function disconnectSocket() {
  currentAuthToken = null;
  socket.auth = {};
  if (socket.connected) {
    socket.disconnect();
  }
}

export default socket;
