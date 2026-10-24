module.exports = {
    name: "unlink",
    description: "Unlink your account.",
    execute: async (interaction, args, embedConstants, dbUser) => {
        if (typeof dbUser.linkData !== "object" || dbUser.linkDevice.length > 0 || dbUser.playFabId.length > 0 || dbUser.didLink) {
            dbUser.didLink = false;
            dbUser.linkData = {};
            dbUser.linkDevice = "";
            dbUser.playFabId = "";
            dbUser.save();

            embedConstants.embed.description = `**Account**\n${embedConstants.emojis.RT}You've been unlinked.`;

            return interaction.createFollowup({ embed: embedConstants.embed });
        } else {
            embedConstants.embed.description = `**Account**\n${embedConstants.emojis.RT}You have not linked yet.`;

            return interaction.createFollowup({ embed: embedConstants.embed });
        }
    }
};