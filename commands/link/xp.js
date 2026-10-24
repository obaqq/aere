const bpClient = require("../../common/Client.js");
const RealmAPI = require("../../common/Realm.js");

const { delay } = require("../../common/Util.js");

const { translateDisconnectMessage } = require("../../common/Util.js");

const xpMap = new Map();

module.exports = {
    name: "xp",
    description: "Gives you XP Levels.",
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
            name: "level",
            description: "XP Levels",
            required: true,
            min_value: -24791,
            max_value: 24791
        }
    ],
    execute: async (interaction, args, embedConstants, dbUser) => {
        const { input, level } = args;
        const { user } = interaction;

        let address = {};

        switch (xpMap.get(user.id)) {
            default:
                if (xpMap.get(user.id)) {
                    embedConstants.embed.description = `**Request Information**\n${embedConstants.emojis.DR}Connection - ${embedConstants.emojis.fail}\n${embedConstants.emojis.RT}You're already doing this request.`;
                    return interaction.createFollowup({ embed });
                }
                break;
        }

        let RAPI = await RealmAPI(user.id);
        let realm = /^\d+$/.test(input) ? await RAPI.getRealmInfoByID(input) : await RAPI.getRealmInfo(input);

        xpMap.set(user.id, 1);

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

            xpMap.delete(user.id);

            return interaction.createFollowup({ embed: embedConstants.embed, components: [] });
        }

        if (realm.expired || realm.state === "CLOSED") {
            embedConstants.embed.description = `**Request Information**\n${embedConstants.emojis.DR}Connection - ${embedConstants.emojis.fail}\n${embedConstants.emojis.RT}Realm is ${realm.expired ? "expired" : "closed"}.`;

            xpMap.delete(user.id);

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

            xpMap.delete(user.id);

            return interaction.createFollowup({ embed: embedConstants.embed, components: [] });
        }

        address.ip = realmIP.address?.substring(0, realmIP.address.indexOf(':'));
        address.port = Number(realmIP.address?.substring(realmIP.address.indexOf(':') + 1));

        embedConstants.embed.description = `**Request Information**\n${embedConstants.emojis.DR}Connection - ${embedConstants.emojis.check}\n${embedConstants.emojis.RT}Request - ${embedConstants.emojis.loading}`;

        const msg = await interaction.createFollowup({ embed: embedConstants.embed });

        let configuration = {
            namespoof: { enabled: false, username: "" },
            ssbp: { enabled: false, type: NaN },
            batchingInterval: 0
        };

        const client = await bpClient(address, dbUser, realm, configuration);

        client.on("kick", (packet) => {
            if (!xpMap.get(user.id)) return;

            client.disconnect();
            xpMap.delete(user.id);

            embedConstants.embed.description = `**Request Information**\n${embedConstants.emojis.DR}Request - ${embedConstants.emojis.fail}\n${embedConstants.emojis.RT}${translateDisconnectMessage(packet.message)}`;

            if (packet.message.includes("/multiplayer/bedrock/authentication")) {
                embedConstants.embed.description = `**Request Information**\n${embedConstants.emojis.DR}Request - ${embedConstants.emojis.fail}\n${embedConstants.emojis.RT}You're banned from Minecraft.`;
                RAPI.XboxAPI.cleanLinkData(dbUser);
            }

            return msg.edit({ embed: embedConstants.embed, components: [] });
        })

        client.on("start_game", async (packet) => {
            client.write("entity_event", {
                runtime_entity_id: packet.runtime_entity_id,
                event_id: "player_add_xp_levels",
                data: level
            });

            // To ensure our packet got sent, if we leave too quick it's doesn't send the packet quick enough.
            await delay(350);

            client.disconnect();
            xpMap.delete(user.id);

            embedConstants.embed.description = `**Request Information**\n${embedConstants.emojis.DR}Connection - ${embedConstants.emojis.check}\n${embedConstants.emojis.RT}Request - ${embedConstants.emojis.check}`;

            return msg.edit({ embed: embedConstants.embed, components: [] });
        })
    }
};