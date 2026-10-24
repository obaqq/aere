"use strict";

const Eris = require("eris");
const ms = require("ms");

const { userModel, createUserDefaults } = require("../common/Database.js");
const { client } = require("../index.js");

const config = require("../ext/config.json");

const cooldowns = new Map();

client.on("interactionCreate", (interaction) => {
  switch (true) {
    case interaction instanceof Eris.CommandInteraction:
      CommandInteraction(interaction);
      break;
    case interaction instanceof Eris.ComponentInteraction:
      ComponentInteraction(interaction);
      break;
    case interaction instanceof Eris.AutocompleteInteraction:
      AutocompleteInteraction(interaction);
      break;
  }
});

class EmbedConstants {
  constructor() {
    this.embed = {
      title: "",
      color: config.embed.color,
      author: {
        name: "Internal"
      },
      description: "",
      fields: [],
      footer: {
        text: config.embed.botName,
        icon_url: config.embed.icon
      },
      thumbnail: {
        url: ""
      }
    };
    this.emojis = config.emojis;
  }
}

const embedConstants = new EmbedConstants();

async function CommandInteraction(interaction) {
  try {
    await interaction.acknowledge();
  } catch {
    return;
  }

  try {
    const args = {};

    for (const { name, value, options } of interaction.data.options ?? []) {
      args[name] = options ? Object.fromEntries(options.map(({ name: optName, value: optValue }) => [optName, optValue])) : value;
    }

    if (!interaction.user) interaction.user = interaction.member.user;

    const member = interaction.user;
    const guild = interaction.channel.guild;
    const command = client.commands.get(interaction.data.name.toLowerCase());

    const stringArgs = JSON.stringify(args);
    console.log(`${member.username} (${member.id}) used the command /${interaction.data.name} ${stringArgs}`);

    const user = await userModel.findOne({ id: member.id }) ?? createUserDefaults({ id: member.id });

    const dbChecks = [
      {
        condition: () => user.blacklisted,
        message: `**Bot**\n${embedConstants.emojis.RT}You are blacklisted.`
      },
      {
        condition: () => command.staffOnly && !user.staff,
        message: `**Bot**\n${embedConstants.emojis.RT}You do not have access to use this command.`
      },
      {
        condition: () => command.requireLink && !user.didLink,
        message: `**Bot**\n${embedConstants.emojis.RT}This requires you to link. To link, do \`/link\` in DMs.`
      },
      {
        condition: () => !config.guildsWhitelist.includes(String(guild?.id)) && guild,
        message: `**Bot**\n${embedConstants.emojis.RT}You're not in a whitelisted guild.`
      },
      {
        condition: () => command.dmsOnly && guild,
        message: `**Bot**\n${embedConstants.emojis.RT}This can only be used in DMs.`
      }
    ];

    let reason = null;

    for (const check of dbChecks) {
      if (check.condition()) {
        reason = check.message;
        break;
      }
    }

    if (reason) {
      embedConstants.embed.description = reason;
      return interaction.createFollowup({ embed: embedConstants.embed });
    }

    if (command.cooldown) {
      const now = Date.now();
      const cooldownMap = cooldowns.get(member.id) ?? {};

      if (cooldownMap[command.name] > now) {
        const rateLimitEnd = ms(cooldownMap[command.name] - now, { long: true });

        embedConstants.embed.description = `This command is on cooldown for **${rateLimitEnd}**.`;

        return interaction.createFollowup({ embed: embedConstants.embed });
      }

      cooldownMap[command.name] = now + command.cooldown;
      cooldowns.set(member.id, cooldownMap);
    }

    command.execute(interaction, args, new EmbedConstants(), user);
  } catch (error) {
    console.error(error);

    embedConstants.embed.description = "An error has occurred.";

    interaction.createFollowup({ embed: embedConstants.embed });
  }
};

async function ComponentInteraction(interaction) {
  try {
    if (!interaction.user) interaction.user = interaction.member.user;

    const command = interaction.message.interaction;

    const { componentPressEvent, componentSelectEvent } = client.commands.get(command.name.split(" ")[0]);
    const { custom_id } = interaction.data;

    if (interaction.message.interaction.user.id !== (interaction.member?.id ?? interaction.user.id)) return;

    switch (interaction.data.component_type) {
      case 2:
        componentPressEvent(interaction, custom_id);
        break;
      case 3:
        componentSelectEvent(interaction, custom_id);
        break;
    }
  } catch (error) {
    console.error(error);
  }
};

async function AutocompleteInteraction(interaction) {
  try {
    const { name, options } = interaction.data;

    const argument = options.find((args) => args.focused);

    const { autocompleteEvent } = client.commands.get(name.split(" ")[0]);

    await autocompleteEvent(interaction, argument);
  } catch (error) {
    console.error(error);
  }
};