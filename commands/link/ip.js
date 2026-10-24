const RealmAPI = require("../../common/Realm.js");

module.exports = {
    name: "ip",
    description: "Gets the Realm's Current IP & Port.",
    cooldown: 5000,
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
    execute: async (interaction, args, embedConstants) => {
        const { user } = interaction;
        const { input } = args;

        let RAPI = await RealmAPI(user.id);
        let realm = /^\d+$/.test(input) ? await RAPI.getRealmInfoByID(input) : await RAPI.getRealmInfo(input);

        if (typeof realm.status === "number" && realm.status) {
            switch (realm.status) {
                case 403:
                    embedConstants.embed.description = `**Error**\n${embedConstants.emojis.RT}${realm?.body?.errorMsg} (${realm?.body?.errorCode})`;
                    break;
                case 404:
                    embedConstants.embed.description = `**Error**\n${embedConstants.emojis.RT}${realm?.body?.errorMsg} (${realm?.body?.errorCode})`;
                    break;
                case 500:
                    embedConstants.embed.description = `**Error**\n${embedConstants.emojis.RT}Internal Server Error.`;
                    break;
                case 502:
                case 504:
                    embedConstants.embed.description = `**Error**\n${embedConstants.emojis.RT}Realms API may be down or it's Azure's Frontdoor. Try again later.`;
                    break;
                default:
                    embedConstants.embed.description = `**Error**\n${embedConstants.emojis.RT}Try again later or contact Aere support. (Status ${realm.status})`;
                    break;
            }

            return interaction.createFollowup({ embed: embedConstants.embed, components: [] });
        }

        if (realm.expired || realm.state === "CLOSED") {
            embedConstants.embed.description = `**Error**\n${embedConstants.emojis.RT}Realm is ${realm.expired ? "expired" : "closed"}.`;
            return interaction.createFollowup({ embed: embedConstants.embed, components: [] });
        }

        let address = {};
        let realmIP = await RAPI.getRealmIP(realm.id);

        if (typeof realmIP.status === "number" && realmIP.status) {
            switch (realmIP.status) {
                case 403:
                    embedConstants.embed.description = `**Error**\n${embedConstants.emojis.RT}${realmIP?.body?.errorMsg} (${realmIP?.body?.errorCode})`;
                    break;
                case 404:
                    embedConstants.embed.description = `**Error**\n${embedConstants.emojis.RT}${realmIP?.body?.errorMsg} (${realmIP?.body?.errorCode})`;
                    break;
                case 500:
                    embedConstants.embed.description = `**Error**\n${embedConstants.emojis.RT}Internal Server Error.`;
                    break;
                case 503:
                    embedConstants.embed.description = `**Error**\n${embedConstants.emojis.RT}Retry again later.`;
                    break;
                case 502:
                case 504:
                    embedConstants.embed.description = `**Error**\n${embedConstants.emojis.RT}Realms API may be down or it's Azure's Frontdoor. Try again later.`;
                    break;
                default:
                    embedConstants.embed.description = `**Error**\n${embedConstants.emojis.RT}Try again later or contact Aere support. (Status ${realmIP.status})`;
                    break;
            }

            return interaction.createFollowup({ embed: embedConstants.embed, components: [] });
        }
        
        address.ip = realmIP.address?.substring(0, realmIP.address.indexOf(':'));
        address.port = Number(realmIP.address?.substring(realmIP.address.indexOf(':') + 1));

        embedConstants.embed.description = `**Result**\n${embedConstants.emojis.DR}IP: ${address.ip}\n${embedConstants.emojis.RT}Port: ${address.port}`;

        await interaction.createFollowup({ embed: embedConstants.embed });
    }
};