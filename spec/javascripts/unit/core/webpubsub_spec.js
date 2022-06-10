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

describe("Webpubsub", function() {
  var _isReady, _instances, _logToConsole;

  switch (TestEnv) {
    case "worker":
    case "node":
      var timelineTransport = "xhr";
      break;
    case "web":
      var timelineTransport = "jsonp";
      break;
    default:
      throw "Please specify the test environment as an external.";
  }

  beforeEach(function() {
    _instances = Webpubsub.instances;
    _isReady = Webpubsub.isReady;
    _logToConsole = Webpubsub.logToConsole;
    Webpubsub.isReady = false;
    Webpubsub.instances = [];

    spyOn(Runtime, "getDefaultStrategy").and.callFake(function() {
      return Mocks.getStrategy(true);
    });

    spyOn(Factory, "createConnectionManager").and.callFake(function(
      key,
      options,
      config
    ) {
      var manager = Mocks.getConnectionManager();
      manager.key = key;
      manager.options = options;
      manager.config = config;
      return manager;
    });
    spyOn(Factory, "createChannel").and.callFake(function(name, _) {
      return Mocks.getChannel(name);
    });

    if (TestEnv === "web") {
      spyOn(Runtime, "getDocument").and.returnValue({
        location: {
          protocol: "http:"
        }
      });
    }
  });

  afterEach(function() {
    Webpubsub.instances = _instances;
    Webpubsub.isReady = _isReady;
    Webpubsub.logToConsole = _logToConsole;
  });

  describe("app key validation", function() {
    it("should throw on a null key", function() {
      expect(function() {
        new Webpubsub(null);
      }).toThrow("You must pass your app key when you instantiate Webpubsub.");
    });

    it("should throw on an undefined key", function() {
      expect(function() {
        new Webpubsub();
      }).toThrow("You must pass your app key when you instantiate Webpubsub.");
    });

    it("should allow a hex key", function() {
      spyOn(Logger, "warn");
      var webpubsub = new Webpubsub("1234567890abcdef", { cluster: "mt1" });
      expect(Logger.warn).not.toHaveBeenCalled();
    });

    it("should warn if no cluster is supplied", function() {
      spyOn(Logger, "warn");
      var webpubsub = new Webpubsub("1234567890abcdef");
      expect(Logger.warn).toHaveBeenCalled();
    });

    it("should not warn if no cluster is supplied if wsHost or httpHost are supplied", function() {
      spyOn(Logger, "warn");
      var wsWebpubsub = new Webpubsub("1234567890abcdef", { wsHost: "example.com" });
      var httpWebpubsub = new Webpubsub("1234567890abcdef", {
        httpHost: "example.com"
      });
      expect(Logger.warn).not.toHaveBeenCalled();
      expect(Logger.warn).not.toHaveBeenCalled();
    });
  });

  describe("after construction", function() {
    var webpubsub;

    beforeEach(function() {
      webpubsub = new Webpubsub("foo");
    });

    it("should create a timeline with the correct key", function() {
      expect(webpubsub.timeline.key).toEqual("foo");
    });

    it("should create a timeline with a session id", function() {
      expect(webpubsub.timeline.session).toEqual(webpubsub.sessionID);
    });

    it("should pass the cluster name to the timeline", function() {
      var webpubsub = new Webpubsub("foo");
      expect(webpubsub.timeline.options.cluster).toBe(Defaults.cluster);

      webpubsub = new Webpubsub("foo", { cluster: "spec" });
      expect(webpubsub.timeline.options.cluster).toEqual("spec");
    });

    it("should pass a feature list to the timeline", function() {
      spyOn(Webpubsub, "getClientFeatures").and.returnValue(["foo", "bar"]);
      var webpubsub = new Webpubsub("foo");
      expect(webpubsub.timeline.options.features).toEqual(["foo", "bar"]);
    });

    it("should pass the version number to the timeline", function() {
      expect(webpubsub.timeline.options.version).toEqual(Defaults.VERSION);
    });

    it("should pass per-connection timeline params", function() {
      webpubsub = new Webpubsub("foo", { timelineParams: { horse: true } });
      expect(webpubsub.timeline.options.params).toEqual({ horse: true });
    });

    it("should find subscribed channels", function() {
      var channel = webpubsub.subscribe("chan");
      expect(webpubsub.channel("chan")).toBe(channel);
    });

    it("should not find unsubscribed channels", function() {
      expect(webpubsub.channel("chan")).toBe(undefined);
      webpubsub.subscribe("chan");
      webpubsub.unsubscribe("chan");
      expect(webpubsub.channel("chan")).toBe(undefined);
    });

    describe("TLS", function() {
      it("should be off by default", function() {
        expect(webpubsub.shouldUseTLS()).toBe(true);
      });

      it("should be off when forceTLS parameter is passed", function() {
        var webpubsub = new Webpubsub("foo", { forceTLS: false });
        expect(webpubsub.shouldUseTLS()).toBe(false);
      });

      if (TestEnv === "web") {
        it("should be on when using https", function() {
          Runtime.getDocument.and.returnValue({
            location: {
              protocol: "https:"
            }
          });
          var webpubsub = new Webpubsub("foo", { forceTLS: false });
          expect(webpubsub.shouldUseTLS()).toBe(true);
        });
      }
    });

    describe("with getStrategy function", function() {
      it("should construct a strategy instance", function() {
        var strategy = webpubsub.connection.options.getStrategy();
        expect(strategy.isSupported).toEqual(jasmine.any(Function));
        expect(strategy.connect).toEqual(jasmine.any(Function));
      });

      it("should pass config and options to the strategy builder", function() {
        var config = DefaultConfig.getConfig({});
        var options = { useTLS: true };

        var getStrategy = webpubsub.connection.options.getStrategy;
        getStrategy(options);
        expect(Runtime.getDefaultStrategy).toHaveBeenCalledWith(
          webpubsub.config,
          options,
          jasmine.any(Function)
        );
      });
    });

    describe("connection manager", function() {
      it("should have the right key", function() {
        var webpubsub = new Webpubsub("beef");
        expect(webpubsub.connection.key).toEqual("beef");
      });

      it("should have default timeouts", function() {
        var webpubsub = new Webpubsub("foo");
        var options = webpubsub.connection.options;

        expect(options.activityTimeout).toEqual(Defaults.activityTimeout);
        expect(options.pongTimeout).toEqual(Defaults.pongTimeout);
        expect(options.unavailableTimeout).toEqual(Defaults.unavailableTimeout);
      });

      it("should use user-specified timeouts", function() {
        var webpubsub = new Webpubsub("foo", {
          activityTimeout: 123,
          pongTimeout: 456,
          unavailableTimeout: 789
        });
        var options = webpubsub.connection.options;

        expect(options.activityTimeout).toEqual(123);
        expect(options.pongTimeout).toEqual(456);
        expect(options.unavailableTimeout).toEqual(789);
      });
    });
  });

  describe(".ready", function() {
    it("should start connection attempts for instances", function() {
      var webpubsub = new Webpubsub("01234567890abcdef");
      spyOn(webpubsub, "connect");

      expect(webpubsub.connect).not.toHaveBeenCalled();
      Webpubsub.ready();
      expect(webpubsub.connect).toHaveBeenCalled();
    });
  });

  describe("#connect", function() {
    it("should call connect on connection manager", function() {
      var webpubsub = new Webpubsub("foo");
      webpubsub.connect();
      expect(webpubsub.connection.connect).toHaveBeenCalledWith();
    });
  });

  describe("after connecting", function() {
    var webpubsub;

    beforeEach(function() {
      webpubsub = new Webpubsub("foo");
      webpubsub.connect();
      webpubsub.connection.state = "connected";
      webpubsub.connection.emit("connected");
    });

    it("should subscribe to all channels", function() {
      webpubsub = new Webpubsub("foo");
      var subscribedChannels = {
        channel1: webpubsub.subscribe("channel1"),
        channel2: webpubsub.subscribe("channel2")
      };

      expect(subscribedChannels.channel1.subscribe).not.toHaveBeenCalled();
      expect(subscribedChannels.channel2.subscribe).not.toHaveBeenCalled();

      webpubsub.connect();
      webpubsub.connection.state = "connected";
      webpubsub.connection.emit("connected");

      expect(subscribedChannels.channel1.subscribe).toHaveBeenCalled();
      expect(subscribedChannels.channel2.subscribe).toHaveBeenCalled();
    });

    it("should send events via the connection manager", function() {
      webpubsub.send_event("event", { key: "value" }, "channel");
      expect(webpubsub.connection.send_event).toHaveBeenCalledWith(
        "event",
        { key: "value" },
        "channel"
      );
    });

    describe("#subscribe", function() {
      it("should return the same channel object for subsequent calls", function() {
        var channel = webpubsub.subscribe("xxx");
        expect(channel.name).toEqual("xxx");
        expect(webpubsub.subscribe("xxx")).toBe(channel);
      });

      it("should subscribe the channel", function() {
        var channel = webpubsub.subscribe("xxx");
        expect(channel.subscribe).toHaveBeenCalled();
      });

      it("should reinstate cancelled pending subscription", function() {
        var channel = webpubsub.subscribe("xxx");
        channel.subscriptionPending = true;
        channel.subscriptionCancelled = true;
        webpubsub.subscribe("xxx");

        expect(channel.reinstateSubscription).toHaveBeenCalled();
      });
    });

    describe("#unsubscribe", function() {
      it("should unsubscribe the channel if subscription is not pending", function() {
        var channel = webpubsub.subscribe("yyy");
        channel.subscribed = true;
        expect(channel.unsubscribe).not.toHaveBeenCalled();

        webpubsub.unsubscribe("yyy");
        expect(channel.unsubscribe).toHaveBeenCalled();
      });

      it("should not unsubscribe the channel if the channel is not subscribed", function() {
        var channel = webpubsub.subscribe("yyy");
        channel.subscribed = false;
        expect(channel.unsubscribe).not.toHaveBeenCalled();

        webpubsub.unsubscribe("yyy");
        expect(channel.unsubscribe).not.toHaveBeenCalled();
      });

      it("should remove the channel from .channels if subscription is not pending", function() {
        var channel = webpubsub.subscribe("yyy");
        expect(webpubsub.channel("yyy")).toBe(channel);

        webpubsub.unsubscribe("yyy");
        expect(webpubsub.channel("yyy")).toBe(undefined);
      });

      it("should delay unsubscription if the subscription is pending", function() {
        var channel = webpubsub.subscribe("yyy");
        channel.subscriptionPending = true;

        webpubsub.unsubscribe("yyy");
        expect(webpubsub.channel("yyy")).toBe(channel);
        expect(channel.unsubscribe).not.toHaveBeenCalled();
        expect(channel.cancelSubscription).toHaveBeenCalled();
      });
    });
  });

  describe("on message", function() {
    var webpubsub;

    beforeEach(function() {
      webpubsub = new Webpubsub("foo");
    });

    it("should pass events to their channels", function() {
      var channel = webpubsub.subscribe("chan");

      webpubsub.connection.emit("message", {
        channel: "chan",
        event: "event",
        data: { key: "value" }
      });
      expect(channel.handleEvent).toHaveBeenCalledWith({
        channel: "chan",
        event: "event",
        data: { key: "value" }
      });
    });

    it("should not publish events to other channels", function() {
      var channel = webpubsub.subscribe("chan");
      var onEvent = jasmine.createSpy("onEvent");
      channel.bind("event", onEvent);

      webpubsub.connection.emit("message", {
        channel: "different",
        event: "event",
        data: {}
      });
      expect(onEvent).not.toHaveBeenCalled();
    });

    it("should publish per-channel events globally (deprecated)", function() {
      var onEvent = jasmine.createSpy("onEvent");
      webpubsub.bind("event", onEvent);

      webpubsub.connection.emit("message", {
        channel: "chan",
        event: "event",
        data: { key: "value" }
      });
      expect(onEvent).toHaveBeenCalledWith({ key: "value" });
    });

    it("should publish global events (deprecated)", function() {
      var onEvent = jasmine.createSpy("onEvent");
      var onAllEvents = jasmine.createSpy("onAllEvents");
      webpubsub.bind("global", onEvent);
      webpubsub.bind_global(onAllEvents);

      webpubsub.connection.emit("message", {
        event: "global",
        data: "data"
      });
      expect(onEvent).toHaveBeenCalledWith("data");
      expect(onAllEvents).toHaveBeenCalledWith("global", "data");
    });

    it("should not publish internal events", function() {
      var onEvent = jasmine.createSpy("onEvent");
      webpubsub.bind("webpubsub_internal:test", onEvent);

      webpubsub.connection.emit("message", {
        event: "webpubsub_internal:test",
        data: "data"
      });
      expect(onEvent).not.toHaveBeenCalled();
    });
  });

  describe("#unbind", function() {
    var webpubsub;

    beforeEach(function() {
      webpubsub = new Webpubsub("foo");
    });

    it("should allow a globally bound callback to be removed", function() {
      var onEvent = jasmine.createSpy("onEvent");
      webpubsub.bind("event", onEvent);
      webpubsub.unbind("event", onEvent);

      webpubsub.connection.emit("message", {
        channel: "chan",
        event: "event",
        data: { key: "value" }
      });
      expect(onEvent).not.toHaveBeenCalled();
    });
  });


  describe("#disconnect", function() {
    it("should call disconnect on connection manager", function() {
      var webpubsub = new Webpubsub("foo");

      webpubsub.disconnect();
      expect(webpubsub.connection.disconnect).toHaveBeenCalledWith();
    });
  });

  describe("after disconnecting", function() {
    it("should disconnect channels", function() {
      var webpubsub = new Webpubsub("foo");
      var channel1 = webpubsub.subscribe("channel1");
      var channel2 = webpubsub.subscribe("channel2");

      webpubsub.connection.state = "disconnected";
      webpubsub.connection.emit("disconnected");

      expect(channel1.disconnect).toHaveBeenCalledWith();
      expect(channel2.disconnect).toHaveBeenCalledWith();
    });
  });

  describe("on error", function() {
    it("should log a warning to console", function() {
      var webpubsub = new Webpubsub("foo");

      spyOn(Logger, "warn");
      webpubsub.connection.emit("error", "something");
      expect(Logger.warn).toHaveBeenCalledWith("something");
    });
  });

  describe("metrics", function() {
    var timelineSender;

    beforeEach(function() {
      jasmine.clock().uninstall();
      jasmine.clock().install();

      timelineSender = Mocks.getTimelineSender();
      spyOn(Factory, "createTimelineSender").and.returnValue(timelineSender);
    });

    afterEach(function() {
      jasmine.clock().uninstall();
    });

    it("should be sent to stats.webpubsub.com", function() {
      var webpubsub = new Webpubsub("foo", { enableStats: true });
      expect(Factory.createTimelineSender.calls.count()).toEqual(1);
      expect(Factory.createTimelineSender).toHaveBeenCalledWith(
        webpubsub.timeline,
        { host: "stats.webpubsub.com", path: "/timeline/v2/" + timelineTransport }
      );
    });

    it("should be sent to a hostname specified in constructor options", function() {
      var webpubsub = new Webpubsub("foo", {
        statsHost: "example.com",
        enableStats: true
      });
      expect(Factory.createTimelineSender).toHaveBeenCalledWith(
        webpubsub.timeline,
        { host: "example.com", path: "/timeline/v2/" + timelineTransport }
      );
    });

    it("should not be sent by default", function() {
      var webpubsub = new Webpubsub("foo");
      webpubsub.connect();
      webpubsub.connection.options.timeline.info({});
      jasmine.clock().tick(1000000);
      expect(timelineSender.send.calls.count()).toEqual(0);
    });

    it("should be sent if disableStats set to false", function() {
      var webpubsub = new Webpubsub("foo", { disableStats: false });
      webpubsub.connect();
      webpubsub.connection.options.timeline.info({});
      expect(Factory.createTimelineSender.calls.count()).toEqual(1);
      expect(Factory.createTimelineSender).toHaveBeenCalledWith(
        webpubsub.timeline,
        { host: "stats.webpubsub.com", path: "/timeline/v2/" + timelineTransport }
      );
    });

    it("should honour enableStats setting if enableStats and disableStats set", function() {
      var webpubsub = new Webpubsub("foo", { disableStats: true, enableStats: true });
      webpubsub.connect();
      webpubsub.connection.options.timeline.info({});
      expect(Factory.createTimelineSender.calls.count()).toEqual(1);
      expect(Factory.createTimelineSender).toHaveBeenCalledWith(
        webpubsub.timeline,
        { host: "stats.webpubsub.com", path: "/timeline/v2/" + timelineTransport }
      );
    });

    it("should not be sent before calling connect", function() {
      var webpubsub = new Webpubsub("foo", { enableStats: true });
      webpubsub.connection.options.timeline.info({});
      jasmine.clock().tick(1000000);
      expect(timelineSender.send.calls.count()).toEqual(0);
    });

    it("should be sent every 60 seconds after calling connect", function() {
      var webpubsub = new Webpubsub("foo", { enableStats: true });
      webpubsub.connect();
      expect(Factory.createTimelineSender.calls.count()).toEqual(1);

      webpubsub.connection.options.timeline.info({});

      jasmine.clock().tick(59999);
      expect(timelineSender.send.calls.count()).toEqual(0);
      jasmine.clock().tick(1);
      expect(timelineSender.send.calls.count()).toEqual(1);
      jasmine.clock().tick(60000);
      expect(timelineSender.send.calls.count()).toEqual(2);
    });

    it("should be sent after connecting", function() {
      var webpubsub = new Webpubsub("foo", { enableStats: true });
      webpubsub.connect();
      webpubsub.connection.options.timeline.info({});

      webpubsub.connection.state = "connected";
      webpubsub.connection.emit("connected");

      expect(timelineSender.send.calls.count()).toEqual(1);
    });

    it("should not be sent after disconnecting", function() {
      var webpubsub = new Webpubsub("foo", { enableStats: true });
      webpubsub.connect();
      webpubsub.disconnect();

      webpubsub.connection.options.timeline.info({});

      jasmine.clock().tick(1000000);
      expect(timelineSender.send.calls.count()).toEqual(0);
    });

    it("should be sent without TLS if connection is not using TLS", function() {
      var webpubsub = new Webpubsub("foo", { enableStats: true });
      webpubsub.connection.isUsingTLS.and.returnValue(false);

      webpubsub.connect();
      webpubsub.connection.options.timeline.info({});

      webpubsub.connection.state = "connected";
      webpubsub.connection.emit("connected");

      expect(timelineSender.send).toHaveBeenCalledWith(false);
    });

    it("should be sent with TLS if connection is over TLS", function() {
      var webpubsub = new Webpubsub("foo", { enableStats: true });
      webpubsub.connection.isUsingTLS.and.returnValue(true);

      webpubsub.connect();
      webpubsub.connection.options.timeline.info({});

      webpubsub.connection.state = "connected";
      webpubsub.connection.emit("connected");

      expect(timelineSender.send).toHaveBeenCalledWith(true);
    });
  });
});
