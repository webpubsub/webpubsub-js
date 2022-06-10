import { WebpubsubEvent } from '../connection/protocol/message-types';
import Webpubsub from '../webpubsub';
import Members from './members';
import PrivateChannel from './private_channel';
export default class PresenceChannel extends PrivateChannel {
    members: Members;
    constructor(name: string, webpubsub: Webpubsub);
    authorize(socketId: string, callback: Function): void;
    handleEvent(event: WebpubsubEvent): void;
    handleInternalEvent(event: WebpubsubEvent): void;
    handleSubscriptionSucceededEvent(event: WebpubsubEvent): void;
    disconnect(): void;
}
