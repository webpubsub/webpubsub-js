import * as Errors from '../errors';
import * as Collections from '../utils/collections';
import Factory from '../utils/factory';
import urlStore from '../utils/url_store';
import Webpubsub from '../webpubsub';
import Channel from './channel';
import ChannelTable from './channel_table';

/** Handles a channel map. */
export default class Channels {
  channels: ChannelTable;

  constructor() {
    this.channels = {};
  }

  /** Creates or retrieves an existing channel by its name.
   *
   * @param {String} name
   * @param {Webpubsub} webpubsub
   * @return {Channel}
   */
  add(name: string, webpubsub: Webpubsub) {
    if (!this.channels[name]) {
      this.channels[name] = createChannel(name, webpubsub);
    }
    return this.channels[name];
  }

  /** Returns a list of all channels
   *
   * @return {Array}
   */
  all(): Channel[] {
    return Collections.values(this.channels);
  }

  /** Finds a channel by its name.
   *
   * @param {String} name
   * @return {Channel} channel or null if it doesn't exist
   */
  find(name: string) {
    return this.channels[name];
  }

  /** Removes a channel from the map.
   *
   * @param {String} name
   */
  remove(name: string) {
    var channel = this.channels[name];
    delete this.channels[name];
    return channel;
  }

  /** Proxies disconnection signal to all channels. */
  disconnect() {
    Collections.objectApply(this.channels, function(channel) {
      channel.disconnect();
    });
  }
}

function createChannel(name: string, webpubsub: Webpubsub): Channel {
  if (name.indexOf('private-encrypted-') === 0) {
    if (webpubsub.config.nacl) {
      return Factory.createEncryptedChannel(name, webpubsub, webpubsub.config.nacl);
    }
    let errMsg =
      'Tried to subscribe to a private-encrypted- channel but no nacl implementation available';
    let suffix = urlStore.buildLogSuffix('encryptedChannelSupport');
    throw new Errors.UnsupportedFeature(`${errMsg}. ${suffix}`);
  } else if (name.indexOf('private-') === 0) {
    return Factory.createPrivateChannel(name, webpubsub);
  } else if (name.indexOf('presence-') === 0) {
    return Factory.createPresenceChannel(name, webpubsub);
  } else if (name.indexOf('#') === 0) {
    throw new Errors.BadChannelName(
      'Cannot create a channel with name "' + name + '".'
    );
  } else {
    return Factory.createChannel(name, webpubsub);
  }
}
