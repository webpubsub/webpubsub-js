import Defaults from 'core/defaults';
import DependencyLoader from './dependency_loader';
import { ScriptReceiverFactory } from './script_receiver_factory';

export var DependenciesReceivers = new ScriptReceiverFactory(
  '_webpubsub_dependencies',
  'Webpubsub.DependenciesReceivers'
);

export var Dependencies = new DependencyLoader({
  cdn_http: Defaults.cdn_http,
  cdn_https: Defaults.cdn_https,
  version: Defaults.VERSION,
  suffix: Defaults.dependency_suffix,
  receivers: DependenciesReceivers
});
