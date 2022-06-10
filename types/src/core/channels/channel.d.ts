import { ChannelAuthorizationCallback } from '../auth/options';
import { WebpubsubEvent } from '../connection/protocol/message-types';
import { default as EventsDispatcher } from '../events/dispatcher';
import Webpubsub from '../webpubsub';
export default class Channel extends EventsDispatcher {
    name: string;
    webpubsub: Webpubsub;
    subscribed: boolean;
    subscriptionPending: boolean;
    subscriptionCancelled: boolean;
    constructor(name: string, webpubsub: Webpubsub);
    authorize(socketId: string, callback: ChannelAuthorizationCallback): void;
    trigger(event: string, data: any): boolean;
    disconnect(): void;
    handleEvent(event: WebpubsubEvent): void;
    handleSubscriptionSucceededEvent(event: WebpubsubEvent): void;
    subscribe(): void;
    unsubscribe(): void;
    cancelSubscription(): void;
    reinstateSubscription(): void;
}
