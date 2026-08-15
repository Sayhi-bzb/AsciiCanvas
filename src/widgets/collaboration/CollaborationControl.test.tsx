import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEditorStore } from '@/domains/canvas/testing';
import {
  buildCollaborationUrl,
  type CollaborationDescriptorV2,
  type CollaborationSnapshot,
} from '@/domains/collaboration/public';
import { setUiLanguage } from '@/shared/i18n';
import { CollaborationControl } from './CollaborationControl';

let snapshot: CollaborationSnapshot = {
  descriptor: null,
  documentStatus: 'idle',
  connectionStatus: 'idle',
  canEdit: true,
  peers: [],
  error: null,
  errorKind: null,
  hasLocalCopy: false,
  integrityIssues: [],
};

vi.mock('./useCollaborationSnapshot', () => ({
  useCollaborationSnapshot: () => snapshot,
}));

describe('CollaborationControl', () => {
  const initialState = useEditorStore.getState();
  const clipboardWrite = vi.fn();

  const seedSession = (
    mode: 'freeform' | 'structured' = 'freeform',
    collaboration?: CollaborationDescriptorV2
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

  const openPanel = () => {
    fireEvent.click(screen.getByRole('button', { name: 'Collaboration' }));
  };

  beforeEach(() => {
    setUiLanguage('en');
    snapshot = {
      descriptor: null,
      documentStatus: 'idle',
      connectionStatus: 'idle',
      canEdit: true,
      peers: [],
      error: null,
      errorKind: null,
      hasLocalCopy: false,
      integrityIssues: [],
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

  it('opens a collaboration panel and keeps it open across P2P room actions', async () => {
    render(<CollaborationControl />);

    openPanel();

    const panel = await screen.findByRole('dialog', { name: 'Collaboration' });
    expect(panel).toHaveClass('w-72', 'shadow-overlay');
    expect(screen.getByLabelText('Custom sync server')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Start P2P room' }));

    expect(screen.getByRole('dialog', { name: 'Collaboration' })).toBeInTheDocument();
    expect(screen.getByText('P2P')).toBeInTheDocument();
    expect(useEditorStore.getState().canvasSessions[0].collaboration?.provider).toBe('p2p');
    expect(window.location.hash).toContain('room=');

    fireEvent.click(screen.getByRole('button', { name: 'Copy edit link' }));
    await waitFor(() => expect(clipboardWrite).toHaveBeenCalledOnce());
    expect(screen.getByRole('dialog', { name: 'Collaboration' })).toBeInTheDocument();

    window.dispatchEvent(new Event('blur'));
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Collaboration' })).not.toBeInTheDocument()
    );
  });

  it('connects to a validated custom server without closing', async () => {
    render(<CollaborationControl />);
    openPanel();

    const endpoint = await screen.findByLabelText('Custom sync server');
    fireEvent.change(endpoint, {
      target: { value: 'wss://sync.example.com/' },
    });
    const connect = screen.getByRole('button', { name: 'Connect' });
    expect(connect).toBeEnabled();
    fireEvent.click(connect);

    expect(screen.getByRole('dialog', { name: 'Collaboration' })).toBeInTheDocument();
    expect(screen.getByText('BYOS')).toBeInTheDocument();
    expect(useEditorStore.getState().canvasSessions[0].collaboration).toMatchObject({
      provider: 'websocket',
      endpoint: 'wss://sync.example.com',
    });
  });

  it('shows room presence and keeps the menu open after leaving', async () => {
    const descriptor: CollaborationDescriptorV2 = {
      version: 2,
      documentVersion: 2,
      mode: "structured",
      provider: 'p2p',
      roomId: 'room-id-1234567890',
      key: 'room-key-1234567890123456789012345678901234567890',
    };
    seedSession('structured', descriptor);
    snapshot = {
      descriptor,
      documentStatus: 'ready',
      connectionStatus: 'online',
      canEdit: true,
      peers: [
        {
          clientId: 2,
          id: 'peer-2',
          name: 'Remote Peer',
          color: '#22c55e',
        },
      ],
      error: null,
      errorKind: null,
      hasLocalCopy: true,
      integrityIssues: [],
    };
    render(<CollaborationControl />);

    const trigger = screen.getByRole('button', { name: 'Collaboration' });
    expect(trigger).not.toHaveAttribute('data-active');
    expect(screen.getByTestId('collaboration-connected-indicator')).toBeInTheDocument();
    openPanel();
    expect(trigger).toHaveClass('bg-control-open-surface');
    expect(await screen.findByText('Connected')).toBeInTheDocument();
    expect(screen.getByText('2 participant(s)')).toBeInTheDocument();
    expect(screen.getByText('Remote Peer')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Leave room' }));

    expect(screen.getByRole('dialog', { name: 'Collaboration' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start P2P room' })).toBeInTheDocument();
    expect(useEditorStore.getState().canvasSessions[0].collaboration).toBeUndefined();
    expect(window.location.hash).toBe('');
  });

  it('opens an incoming room in a dedicated session without clearing the active canvas', async () => {
    act(() => {
      useEditorStore.setState({
        grid: new Map([["0,0", { char: "A", color: "#fff" }]]),
        canvasSessions: [
          {
            id: 'collaboration-canvas',
            name: 'Local canvas',
            mode: 'freeform',
            scene: [],
            grid: [["0,0", { char: "A", color: "#fff" }]],
          },
        ],
      });
    });
    const descriptor: CollaborationDescriptorV2 = {
      version: 2,
      documentVersion: 2,
      mode: 'structured',
      provider: 'p2p',
      roomId: 'room-id-1234567890',
      key: 'room-key-1234567890123456789012345678901234567890',
    };
    window.history.replaceState(null, '', buildCollaborationUrl(descriptor));

    render(<CollaborationControl />);

    await waitFor(() => {
      expect(useEditorStore.getState().canvasSessions).toHaveLength(2);
    });
    const state = useEditorStore.getState();
    const local = state.canvasSessions.find((session) => session.id === 'collaboration-canvas');
    expect(local?.grid).toEqual([["0,0", { char: "A", color: "#fff" }]]);
    expect(local?.collaboration).toBeUndefined();
    expect(state.canvasMode).toBe('structured');

    state.switchCanvasSession('collaboration-canvas');
    expect(useEditorStore.getState().canvasSessions).toHaveLength(2);
    expect(useEditorStore.getState().grid.get("0,0")?.char).toBe("A");
  });

});
