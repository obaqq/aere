module.exports = {
    name: "ping",
    description: "Outputs the current ping.",
    execute: async (interaction, args, embedConstants) => {
        embedConstants.embed.description = `**Ping**\n${embedConstants.emojis.RT}Getting latest ping...`;

        const currentTime = Date.now();
        const msg = await interaction.createFollowup({ embed: embedConstants.embed });

        embedConstants.embed.description = `**Ping**\n${embedConstants.emojis.RT}\`${Date.now() - currentTime}ms\`\n`;

        return await msg.edit({ embed: embedConstants.embed });
    }
};