var Errors = require('core/errors');
var Factory = require('core/utils/factory').default;
var Mocks = require("mocks");

describe("Channel", function() {
  var webpubsub;
  var channel;
  var Channel = require('core/channels/channel').default;

  beforeEach(function() {
    webpubsub = Mocks.getWebpubsub();
    channel = new Channel("test", webpubsub);
  });

  describe("after construction", function() {
    it("#subscribed should be false", function() {
      expect(channel.subscribed).toEqual(false);
    });

    it("#subscriptionPending should be false", function() {
      expect(channel.subscriptionPending).toEqual(false);
    });

    it("#subscriptionCancelled should be false", function() {
      expect(channel.subscriptionCancelled).toEqual(false);
    });
  });

  describe("#authorize", function() {
    it("should call back with null, {} immediately", function() {
      var callback = jasmine.createSpy("callback");
      channel.authorize("1.1", callback);
      expect(callback).toHaveBeenCalledWith(null, {auth: ''});
    });
  });

  describe("#trigger", function() {
    beforeEach(function() {
      channel.subscribed = true;
    });

    it("should raise an exception if the event name does not start with client-", function() {
      expect(() => channel.trigger('whatever', {})).toThrow(jasmine.any(Errors.BadEventName));
    });

    it("should call send_event on connection", function() {
      channel.trigger("client-test", { k: "v" });
      expect(webpubsub.send_event)
        .toHaveBeenCalledWith("client-test", { k: "v" }, "test");
    });

    it("should return true if connection sent the event", function() {
      webpubsub.send_event.and.returnValue(true);
      expect(channel.trigger("client-test", {})).toBe(true);
    });

    it("should return false if connection didn't send the event", function() {
      webpubsub.send_event.and.returnValue(false);
      expect(channel.trigger("client-test", {})).toBe(false);
    });
  });

  describe("#disconnect", function() {
    it("should set subscribed to false", function() {
      channel.handleEvent({
        event: "webpubsub_internal:subscription_succeeded"
      });
      channel.disconnect();
      expect(channel.subscribed).toEqual(false);
    });

    it("should set subscriptionPending to false", function() {
      channel.subscriptionPending = true;

      channel.disconnect();

      expect(channel.subscriptionPending).toEqual(false);
    });
  });

  describe("#handleEvent", function() {
    it("should not emit webpubsub_internal:* events", function() {
      var callback = jasmine.createSpy("callback");
      channel.bind("webpubsub_internal:test", callback);
      channel.bind_global(callback);

      channel.handleEvent({
        event: "webpubsub_internal:test"
      });

      expect(callback).not.toHaveBeenCalled();
    });

    describe("on webpubsub_internal:subscription_succeeded", function() {
      it("should emit webpubsub:subscription_succeeded", function() {
        var callback = jasmine.createSpy("callback");
        channel.bind("webpubsub:subscription_succeeded", callback);

        channel.handleEvent({
          event: "webpubsub_internal:subscription_succeeded",
          data: "123"
        });

        expect(callback).toHaveBeenCalledWith("123");
      });

      it("should set #subscribed to true", function() {
        channel.handleEvent({
          event: "webpubsub_internal:subscription_succeeded",
          data: "123"
        });

        expect(channel.subscribed).toEqual(true);
      });

      it("should set #subscriptionPending to false", function() {
        channel.handleEvent({
          event: "webpubsub_internal:subscription_succeeded",
          data: "123"
        });

        expect(channel.subscriptionPending).toEqual(false);
      });
    });

    describe("webpubsub_internal:subscription_succeeded but subscription cancelled", function() {
      it("should not emit webpubsub:subscription_succeeded", function() {
        var callback = jasmine.createSpy("callback");
        channel.bind("webpubsub:subscription_succeeded", callback);

        channel.cancelSubscription();
        channel.handleEvent({
          event: "webpubsub_internal:subscription_succeeded",
          data: "123"
        });

        expect(callback).not.toHaveBeenCalled();
      });

      it("should set #subscribed to true", function() {
        channel.cancelSubscription();
        channel.handleEvent({
          event: "webpubsub_internal:subscription_succeeded",
          data: "123"
        });

        expect(channel.subscribed).toEqual(true);
      });

      it("should set #subscriptionPending to false", function() {
        channel.cancelSubscription();
        channel.handleEvent({
          event: "webpubsub_internal:subscription_succeeded",
          data: "123"
        });

        expect(channel.subscriptionPending).toEqual(false);
      });

      it("should call #webpubsub.unsubscribe", function() {
        expect(webpubsub.unsubscribe).not.toHaveBeenCalled();

        channel.cancelSubscription();
        channel.handleEvent({
          event: "webpubsub_internal:subscription_succeeded",
          data: "123"
        });

        expect(webpubsub.unsubscribe).toHaveBeenCalledWith(channel.name);
      });
    });

    describe("on other events", function() {
      it("should emit the event", function() {
        var callback = jasmine.createSpy("callback");
        channel.bind("something", callback);

        channel.handleEvent({
          event: "something",
          data: 9
        });

        expect(callback).toHaveBeenCalledWith(9, {});
      });

      it("should emit the event even if it's named like JS built-in", function() {
        var callback = jasmine.createSpy("callback");
        channel.bind("toString", callback);

        channel.handleEvent({
          event: "toString",
          data: "works"
        });

        expect(callback).toHaveBeenCalledWith("works", {});
      });
    });
  });

  describe("#subscribe", function() {
    beforeEach(function() {
      webpubsub.connection = {
        socket_id: "9.37"
      };
      channel.authorize = jasmine.createSpy("authorize");
    });

    it("should authorize the connection first", function() {
      expect(channel.authorize.calls.count()).toEqual(0);
      channel.subscribe();

      expect(channel.authorize.calls.count()).toEqual(1);
      expect(channel.authorize).toHaveBeenCalledWith(
        "9.37", jasmine.any(Function)
      );
    });

    it("should send a webpubsub:subscribe message on successful authorization", function() {
      expect(webpubsub.send_event).not.toHaveBeenCalled();

      channel.subscribe();
      var authorizeCallback = channel.authorize.calls.first().args[1];
      authorizeCallback(false, {
        auth: "one",
        channel_data: "two"
      });

      expect(webpubsub.send_event).toHaveBeenCalledWith(
        "webpubsub:subscribe",
        { auth: "one", channel_data: "two", channel: "test" }
      );
    });

    it("should emit webpubsub:subscription_error event on unsuccessful authorization", function() {
      var onSubscriptionError = jasmine.createSpy("onSubscriptionError");
      channel.bind("webpubsub:subscription_error", onSubscriptionError);

      channel.subscribe();
      var authorizeCallback = channel.authorize.calls.first().args[1];
      authorizeCallback(new Error("test error"), {auth: ""})

      expect(onSubscriptionError).toHaveBeenCalledWith(
       {
          type: "AuthError",
          error: "test error"
        }
      );
      expect(webpubsub.send_event).not.toHaveBeenCalled();
    });

    it("should set #subscriptionPending to true if previously unsubscribed", function() {
      expect(channel.subscriptionPending).toEqual(false);

      channel.subscribe();

      expect(channel.subscriptionPending).toEqual(true);
    });

    it("should set #subscriptionPending to false on unsuccessful authorization", function() {
      expect(channel.subscriptionPending).toEqual(false);

      channel.subscribe();
      var authorizeCallback = channel.authorize.calls.first().args[1];
      authorizeCallback(new Error("test error"), {auth: ""})

      expect(channel.subscriptionPending).toEqual(false);
    });

    it("should keep #subscriptionPending set as true after a successful authorization", function() {
      expect(channel.subscriptionPending).toEqual(false);

      channel.subscribe();
      var authorizeCallback = channel.authorize.calls.first().args[1];
      authorizeCallback(false, {
        auth: "one",
        channel_data: "two"
      });

      expect(channel.subscriptionPending).toEqual(true);
    });

    it("should do nothing if already subscribed", function() {
      channel.subscribed = true;

      channel.subscribe();

      expect(channel.subscriptionPending).toEqual(false);
    });
  });

  describe("#unsubscribe", function() {
    it("should send a webpubsub:unsubscribe message", function() {
      expect(webpubsub.send_event).not.toHaveBeenCalled();
      channel.unsubscribe();

      expect(webpubsub.send_event).toHaveBeenCalledWith(
        "webpubsub:unsubscribe", { channel: "test" }
      );
    });

    it("should set #subscribed to false", function() {
      channel.subscribed = true;

      channel.unsubscribe();

      expect(channel.subscribed).toEqual(false);
    });
  });

  describe("#cancelSubscription", function() {
    it("should set #subscriptionCancelled to true", function() {
      expect(channel.subscriptionCancelled).toEqual(false);

      channel.cancelSubscription();

      expect(channel.subscriptionCancelled).toEqual(true);
    });
  });

  describe("#reinstateSubscription", function() {
    it("should set #subscriptionCancelled to false", function() {
      channel.cancelSubscription()
      expect(channel.subscriptionCancelled).toEqual(true);

      channel.reinstateSubscription();

      expect(channel.subscriptionCancelled).toEqual(false);
    });
  });
});
