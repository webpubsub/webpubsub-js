import Webpubsub from '../webpubsub';
import Channel from './channel';
import ChannelTable from './channel_table';
export default class Channels {
    channels: ChannelTable;
    constructor();
    add(name: string, webpubsub: Webpubsub): Channel;
    all(): Channel[];
    find(name: string): Channel;
    remove(name: string): Channel;
    disconnect(): void;
}
