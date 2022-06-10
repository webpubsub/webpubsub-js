var Webpubsub = require('core/webpubsub').default;
var WebpubsubWithEncryption = require('core/webpubsub-with-encryption').default;

describe('WebpubsubWithEncryption', function() {
  it('should pass logToConsole config to parent class', function() {
    WebpubsubWithEncryption.logToConsole = true;
    let webpubsub = new WebpubsubWithEncryption('key');
    expect(Webpubsub.logToConsole).toEqual(true);
  });
  it('should pass log function to parent class', function() {
    let _prevLog = WebpubsubWithEncryption.log
    let logFn =  jasmine.createSpy('logFn');
    WebpubsubWithEncryption.log = logFn
    let webpubsub = new WebpubsubWithEncryption('key');
    expect(logFn).toHaveBeenCalled();
    WebpubsubWithEncryption.log = _prevLog
  });
});
