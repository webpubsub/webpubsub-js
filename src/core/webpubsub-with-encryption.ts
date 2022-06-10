import * as nacl from 'tweetnacl';
import { Options } from './options';
import Webpubsub from './webpubsub';

export default class WebpubsubWithEncryption extends Webpubsub {
  constructor(app_key: string, options?: Options) {
    Webpubsub.logToConsole = WebpubsubWithEncryption.logToConsole;
    Webpubsub.log = WebpubsubWithEncryption.log;

    options = options || {};
    options.nacl = nacl;
    super(app_key, options);
  }
}
