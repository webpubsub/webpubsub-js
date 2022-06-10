import Channel from './channels/channel';
import EventsDispatcher from './events/dispatcher';
import Webpubsub from './webpubsub';
export default class UserFacade extends EventsDispatcher {
    webpubsub: Webpubsub;
    signin_requested: boolean;
    user_data: any;
    serverToUserChannel: Channel;
    constructor(webpubsub: Webpubsub);
    signin(): void;
    private _signin;
    private _onSigninSuccess;
    private _subscribeChannels;
    private _disconnect;
}
