const { generateRandomString } = require(`../../common/Util.js`);

const RealmAPI = require("../../common/Realm.js");

// We need to move this out
let cachedInvites = [], RAPI;

module.exports = {
    name: "invites",
    description: "List pending invites.",
    cooldown: 5000,
    requireLink: true,
    execute: async (interaction, args, embedConstants) => {
        const { user } = interaction;

        RAPI = await RealmAPI(user.id);

        const invites = await RAPI.getInvites();

        cachedInvites = invites;

        if (invites.length === 0) {
            embedConstants.embed.description = `**Invites**\n${embedConstants.emojis.RT}No invite(s) found.`;
            return interaction.createFollowup({ embed: embedConstants.embed });
        }

        embedConstants.embed.description = `**Invites**\n${embedConstants.emojis.RT}Select a invite to accept from the dropdown.`;

        const uuid = generateRandomString(6);

        const components = {
            type: 3,
            custom_id: uuid,
            options: [],
            placeholder: "Select a invite to accept."
        };

        for (let i = 0, len = invites.length; i < len; i++) {
            const invite = invites[i];
            
            components.options[i] = {
                label: invite.worldName,
                value: invite.invitationId,
                description: "",
            };
        }

        await interaction.createFollowup({
            embed: embedConstants.embed, components: [{
                type: 1,
                components: [components]
            }]
        });
    },
    componentSelectEvent: selectInvite
};

async function selectInvite(interaction) {
    interaction.acknowledge();

    const inviteId = JSON.parse(interaction.data.values[0]);

    await RAPI.acceptInvite(inviteId);

    let selectedRealm = cachedInvites.find(realm => realm.invitationId === inviteId);

    const allRealms = await RAPI.getRealms();
    const realm = allRealms.find(realm => realm.name.toLowerCase().includes(selectedRealm.worldName.toLowerCase()));

    embedConstants.embed.description = `**Invites**\n${embedConstants.emojis.RT}Accepted the invite for **${realm.name.trim().replace(/§./g, "").replace(/[^a-zA-Z0-9 ]/g, "")}**.`;

    cachedInvites = [];

    return interaction.message.edit({ embed: embedConstants.embed, components: [] });
}