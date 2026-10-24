module.exports = {
    name: "restart",
    description: "Restarts the bot",
    staffOnly: true,
    execute: async (interaction, args, embedConstants) => {
        embedConstants.embed.description = `**Bot**\n${embedConstants.emojis.RT}Restarting...`;
        
        await interaction.createFollowup({ embed: embedConstants.embed });

        process.exit(0);
    }
};