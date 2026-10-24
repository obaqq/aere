"use strict";

const Eris = require("eris");
const fs = require("fs");

const config = require("./ext/config.json");

require("./common/Replacement.js");

const token = config.isBeta ? config.beta_token : config.token;

const client = new Eris(token, {
  options: {
    intents: [
      "all"
    ],
    disableEvents: [
      "CHANNEL_CREATE",
      "CHANNEL_DELETE",
      "CHANNEL_UPDATE",
      "GUILD_BAN_ADD",
      "GUILD_BAN_REMOVE",
      "GUILD_DELETE",
      "GUILD_MEMBER_ADD",
      "GUILD_MEMBER_REMOVE",
      "GUILD_MEMBER_UPDATE",
      "GUILD_ROLE_CREATE",
      "GUILD_ROLE_DELETE",
      "GUILD_ROLE_UPDATE",
      "GUILD_UPDATE",
      "MESSAGE_CREATE",
      "MESSAGE_DELETE",
      "MESSAGE_DELETE_BULK",
      "MESSAGE_UPDATE",
      "PRESENCE_UPDATE",
      "TYPING_START",
      "USER_UPDATE",
      "VOICE_STATE_UPDATE"
    ]
  }
});

module.exports = {
  client
};

client.connect();

const events = fs.readdirSync("./events/", { withFileTypes: true });

for (let i = 0; i < events.length; i++) {
  const file = events[i];
  require(`./events/${file.name}`);
}

client.commands = new Map();

fs.readdirSync("./commands", { withFileTypes: true }).forEach(folder => {
  if (folder.name === "unused") return;

  fs.readdirSync(`./commands/${folder.name}`).forEach(file => {
    try {
      const command = require(`./commands/${folder.name}/${file}`);

      if (!command.disabled) client.commands.set(command.name, command);
    } catch (error) {
      console.error(`Unable to load command: ${folder.name}/${file}.\n\nStack: ${error.stack}`);
      process.exit(1);
    }
  })
});

client.on("error", (error) => {
  if (error.code === 1006 || error.code === 1001) return;

  console.error(error);
});

process.on("warning", (warning) => {
  console.warn(warning);
});

process.on("unhandledRejection", (error) => {
  if ([10062, 50001, 10003].includes(error.code) || error.stack.includes("Authentication failed, timed out")) return;

  console.error(error);
});

process.on("uncaughtException", (error) => {
  console.error(error);
});