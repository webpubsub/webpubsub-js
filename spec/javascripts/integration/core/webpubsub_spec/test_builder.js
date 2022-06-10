const Webpubsub = require('webpubsub_integration');

const Integration = require('integration');
const OneOffTimer = require('core/utils/timers').OneOffTimer;
const Collections = require('core/utils/collections');
const Runtime = require('runtime').default;
const TRANSPORTS = Runtime.Transports;
const waitsFor = require('../../../helpers/waitsFor');

// this is a slightly horrible function that allows easy placement of arbitrary
// delays in jasmine async tests. e.g:
// waitsFor(sleep(3000), "thing to happen", 3500)
function sleep(time) {
  var fn = function() {
    var val = false;
    setTimeout(function(){
      val = true;
    }, time)
    return function() {
      return val;
    }
  }
  return fn();
}

function canRunTwoConnections(transport) {
  if (transport !== "sockjs") {
    return true;
  }
  return !/(MSIE [67])|(Version\/(4|5\.0).*Safari)/.test(navigator.userAgent);
}

function subscribe(webpubsub, channelName, callback) {
  var channel = webpubsub.subscribe(channelName);
  channel.bind("webpubsub:subscription_succeeded", function(param) {
    callback(channel, param);
  });
  return channel;
}

function build(testConfig) {
  var forceTLS = testConfig.forceTLS;
  var transport = testConfig.transport;

  if (!TRANSPORTS[transport].isSupported({ useTLS: forceTLS })) {
    return;
  }

  describe("with " + (transport ? transport + ", " : "") + "forceTLS=" + forceTLS, function() {
    var webpubsub1, webpubsub2;
    var jasmineDefaultTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;

    beforeAll(() => {
      jasmine.DEFAULT_TIMEOUT_INTERVAL = 41000;
    });

    afterAll(() => {
      jasmine.DEFAULT_TIMEOUT_INTERVAL = jasmineDefaultTimeout;
    });

    beforeEach(function() {
      Collections.objectApply(TRANSPORTS, function(t, name) {
        spyOn(t, "isSupported").and.returnValue(false);
      });
      TRANSPORTS[transport].isSupported.and.returnValue(true);
    });

    describe("setup", function() {
      it("should open connections", async function() {
        webpubsub1 = new Webpubsub("7324d55a5eeb8f554761", {
          forceTLS: forceTLS,
        });
        if (canRunTwoConnections(transport)) {
          webpubsub2 = new Webpubsub("7324d55a5eeb8f554761", {
            forceTLS: forceTLS,
          });
          await waitsFor(function() {
            return webpubsub2.connection.state === "connected";
          }, "second connection to be established", 20000);
        }
        await waitsFor(function() {
          return webpubsub1.connection.state === "connected";
        }, "first connection to be established", 20000);
      });

    });

    describe("with a public channel", function() {
      buildPublicChannelTests(
        function() { return webpubsub1; }
      );
    });

    describe("with a private channel", function() {
      var channelName = Integration.getRandomName("private-integration");
      var channel1, channel2;

      buildSubscriptionStateTests(
        function() { return webpubsub1; },
        "private-"
      );

      if (canRunTwoConnections(transport)) {
        buildClientEventsTests(
          function() { return webpubsub1; },
          function() { return webpubsub2; },
          "private-"
        );
      }
    });

    describe("with a presence channel", function() {
      buildSubscriptionStateTests(
        function() { return webpubsub1; },
        "presence-"
      );

      if (canRunTwoConnections(transport)) {
        buildClientEventsTests(
          function() { return webpubsub1; },
          function() { return webpubsub2; },
          "presence-"
        );
        buildPresenceChannelTests(
          function() { return webpubsub1; },
          function() { return webpubsub2; }
        );
      }
    });

    describe("teardown", function() {
      if (canRunTwoConnections(transport)) {
        it("should disconnect second connection", function() {
          webpubsub2.disconnect();
        });
      }

      it("should disconnect first connection", function() {
        webpubsub1.disconnect();
      });
    });
  });
}
function buildPresenceChannelTests(getWebpubsub1, getWebpubsub2) {
  it("should get connection's member data", async function() {
    var webpubsub = getWebpubsub1();
    var channelName = Integration.getRandomName("presence-integration_me");

    var members = null;
    subscribe(webpubsub, channelName, function(channel, ms) {
      members = ms;
    });

    await waitsFor(function() {
      return members !== null;
    }, "channel to subscribe", 10000);

    expect(members.me).toEqual({
      id: webpubsub.connection.socket_id,
      info: {
        name: "Integration " + webpubsub.connection.socket_id,
        email: "integration-" + webpubsub.connection.socket_id + "@example.com"
      }
    });
  });

  it("should receive a member added event", async function() {
    var webpubsub1 = getWebpubsub1();
    var webpubsub2 = getWebpubsub2();
    var channelName = Integration.getRandomName("presence-integration_member_added");

    var member = null;
    subscribe(webpubsub1, channelName, function(channel) {
      channel.bind("webpubsub:member_added", function(m) {
        member = m;
      });

      subscribe(webpubsub2, channelName, function() {});
    });

    await waitsFor(function() {
      return member !== null;
    }, "the member added event", 10000);

    expect(member.id).toEqual(webpubsub2.connection.socket_id);
    expect(member).toEqual({
      id: webpubsub2.connection.socket_id,
      info: {
        name: "Integration " + webpubsub2.connection.socket_id,
        email: "integration-" + webpubsub2.connection.socket_id + "@example.com"
      }
    });

    webpubsub1.unsubscribe(channelName);
    webpubsub2.unsubscribe(channelName);
  });

  it("should receive a member removed event", async function() {
    var webpubsub1 = getWebpubsub1();
    var webpubsub2 = getWebpubsub2();
    var channelName = Integration.getRandomName("presence-integration_member_removed");

    var member = null;
    subscribe(webpubsub2, channelName, function(channel) {
      channel.bind("webpubsub:member_added", function(_) {
        channel.bind("webpubsub:member_removed", function(m) {
          member = m;
        });
        webpubsub1.unsubscribe(channelName);
      });

      subscribe(webpubsub1, channelName, function() {});
    });

    await waitsFor(function() {
      return member !== null;
    }, "the member removed event", 10000);

    expect(member.id).toEqual(webpubsub1.connection.socket_id);
    expect(member).toEqual({
      id: webpubsub1.connection.socket_id,
      info: {
        name: "Integration " + webpubsub1.connection.socket_id,
        email: "integration-" + webpubsub1.connection.socket_id + "@example.com"
      }
    });

    webpubsub2.unsubscribe(channelName);
  });

  it("should maintain correct members count", async function() {
    var webpubsub1 = getWebpubsub1();
    var webpubsub2 = getWebpubsub2();
    var channelName = Integration.getRandomName("presence-integration_member_count");

    var channel1, channel2;

    var onSubscribed1 = jasmine.createSpy("onSubscribed1");
    var onSubscribed2 = jasmine.createSpy("onSubscribed2");
    var onMemberAdded = jasmine.createSpy("onMemberAdded");
    var onMemberRemoved = jasmine.createSpy("onMemberRemoved");

    channel1 = subscribe(webpubsub1, channelName, onSubscribed1);
    expect(channel1.members.count).toEqual(0);

    await waitsFor(function() {
      return onSubscribed1.calls.count() > 0;
    }, "first connection to subscribe", 10000);

    expect(channel1.members.count).toEqual(1);
    channel1.bind("webpubsub:member_added", onMemberAdded);
    channel2 = subscribe(webpubsub2, channelName, onSubscribed2);

    await waitsFor(function() {
      return onSubscribed2.calls.count() > 0;
    }, "second connection to subscribe", 10000);

    expect(channel2.members.count).toEqual(2);

    await waitsFor(function() {
      return onMemberAdded.calls.count() > 0;
    }, "member added event", 10000);

    expect(channel1.members.count).toEqual(2);
    channel2.bind("webpubsub:member_removed", onMemberRemoved);
    webpubsub1.unsubscribe(channelName);

    await waitsFor(function() {
      return onMemberRemoved.calls.count() > 0;
    }, "member removed event", 10000);

    expect(channel2.members.count).toEqual(1);
  });

  it("should maintain correct members data", async function() {
    var webpubsub1 = getWebpubsub1();
    var webpubsub2 = getWebpubsub2();
    var channelName = Integration.getRandomName("presence-integration_member_count");

    var channel1, channel2;

    var onSubscribed1 = jasmine.createSpy("onSubscribed1");
    var onSubscribed2 = jasmine.createSpy("onSubscribed2");
    var onMemberAdded = jasmine.createSpy("onMemberAdded");
    var onMemberRemoved = jasmine.createSpy("onMemberRemoved");

    var member1 = {
      id: webpubsub1.connection.socket_id,
      info: {
        name: "Integration " + webpubsub1.connection.socket_id,
        email: "integration-" + webpubsub1.connection.socket_id + "@example.com"
      }
    };
    var member2 = {
      id: webpubsub2.connection.socket_id,
      info: {
        name: "Integration " + webpubsub2.connection.socket_id,
        email: "integration-" + webpubsub2.connection.socket_id + "@example.com"
      }
    };

    channel1 = subscribe(webpubsub1, channelName, onSubscribed1);

    await waitsFor(function() {
      return onSubscribed1.calls.count() > 0;
    }, "first connection to subscribe", 10000);

    expect(channel1.members.get(webpubsub1.connection.socket_id))
      .toEqual(member1);
    expect(channel1.members.get(webpubsub2.connection.socket_id))
      .toBe(null);

    expect(channel1.members.me).toEqual(member1);

    channel1.bind("webpubsub:member_added", onMemberAdded);
    channel2 = subscribe(webpubsub2, channelName, onSubscribed2);

    await waitsFor(function() {
      return onSubscribed2.calls.count() > 0;
    }, "second connection to subscribe", 10000);

    expect(channel2.members.get(webpubsub1.connection.socket_id))
      .toEqual(member1);
    expect(channel2.members.get(webpubsub2.connection.socket_id))
      .toEqual(member2);

    expect(channel2.members.me).toEqual(member2);

    await waitsFor(function() {
      return onMemberAdded.calls.count() > 0;
    }, "member added event", 10000);

    expect(channel1.members.get(webpubsub1.connection.socket_id))
      .toEqual(member1);
    expect(channel1.members.get(webpubsub2.connection.socket_id))
      .toEqual(member2);

    channel2.bind("webpubsub:member_removed", onMemberRemoved);
    webpubsub1.unsubscribe(channelName);

    await waitsFor(function() {
      return onMemberRemoved.calls.count() > 0;
    }, "member removed event", 10000);

    expect(channel2.members.get(webpubsub1.connection.socket_id))
      .toBe(null);
    expect(channel2.members.get(webpubsub2.connection.socket_id))
      .toEqual(member2);
  });
}
function buildClientEventsTests(getWebpubsub1, getWebpubsub2, prefix) {
  it("should receive a client event sent by another connection", async function() {
    var webpubsub1 = getWebpubsub1();
    var webpubsub2 = getWebpubsub2();

    var channelName = Integration.getRandomName((prefix || "") + "integration_client_events");

    var channel1, channel2;
    var onSubscribed1 = jasmine.createSpy("onSubscribed1");
    var onSubscribed2 = jasmine.createSpy("onSubscribed2");

    var eventName = "client-test";
    var data = { foo: "bar" };
    var onEvent1 = jasmine.createSpy("onEvent1");
    var onEvent2 = jasmine.createSpy("onEvent2");


    channel1 = subscribe(webpubsub1, channelName, onSubscribed1);
    channel2 = subscribe(webpubsub2, channelName, onSubscribed2);

    await waitsFor(function() {
      return onSubscribed1.calls.count() > 0 && onSubscribed2.calls.count() > 0;
    }, "both connections to subscribe", 10000);

    channel1.bind(eventName, onEvent1);
    channel2.bind(eventName, onEvent2);
    webpubsub1.send_event(eventName, data, channelName);

    await waitsFor(function() {
      return onEvent2.calls.count();
    }, "second connection to receive a message", 10000);

    webpubsub1.unsubscribe(channelName);
    webpubsub2.unsubscribe(channelName);
  });

  it("should not receive a client event sent by itself", async function() {
    var webpubsub = getWebpubsub1();

    var channelName = Integration.getRandomName((prefix || "") + "integration_client_events");
    var onSubscribed = jasmine.createSpy("onSubscribed");

    var eventName = "client-test";
    var onEvent = jasmine.createSpy("onEvent");
    var timer = null;

    var channel = subscribe(webpubsub, channelName, onSubscribed);
    await waitsFor(function() {
      return onSubscribed.calls.count() > 0;
    }, "connection to subscribe", 10000);

    channel.bind(eventName, onEvent);
    webpubsub.send_event(eventName, {}, channelName);
    timer = new OneOffTimer(3000, function() {});

    await waitsFor(function() {
      return !timer.isRunning();
    }, "timer to finish", 3210);

    expect(onEvent).not.toHaveBeenCalled();
    webpubsub.unsubscribe(channelName);
  });
}
function buildPublicChannelTests(getWebpubsub, prefix) {
  it("should subscribe and receive a message sent via REST API", async function() {
    var webpubsub = getWebpubsub();
    var channelName = Integration.getRandomName((prefix || "") + "integration");

    var onSubscribed = jasmine.createSpy("onSubscribed");
    var channel = subscribe(webpubsub, channelName, onSubscribed);

    var eventName = "integration_event";
    var data = { x: 1, y: "z" };
    var received = null;

    await waitsFor(function() {
      return onSubscribed.calls.count();
    }, "subscription to succeed", 10000);

    channel.bind(eventName, function(message) {
      received = message;
    });
    Integration.sendAPIMessage({
      url: Integration.API_URL + "/v2/send",
      channel: channelName,
      event: eventName,
      data: data
    });

    await waitsFor(function() {
      return received !== null;
    }, "message to get delivered", 10000);

    expect(received).toEqual(data);
    webpubsub.unsubscribe(channelName);
  });

  it("should not receive messages after unsubscribing", async function() {
    var webpubsub = getWebpubsub();
    var channelName = Integration.getRandomName((prefix || "") + "integration");

    var onSubscribed = jasmine.createSpy("onSubscribed");
    var channel = subscribe(webpubsub, channelName, onSubscribed);

    var eventName = "after_unsubscribing";
    var received = null;
    var timer = null;

    await waitsFor(function() {
      return onSubscribed.calls.count();
    }, "subscription to succeed", 10000);

    channel.bind(eventName, function(message) {
      received = message;
    });
    webpubsub.unsubscribe(channelName);
    Integration.sendAPIMessage({
      url: Integration.API_URL + "/v2/send",
      channel: channelName,
      event: eventName,
      data: {}
    });
    timer = new OneOffTimer(3000, function() {});

    await waitsFor(function() {
      return !timer.isRunning();
    }, "timer to finish", 3210);

    expect(received).toBe(null);
  });

  it("should handle unsubscribing as an idempotent operation", async function() {
    var webpubsub = getWebpubsub();
    var channelName = Integration.getRandomName((prefix || "") + "integration");

    var onSubscribed = jasmine.createSpy("onSubscribed");
    subscribe(webpubsub, channelName, onSubscribed);

    await waitsFor(function() {
      return onSubscribed.calls.count();
    }, "subscription to succeed", 10000);

    webpubsub.unsubscribe(channelName);
    webpubsub.unsubscribe(channelName);
    webpubsub.unsubscribe(channelName);
  });

  it("should handle cancelling pending subscription", async function() {
    var webpubsub = getWebpubsub();
    var channelName = Integration.getRandomName((prefix || "") + "integration");

    var eventName = "after_unsubscribing";
    var received = null;
    var timer = null;

    var channel = webpubsub.subscribe(channelName);
    channel.bind(eventName, function(message) {
      received = message;
    });

    webpubsub.unsubscribe(channelName);
    await waitsFor(function() {
      return !channel.subscriptionPending;
    }, "subscription to succeed", 10000);

    Integration.sendAPIMessage({
      url: Integration.API_URL + "/v2/send",
      channel: channelName,
      event: eventName,
      data: {}
    });
    timer = new OneOffTimer(3000, function() {});

    await waitsFor(function() {
      return !timer.isRunning();
    }, "timer to finish", 10000);

    expect(channel.subscribed).toEqual(false);
    expect(received).toBe(null);
  });

  it("should handle reinstating cancelled pending subscription", async function() {
    var webpubsub = getWebpubsub();
    var channelName = Integration.getRandomName((prefix || "") + "integration");

    var eventName = "after_subscribing";
    var received = null;
    var timer = null;

    var channel = webpubsub.subscribe(channelName);
    channel.bind(eventName, function(message) {
      received = message;
    });

    webpubsub.unsubscribe(channelName);
    webpubsub.subscribe(channelName);
    await waitsFor(function() {
      return !channel.subscriptionPending;
    }, "subscription to succeed", 10000);

    Integration.sendAPIMessage({
      url: Integration.API_URL + "/v2/send",
      channel: channelName,
      event: eventName,
      data: {}
    });
    timer = new OneOffTimer(3000, function() {});

    await waitsFor(function() {
      return !timer.isRunning();
    }, "timer to finish", 10000);

    expect(channel.subscribed).toEqual(true);
    expect(received).not.toBe(null);
  });
}

function buildSubscriptionStateTests(getWebpubsub, prefix) {
  it("sub-sub = sub", async function() {
    var webpubsub = getWebpubsub();
    var channelName = Integration.getRandomName((prefix || "") + "integration");

    webpubsub.subscribe(channelName)
    expect(webpubsub.channel(channelName).subscribed).toEqual(false);
    expect(webpubsub.channel(channelName).subscriptionPending).toEqual(true);
    expect(webpubsub.channel(channelName).subscriptionCancelled).toEqual(false);
    webpubsub.subscribe(channelName)
    expect(webpubsub.channel(channelName).subscribed).toEqual(false);
    expect(webpubsub.channel(channelName).subscriptionPending).toEqual(true);
    expect(webpubsub.channel(channelName).subscriptionCancelled).toEqual(false);

    await waitsFor(function() {
      return webpubsub.channel(channelName).subscribed;
    }, "subscription to finish", 10000);

    expect(webpubsub.channel(channelName).subscribed).toEqual(true);
    expect(webpubsub.channel(channelName).subscriptionPending).toEqual(false);
    expect(webpubsub.channel(channelName).subscriptionCancelled).toEqual(false);
  });

  it("sub-wait-sub = sub", async function() {
    var webpubsub = getWebpubsub();
    var channelName = Integration.getRandomName((prefix || "") + "integration");

    webpubsub.subscribe(channelName)
    expect(webpubsub.channel(channelName).subscribed).toEqual(false);
    expect(webpubsub.channel(channelName).subscriptionPending).toEqual(true);
    expect(webpubsub.channel(channelName).subscriptionCancelled).toEqual(false);

    await waitsFor(function() {
      return webpubsub.channel(channelName).subscribed;
    }, "subscription to finish", 10000);

    expect(webpubsub.channel(channelName).subscribed).toEqual(true);
    expect(webpubsub.channel(channelName).subscriptionPending).toEqual(false);
    expect(webpubsub.channel(channelName).subscriptionCancelled).toEqual(false);

    webpubsub.subscribe(channelName)
    expect(webpubsub.channel(channelName).subscribed).toEqual(true);
    expect(webpubsub.channel(channelName).subscriptionPending).toEqual(false);
    expect(webpubsub.channel(channelName).subscriptionCancelled).toEqual(false);
  });

  it("sub-unsub = NOP", async function() {
    var webpubsub = getWebpubsub();
    var channelName = Integration.getRandomName((prefix || "") + "integration");

    webpubsub.subscribe(channelName)
    expect(webpubsub.channel(channelName).subscribed).toEqual(false);
    expect(webpubsub.channel(channelName).subscriptionPending).toEqual(true);
    expect(webpubsub.channel(channelName).subscriptionCancelled).toEqual(false);

    webpubsub.unsubscribe(channelName)
    expect(webpubsub.channel(channelName).subscribed).toEqual(false);
    expect(webpubsub.channel(channelName).subscriptionPending).toEqual(true);
    expect(webpubsub.channel(channelName).subscriptionCancelled).toEqual(true);

    // there is no easy way to know when an unsubscribe request has been
    // actioned by the server, so we just wait a while
    await waitsFor(sleep(3000), "unsubscription to finish", 3500)

    expect(webpubsub.channel(channelName)).toBe(undefined);
  });

  it("sub-wait-unsub = NOP", async function() {
    var webpubsub = getWebpubsub();
    var channelName = Integration.getRandomName((prefix || "") + "integration");

    webpubsub.subscribe(channelName)
    expect(webpubsub.channel(channelName).subscribed).toEqual(false);
    expect(webpubsub.channel(channelName).subscriptionPending).toEqual(true);
    expect(webpubsub.channel(channelName).subscriptionCancelled).toEqual(false);

    await waitsFor(function() {
      return webpubsub.channel(channelName).subscribed;
    }, "subscription to finish", 10000);

    expect(webpubsub.channel(channelName).subscribed).toEqual(true);
    expect(webpubsub.channel(channelName).subscriptionPending).toEqual(false);
    expect(webpubsub.channel(channelName).subscriptionCancelled).toEqual(false);

    webpubsub.unsubscribe(channelName)
    expect(webpubsub.channel(channelName)).toBe(undefined);
  });

  it("sub-unsub-sub = sub", async function() {
    var webpubsub = getWebpubsub();
    var channelName = Integration.getRandomName((prefix || "") + "integration");

    webpubsub.subscribe(channelName)
    expect(webpubsub.channel(channelName).subscribed).toEqual(false);
    expect(webpubsub.channel(channelName).subscriptionPending).toEqual(true);
    expect(webpubsub.channel(channelName).subscriptionCancelled).toEqual(false);

    webpubsub.unsubscribe(channelName)
    expect(webpubsub.channel(channelName).subscribed).toEqual(false);
    expect(webpubsub.channel(channelName).subscriptionPending).toEqual(true);
    expect(webpubsub.channel(channelName).subscriptionCancelled).toEqual(true);

    webpubsub.subscribe(channelName)
    expect(webpubsub.channel(channelName).subscribed).toEqual(false);
    expect(webpubsub.channel(channelName).subscriptionPending).toEqual(true);
    expect(webpubsub.channel(channelName).subscriptionCancelled).toEqual(false);

    await waitsFor(function() {
      return webpubsub.channel(channelName).subscribed;
    }, "subscription to finish", 10000);

    expect(webpubsub.channel(channelName).subscribed).toEqual(true);
    expect(webpubsub.channel(channelName).subscriptionPending).toEqual(false);
    expect(webpubsub.channel(channelName).subscriptionCancelled).toEqual(false);
  });

  it("sub-unsub-wait-sub = sub", async function() {
    var webpubsub = getWebpubsub();
    var channelName = Integration.getRandomName((prefix || "") + "integration");

    webpubsub.subscribe(channelName)
    expect(webpubsub.channel(channelName).subscribed).toEqual(false);
    expect(webpubsub.channel(channelName).subscriptionPending).toEqual(true);
    expect(webpubsub.channel(channelName).subscriptionCancelled).toEqual(false);

    webpubsub.unsubscribe(channelName)
    expect(webpubsub.channel(channelName).subscribed).toEqual(false);
    expect(webpubsub.channel(channelName).subscriptionPending).toEqual(true);
    expect(webpubsub.channel(channelName).subscriptionCancelled).toEqual(true);

    // there is no easy way to know when an unsubscribe request has been
    // actioned by the server, so we just wait a while
    await waitsFor(sleep(3000), "unsubscription to finish", 3500)
    expect(webpubsub.channel(channelName)).toBe(undefined);

    webpubsub.subscribe(channelName)
    expect(webpubsub.channel(channelName).subscribed).toEqual(false);
    expect(webpubsub.channel(channelName).subscriptionPending).toEqual(true);
    expect(webpubsub.channel(channelName).subscriptionCancelled).toEqual(false);

    await waitsFor(function() {
      return webpubsub.channel(channelName).subscribed;
    }, "subscription to finish", 10000);

    expect(webpubsub.channel(channelName).subscribed).toEqual(true);
    expect(webpubsub.channel(channelName).subscriptionPending).toEqual(false);
    expect(webpubsub.channel(channelName).subscriptionCancelled).toEqual(false);
  });

  it("sub-unsub-unsub = NOP", async function() {
    var webpubsub = getWebpubsub();
    var channelName = Integration.getRandomName((prefix || "") + "integration");

    webpubsub.subscribe(channelName)
    expect(webpubsub.channel(channelName).subscribed).toEqual(false);
    expect(webpubsub.channel(channelName).subscriptionPending).toEqual(true);
    expect(webpubsub.channel(channelName).subscriptionCancelled).toEqual(false);

    webpubsub.unsubscribe(channelName)
    expect(webpubsub.channel(channelName).subscribed).toEqual(false);
    expect(webpubsub.channel(channelName).subscriptionPending).toEqual(true);
    expect(webpubsub.channel(channelName).subscriptionCancelled).toEqual(true);

    webpubsub.unsubscribe(channelName)
    expect(webpubsub.channel(channelName).subscribed).toEqual(false);
    expect(webpubsub.channel(channelName).subscriptionPending).toEqual(true);
    expect(webpubsub.channel(channelName).subscriptionCancelled).toEqual(true);

    // there is no easy way to know when an unsubscribe request has been
    // actioned by the server, so we just wait a while
    await waitsFor(sleep(3000), "unsubscription to finish", 3500)

    expect(webpubsub.channel(channelName)).toBe(undefined);
  });
}
module.exports = {build}
