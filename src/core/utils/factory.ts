import * as nacl from 'tweetnacl';
import Channel from '../channels/channel';
import Channels from '../channels/channels';
import EncryptedChannel from '../channels/encrypted_channel';
import PresenceChannel from '../channels/presence_channel';
import PrivateChannel from '../channels/private_channel';
import ConnectionManager from '../connection/connection_manager';
import ConnectionManagerOptions from '../connection/connection_manager_options';
import Handshake from '../connection/handshake';
import Timeline from '../timeline/timeline';
import {
    default as TimelineSender,
    TimelineSenderOptions
} from '../timeline/timeline_sender';
import AssistantToTheTransportManager from '../transports/assistant_to_the_transport_manager';
import PingDelayOptions from '../transports/ping_delay_options';
import Transport from '../transports/transport';
import TransportConnection from '../transports/transport_connection';
import TransportManager from '../transports/transport_manager';
import Webpubsub from '../webpubsub';


var Factory = {
  createChannels(): Channels {
    return new Channels();
  },

  createConnectionManager(
    key: string,
    options: ConnectionManagerOptions
  ): ConnectionManager {
    return new ConnectionManager(key, options);
  },

  createChannel(name: string, webpubsub: Webpubsub): Channel {
    return new Channel(name, webpubsub);
  },

  createPrivateChannel(name: string, webpubsub: Webpubsub): PrivateChannel {
    return new PrivateChannel(name, webpubsub);
  },

  createPresenceChannel(name: string, webpubsub: Webpubsub): PresenceChannel {
    return new PresenceChannel(name, webpubsub);
  },

  createEncryptedChannel(
    name: string,
    webpubsub: Webpubsub,
    nacl: nacl
  ): EncryptedChannel {
    return new EncryptedChannel(name, webpubsub, nacl);
  },

  createTimelineSender(timeline: Timeline, options: TimelineSenderOptions) {
    return new TimelineSender(timeline, options);
  },

  createHandshake(
    transport: TransportConnection,
    callback: (HandshakePayload) => void
  ): Handshake {
    return new Handshake(transport, callback);
  },

  createAssistantToTheTransportManager(
    manager: TransportManager,
    transport: Transport,
    options: PingDelayOptions
  ): AssistantToTheTransportManager {
    return new AssistantToTheTransportManager(manager, transport, options);
  }
};

export default Factory;
