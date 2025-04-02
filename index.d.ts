import { EventEmitter } from 'events';
import net from 'net';
import dgram from 'dgram';

export enum PacketType {
    COMMAND = 0x02,
    AUTH = 0x03,
    RESPONSE_VALUE = 0x00,
    RESPONSE_AUTH = 0x02,
};

export type RCONOptions = {
    id?: number;
} & ({
    useTcp?: true;
} | {
    useTcp: false;
    challenge?: boolean
});

interface RCONClientEvents {
    authenticated: [];
    debug: [string, Buffer?];
    response: [string];
    server: [string];
    error: [Error];
    end: []
}

export default class RCON extends EventEmitter<RCONClientEvents> {
    private _outstandingData: Buffer | null;
    private _challengeToken?: string;
    private _tcpSocket?: net.Socket;
    private _udpSocket?: dgram.Socket;

    /**
     * The RCON id - you'll likely not need to change this
     */
    public id: number;
    /**
     * Whether the RCON is authenticated
     */
    public authenticated: boolean;
    /**
     * Whether we are using a TCP connection or not. (the other connection type is UDP)
     */
    public useTcp: boolean;
    /**
     * Whether we are using the challenge authentication method.
     * (only in UDP connections)
     */
    public challenge: boolean;

    /**
     * Make a new RCON connection.
     * @param host The IP address of the server.
     * @param port The port of the server.
     * @param password The password.
     * @param options Options - if you want to use a UDP connection for example.
     * 
     * @example
     * const RCON = require('node-rcon');
     * const rcon = new RCON('localhost', 25575, 'password');
     * 
     * rcon.on('authenticated', () => console.log('Authenticated'));
     * 
     * rcon.connect();
     */
    public constructor(public host: string, public port: number, public password: string, options?: RCONOptions);

    private _sendData(data: Buffer): void;
    private _dataReceived(data: Buffer): void;
    private _onConnect(): void;
    private _onClose(): void;

    /**
     * Connect to the server.
     * 
     * @example
     * const rcon = new RCON('localhost', 25575, 'password');
     * rcon.on('authenticated', () => console.log('authenticated with the server.'));
     * rcon.connect();
     */
    public connect(): void;
    /**
     * Send data to the server.
     * @param data The data to send.
     * @param packetType The type of packet - you'll likely not need to change this
     * @param id The RCON ID - you'll likely not need to change this
     * 
     * @example
     * RCON.send('say hi');
     */
    public send(data: string, packetType?: PacketType, id?: number): void;
    /**
     * Disconnect the server;
     * @example
     * RCON.disconnect();
     * process.exit(0);
     */
    public disconnect(): void;
}

export = RCON;