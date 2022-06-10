import Ajax from 'core/http/ajax';
import TransportsTable from 'core/transports/transports_table';
import * as Collections from 'core/utils/collections';
import Transports from 'isomorphic/transports/transports';
import getDefaultStrategy from './default_strategy';
import HTTPFactory from './http/http';
import transportConnectionInitializer from './transports/transport_connection_initializer';

var Isomorphic: any = {
  getDefaultStrategy,
  Transports: <TransportsTable>Transports,
  transportConnectionInitializer,
  HTTPFactory,

  setup(WebpubsubClass): void {
    WebpubsubClass.ready();
  },

  getLocalStorage(): any {
    return undefined;
  },

  getClientFeatures(): any[] {
    return Collections.keys(
      Collections.filterObject({ ws: Transports.ws }, function(t) {
        return t.isSupported({});
      })
    );
  },

  getProtocol(): string {
    return 'http:';
  },

  isXHRSupported(): boolean {
    return true;
  },

  createSocketRequest(method: string, url: string) {
    if (this.isXHRSupported()) {
      return this.HTTPFactory.createXHR(method, url);
    } else {
      throw 'Cross-origin HTTP requests are not supported';
    }
  },

  createXHR(): Ajax {
    var Constructor = this.getXHRAPI();
    return new Constructor();
  },

  createWebSocket(url: string): any {
    var Constructor = this.getWebSocketAPI();
    return new Constructor(url);
  },

  addUnloadListener(listener: any) {},
  removeUnloadListener(listener: any) {}
};

export default Isomorphic;
