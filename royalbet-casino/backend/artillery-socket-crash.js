/**
 * artillery-socket-crash.js
 *
 * Custom Artillery processor for testing 100 concurrent
 * Socket.io connections to the Crash game.
 *
 * Usage:
 *   artillery run artillery-socket.yml
 */

import { io } from 'socket.io-client';

const CRASH_EVENTS = ['crashMultiplier', 'crashResult', 'crashBets'];

let connectedCount = 0;
let failedCount = 0;

/**
 * Artillery custom function — called for each virtual user (VU)
 */
export function connectToCrash(context, events, done) {
  const token = process.env.TEST_JWT || context.vars.jwt;
  
  const socket = io('http://localhost:4000', {
    transports: ['websocket'],
    auth: { token },
    timeout: 5000,
    forceNew: true,
  });

  let connected = false;

  socket.on('connect', () => {
    connected = true;
    connectedCount++;
    
    // Join the crash game room
    socket.emit('join:crash');
    
    // Stay connected for 3 seconds to simulate a real betting session
    setTimeout(() => {
      socket.disconnect();
      done();
    }, 3000);
  });

  socket.on('connect_error', (err) => {
    failedCount++;
    events.emit('error', err.message);
    done(err);
  });

  socket.on('disconnect', () => {
    if (connected) connectedCount--;
  });

  // Listen for crash events
  CRASH_EVENTS.forEach(event => {
    socket.on(event, (data) => {
      events.emit('counter', `crash:${event}`, 1);
    });
  });
}

// Summary log
process.on('exit', () => {
  console.log(`\n[Socket Load Test] Connected: ${connectedCount}, Failed: ${failedCount}`);
});
