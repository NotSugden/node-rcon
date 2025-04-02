import { EventEmitter } from 'events';
import net from 'net';
import dgram from 'dgram';
const
  { EventEmitter } = require('events'),
  net = require('net'),
  dgram = require('dgram');
  
const PacketType = {
  COMMAND: 0x02,
  AUTH: 0x03,
  RESPONSE_VALUE: 0x00,
  RESPONSE_AUTH: 0x02
};

// Make it a valid enum type
for (const [key, value] in Object.entries(PacketType)) PacketType[value] = key;

module.exports = class RCON extends EventEmitter {
    constructor(host, port, password, options) {
        super();
        this.host = host;
        this.port = port;
        this._outstandingData = null;
        this.authenticated = false;
        this.useTcp = this.challenge = true;
        
        // Make sure password doesn't show when logged
        Object.defineProperty(this, 'password', { value: password, enumerable: false, writable: false });
        if (options) {
            if ('id' in options) this.id = options.id;
            if ('useTcp' in options) {
                this.useTcp = options.useTcp;
                if ('challenge' in options) this.challenge = options.challenge;
            }
        }
    }

    _sendData(data) {
        if (this._tcpSocket) {
            this._tcpSocket.write(data.toString('binary'), 'binary');
        } else if (this._udpSocket) {
            this._udpSocket.send(data, 0, data.length, this.port, this.host);
        }
    }

    _dataReceived(data) {
        if (this.useTcp) {
            if (this._outstandingData !== null) {
                data = Buffer.concat([this._outstandingData, data]);
                this._outstandingData = null;
            }

            while (data.length >= 12) {
                const length = data.readInt32LE(0); // Size of entire packet, not including the 4 byte length field
                if (!length) return this.emit('debug', 'No valid packet header, discarding entire buffer.', data);

                const packetLength = length + 4;
                if (data.length < packetLength) break; // Wait for full packet, TCP may have segmented it

                const bodyLength = length - 10; // Subtract size of ID, type, and two mandatory trailing null bytes
                if (bodyLength < 0) {
                    this.emit('debug', 'Length is too short, discarding malformed packet.', data);
                    data = data.subarray(packetLength);
                    break;
                }

                const id = data.readInt32LE(4);
                const type = data.readInt32LE(8);

                if (id === this.id) {
                    if (!this.authenticated && type == PacketType.RESPONSE_AUTH) {
                        this.authenticated = true;
                        this.emit('authenticated');
                    } else if (type == PacketType.RESPONSE_VALUE) {
                        // Read just the body of the packet (truncate the last null byte)
                        // See https://developer.valvesoftware.com/wiki/Source_RCON_Protocol for details
                        const str = data.toString('utf8', 12, 12 + bodyLength);

                        this.emit('response', str.charAt(str.length - 1) === '\n' ? str.substring(0, -1) : str);
                    }
                } else if (id === -1) {
                    this.emit('error', new Error('Authentication failed'));
                } else {
                    // ping/pong likely
                    const str = data.toString('utf8', 12, 12 + bodyLength);

                    this.emit('server', str.charAt(str.length - 1) === '\n' ? str.substring(0, -1) : str);
                }

                data = data.subarray(packetLength);
            }

            // Keep a reference to remaining data, since the buffer might be split within a packet
            this._outstandingData = data;
        } else {
            if (data.readUInt32LE(0) === 0xFFFFFFFF) {
                const str = data.toString('utf-8', 4);
                const tokens = str.split(' ');
                if (tokens.length == 3 && tokens[0] == 'challenge' && tokens[1] == 'rcon') {
                    this._challengeToken = tokens[2].slice(0, -1).trim();
                    this.authenticated = true;
                    this.emit('authenticated');
                } else this.emit('response', str.slice(1, -2));
            } else this.emit('error', new Error('Received malformed packet'));
        }
    }

    _onConnect() {
        if (this.useTcp) {
            this.send(this.password, PacketType.AUTH);
        } else if (this.challenge) {
            const str = 'challenge rcon\n';
            const buffer = Buffer.alloc(str.length + 4);
            buffer.writeInt32LE(-1, 0);
            buffer.write(str, 4);
            this._sendData(buffer);
        } else {
            const buffer = Buffer.alloc(5);
            buffer.writeInt32LE(-1, 0);
            buffer.writeUInt8(0, 4);
            this._sendData(buffer);

            this.authenticated = true;
            this.emit('authenticated');
        }
    }

    _onClose() {
        this.emit('end');
        this.authenticated = false;
    }

    connect() {
        let socket;
        if (this.useTcp)
            socket = this._tcpSocket = net.createConnection(this.port, this.host)
                .on('data', this._dataReceived.bind(this))
                .on('connect', this._onConnect.bind(this))
                .on('end', this._onClose.bind(this));
        else
            socket = this._udpSocket = dgram.createSocket('udp4')
                .on('message', this._dataReceived.bind(this))
                .on('listening', this._onConnect.bind(this))
                .on('close', this._onClose.bind(this))
                .bind(0);

        socket.on('error', error => this.emit('error', error));
    }

    send(data, packetType = PacketType.COMMAND, id = this.id) {
        if (this.useTcp) {
            const length = Buffer.byteLength(data);
            const buffer = Buffer.alloc(length + 14);

            buffer.writeInt32LE(length + 10, 0);
            buffer.writeInt32LE(id, 4);
            buffer.writeInt32LE(packetType, 8);
            buffer.write(data, 12);
            buffer.writeInt16LE(0, length + 12);

            this._sendData(buffer);
        } else {
            if (!this.authenticated || (this.challenge && !this._challengeToken))
                throw new Error('Not authenticated')

            let str = 'rcon ';
            if (this._challengeToken) str += this._challengeToken + ' ';
            if (this.password) str += this.password + ' ';
            str += data + '\n';
            const buffer = Buffer.alloc(4 + Buffer.byteLength(str));
            buffer.writeInt32LE(-1, 0);
            buffer.write(str, 4)

            this._sendData(buffer);
        }
    }

    disconnect() {
        if (this._tcpSocket) this._tcpSocket.end();
        if (this._udpSocket) this._udpSocket.close();
    }
}

RCON.default = RCON;