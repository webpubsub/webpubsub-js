import Action from './action';
import { WebpubsubEvent } from './message-types';
/**
 * Provides functions for handling Webpubsub protocol-specific messages.
 */

const Protocol = {
  /**
   * Decodes a message in a Webpubsub format.
   *
   * The MessageEvent we receive from the transport should contain a webpubsub event
   * (https://webpubsub.com/docs/webpubsub_protocol#events) serialized as JSON in the
   * data field
   *
   * The webpubsub event may contain a data field too, and it may also be
   * serialised as JSON
   *
   * Throws errors when messages are not parse'able.
   *
   * @param  {MessageEvent} messageEvent
   * @return {WebpubsubEvent}
   */
  decodeMessage: function(messageEvent: MessageEvent): WebpubsubEvent {
    try {
      var messageData = JSON.parse(messageEvent.data);
      var webpubsubEventData = messageData.data;
      if (typeof webpubsubEventData === 'string') {
        try {
          webpubsubEventData = JSON.parse(messageData.data);
        } catch (e) {}
      }
      var webpubsubEvent: WebpubsubEvent = {
        event: messageData.event,
        channel: messageData.channel,
        data: webpubsubEventData
      };
      if (messageData.user_id) {
        webpubsubEvent.user_id = messageData.user_id;
      }
      return webpubsubEvent;
    } catch (e) {
      throw { type: 'MessageParseError', error: e, data: messageEvent.data };
    }
  },

  /**
   * Encodes a message to be sent.
   *
   * @param  {WebpubsubEvent} event
   * @return {String}
   */
  encodeMessage: function(event: WebpubsubEvent): string {
    return JSON.stringify(event);
  },

  /**
   * Processes a handshake message and returns appropriate actions.
   *
   * Returns an object with an 'action' and other action-specific properties.
   *
   * There are three outcomes when calling this function. First is a successful
   * connection attempt, when webpubsub:connection_established is received, which
   * results in a 'connected' action with an 'id' property. When passed a
   * webpubsub:error event, it returns a result with action appropriate to the
   * close code and an error. Otherwise, it raises an exception.
   *
   * @param {String} message
   * @result Object
   */
  processHandshake: function(messageEvent: MessageEvent): Action {
    var message = Protocol.decodeMessage(messageEvent);

    if (message.event === 'webpubsub:connection_established') {
      if (!message.data.activity_timeout) {
        throw 'No activity timeout specified in handshake';
      }
      return {
        action: 'connected',
        id: message.data.socket_id,
        activityTimeout: message.data.activity_timeout * 1000
      };
    } else if (message.event === 'webpubsub:error') {
      // From protocol 6 close codes are sent only once, so this only
      // happens when connection does not support close codes
      return {
        action: this.getCloseAction(message.data),
        error: this.getCloseError(message.data)
      };
    } else {
      throw 'Invalid handshake';
    }
  },

  /**
   * Dispatches the close event and returns an appropriate action name.
   *
   * See:
   * 1. https://developer.mozilla.org/en-US/docs/WebSockets/WebSockets_reference/CloseEvent
   * 2. http://webpubsub.com/docs/webpubsub_protocol
   *
   * @param  {CloseEvent} closeEvent
   * @return {String} close action name
   */
  getCloseAction: function(closeEvent): string {
    if (closeEvent.code < 4000) {
      // ignore 1000 CLOSE_NORMAL, 1001 CLOSE_GOING_AWAY,
      //        1005 CLOSE_NO_STATUS, 1006 CLOSE_ABNORMAL
      // ignore 1007...3999
      // handle 1002 CLOSE_PROTOCOL_ERROR, 1003 CLOSE_UNSUPPORTED,
      //        1004 CLOSE_TOO_LARGE
      if (closeEvent.code >= 1002 && closeEvent.code <= 1004) {
        return 'backoff';
      } else {
        return null;
      }
    } else if (closeEvent.code === 4000) {
      return 'tls_only';
    } else if (closeEvent.code < 4100) {
      return 'refused';
    } else if (closeEvent.code < 4200) {
      return 'backoff';
    } else if (closeEvent.code < 4300) {
      return 'retry';
    } else {
      // unknown error
      return 'refused';
    }
  },

  /**
   * Returns an error or null basing on the close event.
   *
   * Null is returned when connection was closed cleanly. Otherwise, an object
   * with error details is returned.
   *
   * @param  {CloseEvent} closeEvent
   * @return {Object} error object
   */
  getCloseError: function(closeEvent): any {
    if (closeEvent.code !== 1000 && closeEvent.code !== 1001) {
      return {
        type: 'WebpubsubError',
        data: {
          code: closeEvent.code,
          message: closeEvent.reason || closeEvent.message
        }
      };
    } else {
      return null;
    }
  }
};

export default Protocol;
