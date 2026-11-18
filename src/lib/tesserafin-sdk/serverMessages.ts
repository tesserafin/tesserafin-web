import type { OutboundWebSocketMessage } from './generated/models/outbound-web-socket-message';
import { SessionMessageType } from './generated/models/session-message-type';

/**
 * Server-to-client WebSocket messages, typed by the generated contract.
 *
 * This module is the one seam between Web code and the connection's WebSocket. Callers name the
 * message types they want (`ServerMessageType`) and receive the generated message shapes; which
 * socket implementation carries them is the connection layer's business. Today that socket is
 * the one the connection's `@jellyfin/sdk` `Api` builds (ticket-authenticated, see
 * `lib/jellyfin-apiclient/ServerConnections.js`), reached through the `subscribe` of the `Api`
 * or of the legacy `ApiClient` bound to it; replacing it changes this module only.
 *
 * Kept free of the `lib/tesserafin-sdk` barrel: element and home code that subscribes is in the
 * main bundle.
 */

/** Every message type the server sends, by name. */
export const ServerMessageType = SessionMessageType;
export type ServerMessageType = OutboundWebSocketMessage['MessageType'];

/** The message the server sends for `T`. */
export type ServerMessage<T extends ServerMessageType = ServerMessageType> =
    Extract<OutboundWebSocketMessage, { MessageType: T }>;

/** A connection object that exposes the connection's WebSocket subscription. */
export interface ServerMessageSource {
    subscribe: unknown;
}

type RawSubscribe = (
    types: readonly string[],
    handler: (message: unknown) => void
) => () => void;

/**
 * Subscribes `handler` to the `types` messages of `source`'s connection. Returns the unsubscribe
 * function, or `undefined` when there is no connection to subscribe to.
 */
export const subscribeServerMessages = <T extends ServerMessageType>(
    source: ServerMessageSource | null | undefined,
    types: readonly T[],
    handler: (message: ServerMessage<T>) => void
): (() => void) | undefined => {
    if (!source) return undefined;
    const subscribe = source.subscribe as RawSubscribe;
    return subscribe.call(source, types, handler as (message: unknown) => void);
};
