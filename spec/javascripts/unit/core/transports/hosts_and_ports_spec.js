var TestEnv = require('testenv');
var Webpubsub = require('core/webpubsub').default;
var NetInfo  = require('net_info').NetInfo;
var Mocks = require('mocks');
var Defaults = require('core/defaults').default;
var version = Defaults.VERSION;
var cdn_http = Defaults.cdn_http;
var cdn_https = Defaults.cdn_https;
var dependency_suffix = Defaults.dependency_suffix;
var Runtime = require('runtime').default;

describe("Host/Port Configuration", function() {
  var transport;
  var webpubsub;
  var Transports;

  beforeEach(function() {
    spyOn(Runtime, 'getNetwork').and.callFake(function(){
      var network = new NetInfo();
      network.isOnline = jasmine.createSpy("isOnline")
        .and.returnValue(true);
      return network;
    });
    spyOn(Runtime, "getLocalStorage").and.returnValue({});
    Transports = Runtime.Transports;
  });

  afterEach(function() {
    webpubsub.disconnect();
  });

  describe("WebSockets", function() {
    var _WebSocket;

    beforeEach(function() {
      spyOn(Runtime, 'createWebSocket').and.returnValue(Mocks.getTransport());

      spyOn(Transports.ws.hooks, "isInitialized").and.returnValue(true);
      spyOn(Transports.ws, "isSupported").and.returnValue(true);
      spyOn(Transports.xhr_streaming, "isSupported").and.returnValue(false);
      spyOn(Transports.xhr_polling, "isSupported").and.returnValue(false);

      if (TestEnv == "web") {
        spyOn(Transports.xdr_streaming, "isSupported").and.returnValue(false);
        spyOn(Transports.xdr_polling, "isSupported").and.returnValue(false);
      }
    });

    it("should connect to wss://ws-mt1.webpubsub.com:443 by default", function() {
      webpubsub = new Webpubsub("foobar");
      webpubsub.connect();

      expect(Runtime.createWebSocket).toHaveBeenCalledWith(
        "wss://ws-mt1.webpubsub.com:443/app/foobar?protocol=7&client=js&version="+version+"&flash=false"
      );
    });

    it("should connect to ws://ws-mt1.webpubsub.com:80 by default when forceTLS disabled", function() {
      webpubsub = new Webpubsub("foobar", { forceTLS: false });
      webpubsub.connect();

      expect(Runtime.createWebSocket).toHaveBeenCalledWith(
        "ws://ws-mt1.webpubsub.com:80/app/foobar?protocol=7&client=js&version="+version+"&flash=false"
      );
    });

    it("should connect using wsHost and wssPort when specified in options", function() {
      webpubsub = new Webpubsub("foobar", { wsHost: "example.com", wssPort: 1999 });
      webpubsub.connect();

      expect(Runtime.createWebSocket).toHaveBeenCalledWith(
        "wss://example.com:1999/app/foobar?protocol=7&client=js&version="+version+"&flash=false"
      );
    });

    it("should connect using wsHost and wsPort when specified in options and forceTLS disabled", function() {
      webpubsub = new Webpubsub("foobar", { wsHost: "example.org", wsPort: 4444, forceTLS: false });
      webpubsub.connect();

      expect(Runtime.createWebSocket).toHaveBeenCalledWith(
        "ws://example.org:4444/app/foobar?protocol=7&client=js&version="+version+"&flash=false"
      );
    });
  });
});
