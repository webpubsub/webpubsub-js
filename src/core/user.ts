import {
  UserAuthenticationCallback, UserAuthenticationData
} from './auth/options';
import Channel from './channels/channel';
import EventsDispatcher from './events/dispatcher';
import Logger from './logger';
import Webpubsub from './webpubsub';

export default class UserFacade extends EventsDispatcher {
  webpubsub: Webpubsub;
  signin_requested: boolean = false;
  user_data: any = null;
  serverToUserChannel: Channel = null;

  public constructor(webpubsub: Webpubsub) {
    super(function(eventName, data) {
      Logger.debug('No callbacks on user for ' + eventName);
    });
    this.webpubsub = webpubsub;
    this.webpubsub.connection.bind('connected', () => {
      this._signin();
    });
    this.webpubsub.connection.bind('connecting', () => {
      this._disconnect();
    });
    this.webpubsub.connection.bind('disconnected', () => {
      this._disconnect();
    });
    this.webpubsub.connection.bind('message', event => {
      var eventName = event.event;
      if (eventName === 'webpubsub:signin_success') {
        this._onSigninSuccess(event.data);
      }
      if (
        this.serverToUserChannel &&
        this.serverToUserChannel.name === event.channel
      ) {
        this.serverToUserChannel.handleEvent(event);
      }
    });
  }

  public signin() {
    if (this.signin_requested) {
      return;
    }

    this.signin_requested = true;
    this._signin();
  }

  private _signin() {
    if (!this.signin_requested) {
      return;
    }

    if (this.webpubsub.connection.state !== 'connected') {
      // Signin will be attempted when the connection is connected
      return;
    }

    const onAuthorize: UserAuthenticationCallback = (
      err,
      authData: UserAuthenticationData
    ) => {
      if (err) {
        Logger.warn(`Error during signin: ${err}`);
        return;
      }

      this.webpubsub.send_event('webpubsub:signin', {
        auth: authData.auth,
        user_data: authData.user_data
      });

      // Later when we get webpubsub:singin_success event, the user will be marked as signed in
    };

    this.webpubsub.config.userAuthenticator(
      {
        socketId: this.webpubsub.connection.socket_id
      },
      onAuthorize
    );
  }

  private _onSigninSuccess(data: any) {
    try {
      this.user_data = JSON.parse(data.user_data);
    } catch (e) {
      Logger.error(`Failed parsing user data after signin: ${data.user_data}`);
      return;
    }

    if (typeof this.user_data.id !== 'string' || this.user_data.id === '') {
      Logger.error(
        `user_data doesn't contain an id. user_data: ${this.user_data}`
      );
      return;
    }

    this._subscribeChannels();
  }

  private _subscribeChannels() {
    const ensure_subscribed = channel => {
      if (channel.subscriptionPending && channel.subscriptionCancelled) {
        channel.reinstateSubscription();
      } else if (
        !channel.subscriptionPending &&
        this.webpubsub.connection.state === 'connected'
      ) {
        channel.subscribe();
      }
    };

    this.serverToUserChannel = new Channel(
      `#server-to-user-${this.user_data.id}`,
      this.webpubsub
    );
    this.serverToUserChannel.bind_global((eventName, data) => {
      if (
        eventName.indexOf('webpubsub_internal:') === 0 ||
        eventName.indexOf('webpubsub:') === 0
      ) {
        // ignore internal events
        return;
      }
      this.emit(eventName, data);
    });
    ensure_subscribed(this.serverToUserChannel);
  }

  private _disconnect() {
    this.user_data = null;
    if (this.serverToUserChannel) {
      this.serverToUserChannel.unbind_all();
      this.serverToUserChannel.disconnect();
      this.serverToUserChannel = null;
    }
  }
}
