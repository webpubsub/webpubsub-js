var TestEnv = require("testenv");
var Util = require("core/util").default;
var Collections = require("core/utils/collections");
var Logger = require("core/logger").default;
var Defaults = require("core/defaults").default;
var DefaultConfig = require("core/config");
var TimelineSender = require("core/timeline/timeline_sender").default;
var Webpubsub = require("core/webpubsub").default;
var Mocks = require("../../helpers/mocks");
var Factory = require("core/utils/factory").default;
var Runtime = require("runtime").default;
const transports = Runtime.Transports;
const Network = require("net_info").Network;
const waitsFor = require("../../helpers/waitsFor");
var NetInfo = require("net_info").NetInfo;

describe("Webpubsub (User)", function () {

  describe("#signin", function () {
    var webpubsub;
    beforeEach(function () {
      webpubsub = new Webpubsub("foo");
      spyOn(webpubsub.config, "userAuthenticator");
      spyOn(webpubsub, "send_event");
      webpubsub.connection.state = "connected";
      webpubsub.connection.socket_id = "1.23";
    });

    it("should not call userAuthenticator if the connection is not connected", function () {
      webpubsub.connection.state = "connecting";
      webpubsub.signin();
      expect(webpubsub.config.userAuthenticator).not.toHaveBeenCalled();
    });


    it("should fail if userAuthenticator fails", function () {
      webpubsub.config.userAuthenticator.and.callFake(function (params, callback) {
        callback("this error", {});
      });
      spyOn(Logger, "warn");
      webpubsub.signin();
      expect(webpubsub.config.userAuthenticator).toHaveBeenCalledWith(
        { socketId: "1.23" },
        jasmine.any(Function)
      );
      expect(Logger.warn).toHaveBeenCalledWith(
        "Error during signin: this error"
      );
    });

    it("should send webpubsub:signin event", function () {
      webpubsub.config.userAuthenticator.and.callFake(function (params, callback) {
        callback(null, {
          auth: "auth",
          user_data: JSON.stringify({ id: "1" }),
          foo: "bar"
        });
      });
      spyOn(Logger, "warn");
      webpubsub.signin();
      expect(webpubsub.config.userAuthenticator).toHaveBeenCalledWith(
        { socketId: "1.23" },
        jasmine.any(Function)
      );
      expect(webpubsub.send_event).toHaveBeenCalledWith("webpubsub:signin", {
        auth: "auth",
        user_data: JSON.stringify({ id: "1" })
      });
    });

    it("should signin when the connection becomes connected", function () {
      webpubsub.connection.state = "connecting";
      webpubsub.signin();
      expect(webpubsub.config.userAuthenticator).not.toHaveBeenCalled();

      webpubsub.config.userAuthenticator.and.callFake(function (params, callback) {
        callback(null, {
          auth: "auth",
          user_data: JSON.stringify({ id: "1" }),
          foo: "bar"
        });
      });

      webpubsub.connection.state = "connected";
      webpubsub.connection.emit('connected');

      expect(webpubsub.config.userAuthenticator).toHaveBeenCalledWith(
        { socketId: "1.23" },
        jasmine.any(Function)
      );
      expect(webpubsub.send_event).toHaveBeenCalledWith("webpubsub:signin", {
        auth: "auth",
        user_data: JSON.stringify({ id: "1" })
      });
    });

    it("should re-signin when the connection reconnects!", function () {
      webpubsub.config.userAuthenticator.and.callFake(function (params, callback) {
        callback(null, {
          auth: "auth",
          user_data: JSON.stringify({ id: "1" }),
          foo: "bar"
        });
      });

      webpubsub.signin();
      expect(webpubsub.config.userAuthenticator).toHaveBeenCalledWith(
        { socketId: "1.23" },
        jasmine.any(Function)
      );
      expect(webpubsub.send_event).toHaveBeenCalledWith("webpubsub:signin", {
        auth: "auth",
        user_data: JSON.stringify({ id: "1" })
      });
      webpubsub.send_event.calls.reset()
      webpubsub.config.userAuthenticator.calls.reset()

      webpubsub.connection.state == "disconnected";
      webpubsub.connection.emit("disconnected");
      webpubsub.connection.state == "connecting";
      webpubsub.connection.emit("connecting");
      webpubsub.connection.state == "connected";
      webpubsub.connection.emit("connected");

      expect(webpubsub.config.userAuthenticator).toHaveBeenCalledWith(
        { socketId: "1.23" },
        jasmine.any(Function)
      );
      expect(webpubsub.send_event).toHaveBeenCalledWith("webpubsub:signin", {
        auth: "auth",
        user_data: JSON.stringify({ id: "1" })
      });
    });

    it("should not signin when the connection is connected if signin() was never called", function () {
      webpubsub.connection.state = "connected";
      webpubsub.connection.emit('connected');
      expect(webpubsub.config.userAuthenticator).not.toHaveBeenCalled();
    })

  });


  describe('webpubsub:signin_success', function () {
    var webpubsub;
    var transport;

    beforeEach(async function () {
      spyOn(Network, 'isOnline').and.returnValue(true);
      spyOn(Runtime, 'getLocalStorage').and.returnValue({});

      var Transports = Runtime.Transports;
      function createConnection() {
        transport = Mocks.getWorkingTransport();
        return transport;
      }
      spyOn(Transports.xhr_polling, 'createConnection').and.callFake(
        createConnection
      );
      spyOn(Transports.xhr_polling, 'isSupported').and.returnValue(true);
      webpubsub = new Webpubsub('foobar', {
        enabledTransports: ['xhr_polling']
      });
      webpubsub.connect();
      await waitsFor(
        function () {
          return webpubsub.connection.state === 'connected';
        },
        'webpubsub.connection.state to be connected',
        500
      );
    });

    it('should process webpubsub:signin_success', async function () {
      transport.emit('message', {
        data: JSON.stringify({
          event: 'webpubsub:signin_success',
          data: {
            user_data: JSON.stringify({ id: '1', name: 'test' })
          }
        })
      });

      expect(webpubsub.user.user_data).toEqual({ id: '1', name: 'test' });
      expect(webpubsub.user.serverToUserChannel.subscriptionPending).toBe(true);
    });

    it('should log warning if user_data is not JSON', async function () {
      spyOn(Logger, 'error');
      transport.emit('message', {
        data: JSON.stringify({
          event: 'webpubsub:signin_success',
          data: {
            user_data: "I'm not JSON"
          }
        })
      });
      expect(Logger.error).toHaveBeenCalledWith(
        "Failed parsing user data after signin: I'm not JSON"
      );
      expect(webpubsub.user.user_data).toEqual(null);
    });

    it('should bind to servetToUser channel events after sign in', async function () {
      const fooCallback = jasmine.createSpy('fooCallback');
      const barCallback = jasmine.createSpy('barCallback');
      webpubsub.user.bind('foo', fooCallback);
      webpubsub.user.bind('bar', barCallback);

      // Send events on channel without being signed in
      transport.emit('message', {
        data: JSON.stringify({
          channel: '#server-to-user-1',
          event: 'foo',
          data: { 'something': 'another' }
        })
      });

      expect(fooCallback).not.toHaveBeenCalled();
      expect(barCallback).not.toHaveBeenCalled();

      // Sign in successfully
      transport.emit('message', {
        data: JSON.stringify({
          event: 'webpubsub:signin_success',
          data: {
            user_data: JSON.stringify({ id: '1', name: 'test' })
          }
        })
      });
      transport.emit('message', {
        data: JSON.stringify({
          channel: '#server-to-user-1',
          event: 'webpubsub_internal:subscription_succeeded',
          data: {}
        })
      });
      await waitsFor(
        function () {
          return webpubsub.user.serverToUserChannel.subscribed === true;
        },
        'webpubsub.user.serverToUserChannel.subscribed to be true',
        500
      );

      // Send events on channel
      transport.emit('message', {
        data: JSON.stringify({
          channel: '#server-to-user-1',
          event: 'foo',
          data: { 'something': 'another' }
        })
      });

      expect(fooCallback).toHaveBeenCalledWith({ 'something': 'another' });
      expect(barCallback).not.toHaveBeenCalled();
    });


    it('should cleanup the signed in state when disconnected', async function () {
      // Sign in successfully
      transport.emit('message', {
        data: JSON.stringify({
          event: 'webpubsub:signin_success',
          data: {
            user_data: JSON.stringify({ id: '1', name: 'test' })
          }
        })
      });
      transport.emit('message', {
        data: JSON.stringify({
          channel: '#server-to-user-1',
          event: 'webpubsub_internal:subscription_succeeded',
          data: {}
        })
      });
      await waitsFor(
        function () {
          return webpubsub.user.serverToUserChannel.subscribed === true;
        },
        'webpubsub.user.serverToUserChannel.subscribed to be true',
        500
      );
      expect(webpubsub.user.user_data).toEqual({ id: '1', name: 'test' });
      expect(webpubsub.user.serverToUserChannel.subscribed).toBe(true);

      // Disconnect
      webpubsub.connection.emit('disconnected');

      expect(webpubsub.user.user_data).toEqual(null);
      expect(webpubsub.user.serverToUserChannel).toEqual(null);
    });
  });

});
