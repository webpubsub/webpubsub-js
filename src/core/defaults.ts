import {
    AuthOptions,
    ChannelAuthorizationHandler,
    UserAuthenticationHandler
} from './auth/options';
import { AuthTransport } from './config';

export interface DefaultConfig {
  VERSION: string;
  PROTOCOL: number;
  wsPort: number;
  wssPort: number;
  wsPath: string;
  httpHost: string;
  httpPort: number;
  httpsPort: number;
  httpPath: string;
  stats_host: string;
  authEndpoint: string;
  authTransport: AuthTransport;
  activityTimeout: number;
  pongTimeout: number;
  unavailableTimeout: number;
  cluster: string;
  userAuthentication: AuthOptions<UserAuthenticationHandler>;
  channelAuthorization: AuthOptions<ChannelAuthorizationHandler>;

  cdn_http?: string;
  cdn_https?: string;
  dependency_suffix?: string;
}

var Defaults: DefaultConfig = {
  VERSION: VERSION,
  PROTOCOL: 7,

  wsPort: 80,
  wssPort: 443,
  wsPath: '',
  // DEPRECATED: SockJS fallback parameters
  httpHost: 'sockjs.webpubsub.com',
  httpPort: 80,
  httpsPort: 443,
  httpPath: '/webpubsub',
  // DEPRECATED: Stats
  stats_host: 'stats.webpubsub.com',
  // DEPRECATED: Other settings
  authEndpoint: '/webpubsub/auth',
  authTransport: 'ajax',
  activityTimeout: 120000,
  pongTimeout: 30000,
  unavailableTimeout: 10000,
  cluster: 'mt1',
  userAuthentication: {
    endpoint: '/webpubsub/user-auth',
    transport: 'ajax'
  },
  channelAuthorization: {
    endpoint: '/webpubsub/auth',
    transport: 'ajax'
  },

  // CDN configuration
  cdn_http: CDN_HTTP,
  cdn_https: CDN_HTTPS,
  dependency_suffix: DEPENDENCY_SUFFIX
};

export default Defaults;
