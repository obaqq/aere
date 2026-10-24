const { Titles } = require("prismarine-auth");
const { userModel } = require("./Database.js");

function getCacheFactory(dbUser) {
    if (!dbUser.linkData) dbUser.linkData = {};

    class CacheFactory {
        async getCached() {
            return dbUser.linkData;
        }
        async setCached(value) {
            dbUser.linkData = value || {};

            try {
                await dbUser.save();
            } catch {
                dbUser = await userModel.findOne({ id: dbUser.id });

                dbUser.linkData = value || {};

                await dbUser.save();
            }
        }
        async setCachedPartial(value) {
            dbUser.linkData = {
                ...dbUser.linkData,
                ...value
            };

            try {
                await dbUser.save();
            } catch {
                dbUser = await userModel.findOne({ id: dbUser.id });

                dbUser.linkData = {
                    ...dbUser.linkData,
                    ...value
                };

                await dbUser.save();
            }
        }
    }
    return function () { return new CacheFactory(); };
}

function generateRandomString(length, characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz1234567890_-") {
    const array = new Uint8Array(length);

    for (let i = 0; i < length; i++) array[i] = characters.charCodeAt(~~(Math.random() * characters.length));

    return Buffer.from(array).toString();
}

async function delay(ms) {
    await new Promise(resolve => setTimeout(resolve, ms));
}

function cleanLeftovers(timeouts, intervals) {
    for (const id of timeouts) clearTimeout(id);
    for (const id of intervals) clearInterval(id);
}

function translateDisconnectMessage(message) {
  try {
    const disconnectReasons = require("../ext/disconnectReasons.json");

    for (const [key, value] of Object.entries(disconnectReasons)) {
      if (message.includes(key)) {
        message = message.replace(key, value).replace(/%/g, "").replace(/§./g, "");

        // Correctly handle %disconnect.kicked.reason, I could not find a better way to do it at the start.
        if (message.startsWith("You were kicked from the game.reason")) {
          message = message.replace("You were kicked from the game.reason", "You were kicked from the game:");
        }

        return message;
      }
    }
  } catch (error) {
    console.error(error);
  }

  return message
}

const deviceMapping = {
    "PlayStation": {
        flow: "sisu",
        authTitle: Titles.MinecraftPlaystation,
        deviceType: "PlayStation",
        deviceOS: 11,
        maxViewDistance: 32,
        memoryTier: 5,
        platformType: 2,
        UIProfile: 0,
        scid: "00000000-0000-0000-0000-000079dbee96",
        deviceModel: "playstation_5_emu",
        userAgent: "MCPE/Playstation"
    },
    "Android": {
        flow: "sisu",
        authTitle: Titles.MinecraftAndroid,
        deviceType: "Android",
        deviceOS: 1,
        maxViewDistance: 10,
        memoryTier: 3,
        platformType: 1,
        UIProfile: 1,
        scid: "00000000-0000-0000-0000-000067b57dac",
        deviceModel: "SAMSUNG SM-G955U",
        userAgent: "MCPE/Android"
    },
    "iOS": {
        flow: "sisu",
        authTitle: Titles.MinecraftIOS,
        deviceType: "iOS",
        deviceOS: 2,
        maxViewDistance: 18,
        memoryTier: 5,
        platformType: 1,
        UIProfile: 1,
        scid: "00000000-0000-0000-0000-00006bf082d7",
        deviceModel: "iPhone14,3",
        userAgent: "MCPE/iOS"
    },
    "Switch": {
        flow: "sisu",
        authTitle: Titles.MinecraftNintendoSwitch,
        deviceType: "Nintendo",
        deviceOS: 12,
        maxViewDistance: 12,
        memoryTier: 4,
        platformType: 2,
        UIProfile: 0,
        scid: "00000000-0000-0000-0000-00007a079e33",
        deviceModel: "Switch", // Not for fully sure how Minecraft does switch's device model
        userAgent: "MCPE/Switch"
    }
};

module.exports = {
    getCacheFactory,
    deviceMapping,
    generateRandomString,
    delay,
    cleanLeftovers,
    translateDisconnectMessage
}