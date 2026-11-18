import { describe, expect, it, vi } from 'vitest';

import {
    type ServerMessage,
    ServerMessageType,
    subscribeServerMessages
} from './serverMessages';

describe('subscribeServerMessages', () => {
    it("subscribes through the source's own subscribe, bound to the source", () => {
        const unsubscribe = vi.fn();
        const source = {
            calls: [] as unknown[],
            subscribe(
                this: { calls: unknown[] },
                types: string[],
                handler: (message: unknown) => void
            ) {
                this.calls.push([types, handler]);
                return unsubscribe;
            }
        };
        const handler = vi.fn();

        const result = subscribeServerMessages(
            source,
            [
                ServerMessageType.LibraryChanged,
                ServerMessageType.UserDataChanged
            ],
            handler
        );

        expect(source.calls).toEqual([
            [['LibraryChanged', 'UserDataChanged'], handler]
        ]);
        expect(result).toBe(unsubscribe);
    });

    it('hands the server message to the handler unchanged', () => {
        let deliver: (message: unknown) => void = () => undefined;
        const source = {
            subscribe: (_types: string[], handler: typeof deliver) => {
                deliver = handler;
                return () => undefined;
            }
        };
        const received: ServerMessage<'ScheduledTasksInfo'>[] = [];
        subscribeServerMessages(
            source,
            [ServerMessageType.ScheduledTasksInfo],
            (message) => received.push(message)
        );
        const message = {
            MessageType: 'ScheduledTasksInfo',
            Data: [{ Id: 'task', Name: 'Scan' }]
        };

        deliver(message);

        expect(received).toEqual([message]);
    });

    it('returns undefined when there is no connection', () => {
        expect(
            subscribeServerMessages(
                undefined,
                [ServerMessageType.Sessions],
                vi.fn()
            )
        ).toBeUndefined();
    });

    it('names each message type by its wire value', () => {
        expect(ServerMessageType.RefreshProgress).toBe('RefreshProgress');
        expect(ServerMessageType.TimerCreated).toBe('TimerCreated');
    });
});
