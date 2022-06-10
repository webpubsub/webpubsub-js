import Action from './action';
import { WebpubsubEvent } from './message-types';
declare const Protocol: {
    decodeMessage: (messageEvent: MessageEvent) => WebpubsubEvent;
    encodeMessage: (event: WebpubsubEvent) => string;
    processHandshake: (messageEvent: MessageEvent) => Action;
    getCloseAction: (closeEvent: any) => string;
    getCloseError: (closeEvent: any) => any;
};
export default Protocol;
