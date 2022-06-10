var Errors = require('core/errors');
var PrivateChannel = require('core/channels/private_channel').default;
var Mocks = require("mocks");

describe("PrivateChannel", function() {
  var webpubsub;
  var channel;
  var channelAuthorizer;

  beforeEach(function() {
    channelAuthorizer = jasmine.createSpy("channelAuthorizer")
    webpubsub = Mocks.getWebpubsub({ channelAuthorizer: channelAuthorizer });
    channel = new PrivateChannel("private-test", webpubsub);
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
    it("should call channelAuthorizer", function() {
      const callback = function(){}
      channel.authorize("1.23", callback);
      expect(channelAuthorizer.calls.count()).toEqual(1);
      expect(channelAuthorizer).toHaveBeenCalledWith(
        { socketId: "1.23", channelName: "private-test" }, callback);
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
        .toHaveBeenCalledWith("client-test", { k: "v" }, "private-test");
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
    });
  });
});
