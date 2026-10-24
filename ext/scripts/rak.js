const { EventEmitter } = require('events')

let Client, PacketPriority, PacketReliability
class RakTimeout extends Error {};

module.exports = (backend) => {
    ({ Client, PacketPriority, PacketReliability } = require('raknet-native'))
    return { RakClient: RakNativeClient, RakTimeout }
}

module.exports.replaced = true;

class RakNativeClient extends EventEmitter {
    constructor(options, client) {
        super()
        this.connected = false
        this.onConnected = () => { }
        this.onCloseConnection = () => { }
        this.onEncapsulated = () => { }

        this.raknet = new Client(options.host, options.port, { protocolVersion: 11 })

        this.raknet.on('encapsulated', ({ buffer, address }) => {
            if (this.connected) this.onEncapsulated(buffer, address) // Discard packets that are queued to be sent to us after close
        })

        this.raknet.on('connect', () => {
            this.connected = true
            this.onConnected()
        })

        this.raknet.on('disconnect', ({ reason }) => {
            this.connected = false
            this.onCloseConnection(reason)
        })
    }

    connect() {
        this.raknet.connect()
    }

    close() {
        this.connected = false
        this.raknet.close()
    }

    sendReliable(buffer, immediate) {
        if (this.connected) return this.raknet.send(buffer, immediate ? PacketPriority.IMMEDIATE_PRIORITY : PacketPriority.MEDIUM_PRIORITY, PacketReliability.RELIABLE_ORDERED, 0)
    }
}