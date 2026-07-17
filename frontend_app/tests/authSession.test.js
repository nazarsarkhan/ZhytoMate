import assert from 'node:assert/strict';
import test from 'node:test';
import { performLogout, subscribeToSessionInvalidation } from '../src/lib/authSession.js';

test('performLogout clears the session, notifies subscribers, and redirects once away from protected pages', () => {
  const calls = [];
  const unsubscribe = subscribeToSessionInvalidation(() => {
    calls.push('subscriber');
  });

  performLogout({
    clearSession: () => calls.push('clear'),
    currentPath: () => '/profile',
    replaceLocation: (path) => calls.push(`redirect:${path}`),
  });

  unsubscribe();

  assert.deepEqual(calls, ['clear', 'subscriber', 'redirect:/login']);
});

test('performLogout skips redirect when already on the login page', () => {
  const calls = [];

  performLogout({
    clearSession: () => calls.push('clear'),
    currentPath: () => '/login',
    replaceLocation: (path) => calls.push(`redirect:${path}`),
  });

  assert.deepEqual(calls, ['clear']);
});
