import { beforeEach, expect, it, vi } from 'vitest';
import Events from '../utils/events';

const fixture = vi.hoisted(() => ({
    manager: {
        getTargets: vi.fn(),
        trySetActivePlayer: vi.fn(),
        getPlayerInfo: vi.fn()
    },
    connections: {
        getApiClients: () => [{ accessToken: () => 'fixture-token' }],
        _callbacks: {}
    }
}));
vi.mock('components/playback/playbackmanager', () => ({
    playbackManager: fixture.manager
}));
vi.mock('lib/jellyfin-apiclient', () => ({
    ServerConnections: fixture.connections
}));
import { initialize } from './autocast';

beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    fixture.connections._callbacks = {};
    fixture.manager.getTargets.mockResolvedValue([]);
});
it('does not enumerate targets without a saved preference, including sign-in', () => {
    initialize();
    Events.trigger(fixture.connections, 'localusersignedin');
    expect(fixture.manager.getTargets).not.toHaveBeenCalled();
});
it('keeps saved household-session reconnection passive', async () => {
    localStorage.setItem('autocastPlayerId', 'household-tv');
    const target = { id: 'household-tv', playerName: 'session' };
    fixture.manager.getTargets.mockResolvedValue([target]);
    initialize();
    await Promise.resolve();
    expect(fixture.manager.getTargets).toHaveBeenCalledWith({
        enableDiscovery: false
    });
    expect(fixture.manager.trySetActivePlayer).toHaveBeenCalledWith(
        'session',
        target
    );
});
