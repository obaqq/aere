const RealmAPI = require("../../common/Realm.js");

module.exports = {
    name: "realm",
    description: "Get information about the realm.",
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
        let realm = /^\d+$/.test(input) ? await RAPI.getRealmInfoByID(input) : await RAPI.getRealmInfo(input, false);

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

        realm.totalMembers = realm.players.length;
        realm.players = undefined;

        embedConstants.embed.description = `**Result**\n\`\`\`json\n${JSON.stringify(realm, null, 2)}\`\`\``;

        await interaction.createFollowup({ embed: embedConstants.embed });
    }
};