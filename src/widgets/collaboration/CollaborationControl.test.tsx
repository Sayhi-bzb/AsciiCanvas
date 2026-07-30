import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEditorStore } from '@/domains/canvas/public';
import {
  collaborationRuntime,
  type CollaborationDescriptorV1,
  type CollaborationSnapshot,
} from '@/domains/collaboration/public';
import { setUiLanguage } from '@/shared/i18n';
import { CollaborationControl } from './CollaborationControl';

let snapshot: CollaborationSnapshot = {
  descriptor: null,
  status: 'idle',
  peers: [],
  error: null,
  hasLocalCopy: false,
};

vi.mock('./useCollaborationSnapshot', () => ({
  useCollaborationSnapshot: () => snapshot,
}));

describe('CollaborationControl', () => {
  const initialState = useEditorStore.getState();
  const clipboardWrite = vi.fn();

  const seedSession = (
    mode: 'freeform' | 'structured' | 'animation' = 'freeform',
    collaboration?: CollaborationDescriptorV1
  ) => {
    act(() => {
      useEditorStore.setState({
        activeCanvasId: 'collaboration-canvas',
        canvasMode: mode,
        canvasSessions: [
          {
            id: 'collaboration-canvas',
            name: 'Collaboration Canvas',
            mode,
            scene: [],
            grid: [],
            collaboration,
          },
        ],
      });
    });
  };

  const openMenu = () => {
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Collaboration' }), {
      button: 0,
      ctrlKey: false,
    });
  };

  beforeEach(() => {
    setUiLanguage('en');
    snapshot = {
      descriptor: null,
      status: 'idle',
      peers: [],
      error: null,
      hasLocalCopy: false,
    };
    clipboardWrite.mockReset();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: clipboardWrite },
    });
    window.history.replaceState(null, '', '/');
    seedSession();
  });

  afterEach(() => {
    cleanup();
    setUiLanguage('en');
    useEditorStore.setState(initialState, true);
    vi.restoreAllMocks();
    window.history.replaceState(null, '', '/');
  });

  it('opens a dropdown and keeps it open across P2P room actions', async () => {
    render(<CollaborationControl />);

    openMenu();

    const menu = await screen.findByRole('menu', { name: 'Collaboration' });
    expect(menu).toHaveClass('w-72', 'shadow-overlay');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Custom sync server')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('menuitem', { name: 'Start P2P room' }));

    expect(screen.getByRole('menu', { name: 'Collaboration' })).toBeInTheDocument();
    expect(screen.getByText('P2P')).toBeInTheDocument();
    expect(useEditorStore.getState().canvasSessions[0].collaboration?.provider).toBe('p2p');
    expect(window.location.hash).toContain('room=');

    fireEvent.click(screen.getByRole('menuitem', { name: 'Copy edit link' }));
    await waitFor(() => expect(clipboardWrite).toHaveBeenCalledOnce());
    expect(screen.getByRole('menu', { name: 'Collaboration' })).toBeInTheDocument();

    window.dispatchEvent(new Event('blur'));
    await waitFor(() =>
      expect(screen.queryByRole('menu', { name: 'Collaboration' })).not.toBeInTheDocument()
    );
  });

  it('connects to a validated custom server without closing', async () => {
    render(<CollaborationControl />);
    openMenu();

    const endpoint = await screen.findByLabelText('Custom sync server');
    fireEvent.change(endpoint, {
      target: { value: 'wss://sync.example.com/' },
    });
    const connect = screen.getByRole('button', { name: 'Connect' });
    expect(connect).toBeEnabled();
    fireEvent.click(connect);

    expect(screen.getByRole('menu', { name: 'Collaboration' })).toBeInTheDocument();
    expect(screen.getByText('BYOS')).toBeInTheDocument();
    expect(useEditorStore.getState().canvasSessions[0].collaboration).toMatchObject({
      provider: 'websocket',
      endpoint: 'wss://sync.example.com',
    });
  });

  it('shows room presence and keeps the menu open after leaving', async () => {
    const descriptor: CollaborationDescriptorV1 = {
      version: 1,
      provider: 'p2p',
      roomId: 'room-id-1234567890',
      key: 'room-key-1234567890123456789012345678901234567890',
    };
    seedSession('structured', descriptor);
    snapshot = {
      descriptor,
      status: 'connected',
      peers: [
        {
          clientId: 2,
          id: 'peer-2',
          name: 'Remote Peer',
          color: '#22c55e',
        },
      ],
      error: null,
      hasLocalCopy: true,
    };
    render(<CollaborationControl />);

    openMenu();
    expect(await screen.findByText('Connected')).toBeInTheDocument();
    expect(screen.getByText('2 participant(s)')).toBeInTheDocument();
    expect(screen.getByText('Remote Peer')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('menuitem', { name: 'Leave room' }));

    expect(screen.getByRole('menu', { name: 'Collaboration' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Start P2P room' })).toBeInTheDocument();
    expect(useEditorStore.getState().canvasSessions[0].collaboration).toBeUndefined();
    expect(window.location.hash).toBe('');
  });

  it('forgets room data, disables animation, and supports menu dismissal', async () => {
    const descriptor: CollaborationDescriptorV1 = {
      version: 1,
      provider: 'p2p',
      roomId: 'room-id-1234567890',
      key: 'room-key-1234567890123456789012345678901234567890',
    };
    const forget = vi.spyOn(collaborationRuntime, 'forget').mockResolvedValue(undefined);
    seedSession('freeform', descriptor);
    render(<CollaborationControl />);
    openMenu();

    fireEvent.click(await screen.findByRole('menuitem', { name: 'Forget room cache' }));
    await waitFor(() => expect(forget).toHaveBeenCalledWith(descriptor));
    expect(screen.getByRole('menu', { name: 'Collaboration' })).toBeInTheDocument();

    cleanup();
    seedSession('animation');
    render(<CollaborationControl />);
    openMenu();
    expect(await screen.findByText('Unavailable for Animation')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Start P2P room' })).toHaveAttribute(
      'data-disabled'
    );
    expect(screen.getByLabelText('Custom sync server')).toBeDisabled();

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() =>
      expect(screen.queryByRole('menu', { name: 'Collaboration' })).not.toBeInTheDocument()
    );

    openMenu();
    await screen.findByRole('menu', { name: 'Collaboration' });
    fireEvent.pointerDown(document.body);
    await waitFor(() =>
      expect(screen.queryByRole('menu', { name: 'Collaboration' })).not.toBeInTheDocument()
    );
  });
});
