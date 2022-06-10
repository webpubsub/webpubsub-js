import { ChannelAuthorizationCallback } from '../auth/options';
import Channel from './channel';

/** Extends public channels to provide private channel interface.
 *
 * @param {String} name
 * @param {Webpubsub} webpubsub
 */
export default class PrivateChannel extends Channel {
  /** Authorizes the connection to use the channel.
   *
   * @param  {String} socketId
   * @param  {Function} callback
   */
  authorize(socketId: string, callback: ChannelAuthorizationCallback) {
    return this.webpubsub.config.channelAuthorizer(
      {
        channelName: this.name,
        socketId: socketId
      },
      callback
    );
  }
}
