const bpClient = require("../../common/Client.js");
const RealmAPI = require("../../common/Realm.js");

const { cleanLeftovers, generateRandomString, translateDisconnectMessage } = require("../../common/Util.js");

const particlesMap = new Map();

module.exports = {
    name: "particles",
    description: "Surround people in particles.",
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
        },
        {
            type: 4,
            name: "time",
            description: "Amount of time",
            required: true,
            min_value: 1,
            max_value: 300
        }
    ],
    execute: async (interaction, args, embedConstants, dbUser) => {
        const { input, time } = args;
        const { user } = interaction;

        let address = {}, timeout, interval, particleInterval, runtimeIds = [];

        switch (particlesMap.get(user.id)) {
            case 64:
                particlesMap.delete(user.id);
                break;
            default:
                if (particlesMap.get(user.id)) {
                    embedConstants.embed.description = `**Request Information**\n${embedConstants.emojis.DR}Connection - ${embedConstants.emojis.fail}\n${embedConstants.emojis.RT}You're already doing this request.`;
                    return interaction.createFollowup({ embed });
                }
                break;
        }

        let RAPI = await RealmAPI(user.id);
        let realm = /^\d+$/.test(input) ? await RAPI.getRealmInfoByID(input) : await RAPI.getRealmInfo(input);

        particlesMap.set(user.id, 1);

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

            particlesMap.delete(user.id);

            return interaction.createFollowup({ embed: embedConstants.embed, components: [] });
        }

        if (realm.expired || realm.state === "CLOSED") {
            embedConstants.embed.description = `**Request Information**\n${embedConstants.emojis.DR}Connection - ${embedConstants.emojis.fail}\n${embedConstants.emojis.RT}Realm is ${realm.expired ? "expired" : "closed"}.`;

            particlesMap.delete(user.id);

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

            particlesMap.delete(user.id);

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
            if (particlesMap.get(user.id) === 64) {
                client.disconnect();
                cleanLeftovers([timeout], [interval, particleInterval]);
                particlesMap.delete(user.id);

                embedConstants.embed.description = `**Request Information**\n${embedConstants.emojis.DR}Request - ${embedConstants.emojis.fail}\n${embedConstants.emojis.RT}Request cancelled.`;

                return msg.edit({ embed: embedConstants.embed, components: [] });
            }
        }, 0)

        client.on("kick", (packet) => {
            if (!particlesMap.get(user.id) || particlesMap.get(user.id) === 64) return;

            client.disconnect();
            cleanLeftovers([timeout], [interval, particleInterval]);
            particlesMap.delete(user.id);

            embedConstants.embed.description = `**Request Information**\n${embedConstants.emojis.DR}Request - ${embedConstants.emojis.fail}\n${embedConstants.emojis.RT}${translateDisconnectMessage(packet.message)}`;

            if (packet.message.includes("/multiplayer/bedrock/authentication")) {
                embedConstants.embed.description = `**Request Information**\n${embedConstants.emojis.DR}Request - ${embedConstants.emojis.fail}\n${embedConstants.emojis.RT}You're banned from Minecraft.`;
                RAPI.XboxAPI.cleanLinkData(dbUser);
            }

            return msg.edit({ embed: embedConstants.embed, components: [] });
        })

        client.on("add_player", (packet) => {
            runtimeIds.push(packet.runtime_id);
        })

        client.on("add_entity", (packet) => {
            runtimeIds.push(packet.runtime_id);
        })

        client.on("add_item_entity", (packet) => {
            runtimeIds.push(packet.runtime_entity_id);
        })

        client.on("start_game", (packet) => {
            runtimeIds.push(packet.runtime_entity_id);

            particleInterval = setInterval(() => {
                client.queue(`entity_event`, {
                    runtime_entity_id: packet.runtime_entity_id,
                    event_id: "eating_item",
                    data: ~~(Math.random() * (30000000 - 15000000 + 1)) + 15000000
                })

                for (const runtimeId of runtimeIds) {
                    client.queue(`animate`, {
                        action_id: 4,
                        runtime_entity_id: runtimeId
                    });

                    client.queue(`animate`, {
                        action_id: 5,
                        runtime_entity_id: runtimeId
                    });
                }
            }, 0);

            timeout = setTimeout(() => {
                client.disconnect();
                cleanLeftovers([timeout], [interval, particleInterval]);
                particlesMap.delete(user.id);

                embedConstants.embed.description = `**Request Information**\n${embedConstants.emojis.DR}Connection - ${embedConstants.emojis.check}\n${embedConstants.emojis.RT}Request - ${embedConstants.emojis.check}`;

                return msg.edit({ embed: embedConstants.embed, components: [] });
            }, time * 1000);
        })
    },
    componentPressEvent: cancel
};

async function cancel(interaction) {
    const { user } = interaction;

    particlesMap.set(user.id, 64);

    await interaction.acknowledge();
};