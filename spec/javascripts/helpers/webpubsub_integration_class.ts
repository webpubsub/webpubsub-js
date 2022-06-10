import Webpubsub from '../../../src/core/webpubsub';
import { ScriptReceiverFactory } from '../../../src/runtimes/web/dom/script_receiver_factory';

export default class WebpubsubIntegration extends Webpubsub {

  static Integration : any = {
    ScriptReceivers: new ScriptReceiverFactory(
      "_webpubsub_integration_script_receivers",
      "Webpubsub.Integration.ScriptReceivers"
    )}

}
