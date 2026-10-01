import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

const auth = vi.hoisted(() => ({ user: { uid: 'coach' } as { uid: string } | null, isLoadingAuth: false }));
vi.mock('./context/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => auth
}));
vi.mock('./context/RoomContext', () => ({
  RoomProvider: () => { throw new Error('Projection must not start room controller effects'); },
  useRoom: vi.fn()
}));
vi.mock('./context/GameContext', () => ({
  GameProvider: () => { throw new Error('Projection must not start player writes'); },
  useGame: vi.fn(), isPlayerStateForBoardGame: vi.fn()
}));
vi.mock('./views/lobby/DeveloperPortal', () => ({ DeveloperPortal: () => null }));
vi.mock('./components/modals/InstallPromptBanner', () => ({ InstallPromptBanner: () => null }));
vi.mock('./views/board/BoardProjectionView', () => ({ BoardProjectionView: ({ roomCode }: { roomCode: string }) => <div>map:{roomCode}</div> }));
vi.mock('./views/auth/AuthView', () => ({ AuthView: () => <div>login</div> }));
import App from './App';

afterEach(() => { cleanup(); window.history.replaceState({}, '', '/'); });
it.each([true, false])('keeps projection auth but excludes game providers (signed in: %s)', async signedIn => {
  auth.user = signedIn ? { uid: 'coach' } : null;
  window.history.replaceState({}, '', '/?boardRoom=123456');
  render(<App />);
  expect(await screen.findByText(signedIn ? 'map:123456' : 'login')).toBeInTheDocument();
});

it('does not mount room or player providers before login on the player route', async () => {
  auth.user = null;
  render(<App />);
  expect(await screen.findByText('login')).toBeInTheDocument();
});
