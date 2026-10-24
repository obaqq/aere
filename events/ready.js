const { client } = require("../index.js");

client.once("ready", async () => {
  let commands = [...client.commands.values()];

  client.bulkEditCommands(commands);

  client.editStatus("idle", {
    name: "Realms",
    type: 1
  });

  console.log(`Logged in as ${client.user.username} (${client.user.id})`);
});