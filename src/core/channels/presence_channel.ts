import UrlStore from 'core/utils/url_store';
import { ChannelAuthorizationData } from '../auth/options';
import { WebpubsubEvent } from '../connection/protocol/message-types';
import Logger from '../logger';
import Webpubsub from '../webpubsub';
import Members from './members';
import Metadata from './metadata';
import PrivateChannel from './private_channel';

export default class PresenceChannel extends PrivateChannel {
  members: Members;

  /** Adds presence channel functionality to private channels.
   *
   * @param {String} name
   * @param {Webpubsub} webpubsub
   */
  constructor(name: string, webpubsub: Webpubsub) {
    super(name, webpubsub);
    this.members = new Members();
  }

  /** Authenticates the connection as a member of the channel.
   *
   * @param  {String} socketId
   * @param  {Function} callback
   */
  authorize(socketId: string, callback: Function) {
    super.authorize(socketId, (error, authData) => {
      if (!error) {
        authData = authData as ChannelAuthorizationData;
        if (authData.channel_data === undefined) {
          let suffix = UrlStore.buildLogSuffix('authenticationEndpoint');
          Logger.error(
            `Invalid auth response for channel '${this.name}',` +
              `expected 'channel_data' field. ${suffix}`
          );
          callback('Invalid auth response');
          return;
        }
        var channelData = JSON.parse(authData.channel_data);
        this.members.setMyID(channelData.user_id);
      }
      callback(error, authData);
    });
  }

  /** Handles presence and subscription events. For internal use only.
   *
   * @param {WebpubsubEvent} event
   */
  handleEvent(event: WebpubsubEvent) {
    var eventName = event.event;
    if (eventName.indexOf('webpubsub_internal:') === 0) {
      this.handleInternalEvent(event);
    } else {
      var data = event.data;
      var metadata: Metadata = {};
      if (event.user_id) {
        metadata.user_id = event.user_id;
      }
      this.emit(eventName, data, metadata);
    }
  }
  handleInternalEvent(event: WebpubsubEvent) {
    var eventName = event.event;
    var data = event.data;
    switch (eventName) {
      case 'webpubsub_internal:subscription_succeeded':
        this.handleSubscriptionSucceededEvent(event);
        break;
      case 'webpubsub_internal:member_added':
        var addedMember = this.members.addMember(data);
        this.emit('webpubsub:member_added', addedMember);
        break;
      case 'webpubsub_internal:member_removed':
        var removedMember = this.members.removeMember(data);
        if (removedMember) {
          this.emit('webpubsub:member_removed', removedMember);
        }
        break;
    }
  }

  handleSubscriptionSucceededEvent(event: WebpubsubEvent) {
    this.subscriptionPending = false;
    this.subscribed = true;
    if (this.subscriptionCancelled) {
      this.webpubsub.unsubscribe(this.name);
    } else {
      this.members.onSubscription(event.data);
      this.emit('webpubsub:subscription_succeeded', this.members);
    }
  }

  /** Resets the channel state, including members map. For internal use only. */
  disconnect() {
    this.members.reset();
    super.disconnect();
  }
}
