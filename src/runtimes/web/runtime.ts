import { AuthTransports } from 'core/auth/auth_transports';
import Ajax from 'core/http/ajax';
import HTTPRequest from 'core/http/http_request';
import xhrAuth from 'isomorphic/auth/xhr_auth';
import jsonpAuth from './auth/jsonp_auth';
import Browser from './browser';
import getDefaultStrategy from './default_strategy';
import { Dependencies, DependenciesReceivers } from './dom/dependencies';
import JSONPRequest from './dom/jsonp_request';
import { ScriptReceivers } from './dom/script_receiver_factory';
import ScriptRequest from './dom/script_request';
import HTTPFactory from './http/http';
import { Network } from './net_info';
import jsonpTimeline from './timeline/jsonp_timeline';
import Transports from './transports/transports';
import transportConnectionInitializer from './transports/transport_connection_initializer';

var Runtime: Browser = {
  // for jsonp auth
  nextAuthCallbackID: 1,
  auth_callbacks: {},
  ScriptReceivers,
  DependenciesReceivers,
  getDefaultStrategy,
  Transports,
  transportConnectionInitializer,
  HTTPFactory,

  TimelineTransport: jsonpTimeline,

  getXHRAPI() {
    return window.XMLHttpRequest;
  },

  getWebSocketAPI() {
    return window.WebSocket || window.MozWebSocket;
  },

  setup(WebpubsubClass): void {
    (<any>window).Webpubsub = WebpubsubClass; // JSONp requires Webpubsub to be in the global scope.
    var initializeOnDocumentBody = () => {
      this.onDocumentBody(WebpubsubClass.ready);
    };
    if (!(<any>window).JSON) {
      Dependencies.load('json2', {}, initializeOnDocumentBody);
    } else {
      initializeOnDocumentBody();
    }
  },

  getDocument(): Document {
    return document;
  },

  getProtocol(): string {
    return this.getDocument().location.protocol;
  },

  getAuthorizers(): AuthTransports {
    return { ajax: xhrAuth, jsonp: jsonpAuth };
  },

  onDocumentBody(callback: Function) {
    if (document.body) {
      callback();
    } else {
      setTimeout(() => {
        this.onDocumentBody(callback);
      }, 0);
    }
  },

  createJSONPRequest(url: string, data: any): JSONPRequest {
    return new JSONPRequest(url, data);
  },

  createScriptRequest(src: string): ScriptRequest {
    return new ScriptRequest(src);
  },

  getLocalStorage() {
    try {
      return window.localStorage;
    } catch (e) {
      return undefined;
    }
  },

  createXHR(): Ajax {
    if (this.getXHRAPI()) {
      return this.createXMLHttpRequest();
    } else {
      return this.createMicrosoftXHR();
    }
  },

  createXMLHttpRequest(): Ajax {
    var Constructor = this.getXHRAPI();
    return new Constructor();
  },

  createMicrosoftXHR(): Ajax {
    return new ActiveXObject('Microsoft.XMLHTTP');
  },

  getNetwork() {
    return Network;
  },

  createWebSocket(url: string): any {
    var Constructor = this.getWebSocketAPI();
    return new Constructor(url);
  },

  createSocketRequest(method: string, url: string): HTTPRequest {
    if (this.isXHRSupported()) {
      return this.HTTPFactory.createXHR(method, url);
    } else if (this.isXDRSupported(url.indexOf('https:') === 0)) {
      return this.HTTPFactory.createXDR(method, url);
    } else {
      throw 'Cross-origin HTTP requests are not supported';
    }
  },

  isXHRSupported(): boolean {
    var Constructor = this.getXHRAPI();
    return (
      Boolean(Constructor) && new Constructor().withCredentials !== undefined
    );
  },

  isXDRSupported(useTLS?: boolean): boolean {
    var protocol = useTLS ? 'https:' : 'http:';
    var documentProtocol = this.getProtocol();
    return (
      Boolean(<any>window['XDomainRequest']) && documentProtocol === protocol
    );
  },

  addUnloadListener(listener: any) {
    if (window.addEventListener !== undefined) {
      window.addEventListener('unload', listener, false);
    } else if (window.attachEvent !== undefined) {
      window.attachEvent('onunload', listener);
    }
  },

  removeUnloadListener(listener: any) {
    if (window.addEventListener !== undefined) {
      window.removeEventListener('unload', listener, false);
    } else if (window.detachEvent !== undefined) {
      window.detachEvent('onunload', listener);
    }
  }
};

export default Runtime;
