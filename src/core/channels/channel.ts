import {
  ChannelAuthorizationCallback, ChannelAuthorizationData
} from '../auth/options';
import { WebpubsubEvent } from '../connection/protocol/message-types';
import * as Errors from '../errors';
import { HTTPAuthError } from '../errors';
import { default as EventsDispatcher } from '../events/dispatcher';
import Logger from '../logger';
import UrlStore from '../utils/url_store';
import Webpubsub from '../webpubsub';
import Metadata from './metadata';

/** Provides base public channel interface with an event emitter.
 *
 * Emits:
 * - webpubsub:subscription_succeeded - after subscribing successfully
 * - other non-internal events
 *
 * @param {String} name
 * @param {Webpubsub} webpubsub
 */
export default class Channel extends EventsDispatcher {
  name: string;
  webpubsub: Webpubsub;
  subscribed: boolean;
  subscriptionPending: boolean;
  subscriptionCancelled: boolean;

  constructor(name: string, webpubsub: Webpubsub) {
    super(function(event, data) {
      Logger.debug('No callbacks on ' + name + ' for ' + event);
    });

    this.name = name;
    this.webpubsub = webpubsub;
    this.subscribed = false;
    this.subscriptionPending = false;
    this.subscriptionCancelled = false;
  }

  /** Skips authorization, since public channels don't require it.
   *
   * @param {Function} callback
   */
  authorize(socketId: string, callback: ChannelAuthorizationCallback) {
    return callback(null, { auth: '' });
  }

  /** Triggers an event */
  trigger(event: string, data: any) {
    if (event.indexOf('client-') !== 0) {
      throw new Errors.BadEventName(
        "Event '" + event + "' does not start with 'client-'"
      );
    }
    if (!this.subscribed) {
      var suffix = UrlStore.buildLogSuffix('triggeringClientEvents');
      Logger.warn(
        `Client event triggered before channel 'subscription_succeeded' event . ${suffix}`
      );
    }
    return this.webpubsub.send_event(event, data, this.name);
  }

  /** Signals disconnection to the channel. For internal use only. */
  disconnect() {
    this.subscribed = false;
    this.subscriptionPending = false;
  }

  /** Handles a WebpubsubEvent. For internal use only.
   *
   * @param {WebpubsubEvent} event
   */
  handleEvent(event: WebpubsubEvent) {
    var eventName = event.event;
    var data = event.data;
    if (eventName === 'webpubsub_internal:subscription_succeeded') {
      this.handleSubscriptionSucceededEvent(event);
    } else if (eventName.indexOf('webpubsub_internal:') !== 0) {
      var metadata: Metadata = {};
      this.emit(eventName, data, metadata);
    }
  }

  handleSubscriptionSucceededEvent(event: WebpubsubEvent) {
    this.subscriptionPending = false;
    this.subscribed = true;
    if (this.subscriptionCancelled) {
      this.webpubsub.unsubscribe(this.name);
    } else {
      this.emit('webpubsub:subscription_succeeded', event.data);
    }
  }

  /** Sends a subscription request. For internal use only. */
  subscribe() {
    if (this.subscribed) {
      return;
    }
    this.subscriptionPending = true;
    this.subscriptionCancelled = false;
    this.authorize(
      this.webpubsub.connection.socket_id,
      (error: Error | null, data: ChannelAuthorizationData) => {
        if (error) {
          this.subscriptionPending = false;
          // Why not bind to 'webpubsub:subscription_error' a level up, and log there?
          // Binding to this event would cause the warning about no callbacks being
          // bound (see constructor) to be suppressed, that's not what we want.
          Logger.error(error.toString());
          this.emit(
            'webpubsub:subscription_error',
            Object.assign(
              {},
              {
                type: 'AuthError',
                error: error.message
              },
              error instanceof HTTPAuthError ? { status: error.status } : {}
            )
          );
        } else {
          this.webpubsub.send_event('webpubsub:subscribe', {
            auth: data.auth,
            channel_data: data.channel_data,
            channel: this.name
          });
        }
      }
    );
  }

  /** Sends an unsubscription request. For internal use only. */
  unsubscribe() {
    this.subscribed = false;
    this.webpubsub.send_event('webpubsub:unsubscribe', {
      channel: this.name
    });
  }

  /** Cancels an in progress subscription. For internal use only. */
  cancelSubscription() {
    this.subscriptionCancelled = true;
  }

  /** Reinstates an in progress subscripiton. For internal use only. */
  reinstateSubscription() {
    this.subscriptionCancelled = false;
  }
}
