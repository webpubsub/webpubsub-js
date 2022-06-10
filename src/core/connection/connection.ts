import { default as EventsDispatcher } from '../events/dispatcher';
import Logger from '../logger';
import Socket from '../socket';
import TransportConnection from '../transports/transport_connection';
import * as Collections from '../utils/collections';
import { WebpubsubEvent } from './protocol/message-types';
import Protocol from './protocol/protocol';
/**
 * Provides Webpubsub protocol interface for transports.
 *
 * Emits following events:
 * - message - on received messages
 * - ping - on ping requests
 * - pong - on pong responses
 * - error - when the transport emits an error
 * - closed - after closing the transport
 *
 * It also emits more events when connection closes with a code.
 * See Protocol.getCloseAction to get more details.
 *
 * @param {Number} id
 * @param {AbstractTransport} transport
 */
export default class Connection extends EventsDispatcher implements Socket {
  id: string;
  transport: TransportConnection;
  activityTimeout: number;

  constructor(id: string, transport: TransportConnection) {
    super();
    this.id = id;
    this.transport = transport;
    this.activityTimeout = transport.activityTimeout;
    this.bindListeners();
  }

  /** Returns whether used transport handles activity checks by itself
   *
   * @returns {Boolean} true if activity checks are handled by the transport
   */
  handlesActivityChecks() {
    return this.transport.handlesActivityChecks();
  }

  /** Sends raw data.
   *
   * @param {String} data
   */
  send(data: any): boolean {
    return this.transport.send(data);
  }

  /** Sends an event.
   *
   * @param {String} name
   * @param {String} data
   * @param {String} [channel]
   * @returns {Boolean} whether message was sent or not
   */
  send_event(name: string, data: any, channel?: string): boolean {
    var event: WebpubsubEvent = { event: name, data: data };
    if (channel) {
      event.channel = channel;
    }
    Logger.debug('Event sent', event);
    return this.send(Protocol.encodeMessage(event));
  }

  /** Sends a ping message to the server.
   *
   * Basing on the underlying transport, it might send either transport's
   * protocol-specific ping or webpubsub:ping event.
   */
  ping() {
    if (this.transport.supportsPing()) {
      this.transport.ping();
    } else {
      this.send_event('webpubsub:ping', {});
    }
  }

  /** Closes the connection. */
  close() {
    this.transport.close();
  }

  private bindListeners() {
    var listeners = {
      message: (messageEvent: MessageEvent) => {
        var webpubsubEvent;
        try {
          webpubsubEvent = Protocol.decodeMessage(messageEvent);
        } catch (e) {
          this.emit('error', {
            type: 'MessageParseError',
            error: e,
            data: messageEvent.data
          });
        }

        if (webpubsubEvent !== undefined) {
          Logger.debug('Event recd', webpubsubEvent);

          switch (webpubsubEvent.event) {
            case 'webpubsub:error':
              this.emit('error', {
                type: 'WebpubsubError',
                data: webpubsubEvent.data
              });
              break;
            case 'webpubsub:ping':
              this.emit('ping');
              break;
            case 'webpubsub:pong':
              this.emit('pong');
              break;
          }
          this.emit('message', webpubsubEvent);
        }
      },
      activity: () => {
        this.emit('activity');
      },
      error: error => {
        this.emit('error', error);
      },
      closed: closeEvent => {
        unbindListeners();

        if (closeEvent && closeEvent.code) {
          this.handleCloseEvent(closeEvent);
        }

        this.transport = null;
        this.emit('closed');
      }
    };

    var unbindListeners = () => {
      Collections.objectApply(listeners, (listener, event) => {
        this.transport.unbind(event, listener);
      });
    };

    Collections.objectApply(listeners, (listener, event) => {
      this.transport.bind(event, listener);
    });
  }

  private handleCloseEvent(closeEvent: any) {
    var action = Protocol.getCloseAction(closeEvent);
    var error = Protocol.getCloseError(closeEvent);
    if (error) {
      this.emit('error', error);
    }
    if (action) {
      this.emit(action, { action: action, error: error });
    }
  }
}
