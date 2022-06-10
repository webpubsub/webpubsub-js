import * as nacl from 'tweetnacl';
import { ChannelAuthorizationCallback } from '../auth/options';
import { WebpubsubEvent } from '../connection/protocol/message-types';
import Webpubsub from '../webpubsub';
import PrivateChannel from './private_channel';
export default class EncryptedChannel extends PrivateChannel {
    key: Uint8Array;
    nacl: nacl;
    constructor(name: string, webpubsub: Webpubsub, nacl: nacl);
    authorize(socketId: string, callback: ChannelAuthorizationCallback): void;
    trigger(event: string, data: any): boolean;
    handleEvent(event: WebpubsubEvent): void;
    private handleEncryptedEvent;
    getDataToEmit(bytes: Uint8Array): string;
}
