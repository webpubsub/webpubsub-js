import { Options } from './options';
import Webpubsub from './webpubsub';
export default class WebpubsubWithEncryption extends Webpubsub {
    constructor(app_key: string, options?: Options);
}
