import { ChannelAuthorizationCallback } from '../auth/options';
import Channel from './channel';
export default class PrivateChannel extends Channel {
    authorize(socketId: string, callback: ChannelAuthorizationCallback): void;
}
