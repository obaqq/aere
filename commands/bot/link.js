const { Authflow } = require("prismarine-auth");

const { getCacheFactory, deviceMapping } = require("../../common/Util.js");

const XboxAPI = require("../../common/Xbox.js");
const PlayFabAPI = require("../../common/PlayFab.js");

const linkSetup = new Map();

module.exports = {
    name: "link",
    description: "Link your account.",
    dmsOnly: true,
    options: [
        {
            type: 4,
            name: "device",
            description: "Select a device. You can change this later by relinking.",
            required: true,
            choices: [
                {
                    name: "Nintendo Switch",
                    value: 0
                },
                {
                    name: "Playstation",
                    value: 1
                },
                {
                    name: "Android",
                    value: 2
                },
                {
                    name: "iOS",
                    value: 3
                },
            ]
        }
    ],
    execute: async (interaction, args, embedConstants, dbUser) => {
        const { user } = interaction;

        let device = args.device;

        switch (device) {
            case 0:
                device = "Switch";
                break;
            case 1:
                device = "PlayStation";
                break;
            case 2:
                device = "Android";
                break;
            case 3:
                device = "iOS";
                break;
            default:
                embedConstants.embed.description = "We don't know what happened there.\nDevice selection failure. Status 59";
                return interaction.createFollowup({ embed: embedConstants.embed });
        }

        if (dbUser.didLink) {
            embedConstants.embed.description = "You have already linked your account.\nPlease unlink first.";
            return interaction.createFollowup({ embed: embedConstants.embed });
        }

        dbUser.linkDevice = device;

        dbUser.save();

        let userFlow = deviceMapping[dbUser.linkDevice] || {};

        embedConstants.embed.description = `${embedConstants.emojis.RT}Please wait for the next prompt...`;

        const msg = await interaction.createFollowup({ embed: embedConstants.embed });

        linkSetup.set(user.id, 1);

        let timeout, flowData;

        const flow = new Authflow(undefined, getCacheFactory(dbUser), {
            flow: userFlow.flow,
            authTitle: userFlow.authTitle,
            deviceType: userFlow.deviceType
        }, async (code) => {
            if (linkSetup.get(user.id) === 2) {
                try {
                    embedConstants.embed.title = "";
                    embedConstants.embed.description = "Something happened\nTry again later.";

                    cleanLinkData(dbUser, linkSetup);
                    clearTimeout(timeout);

                    return msg.edit({ embed: embedConstants.embed, components: [] });
                } catch {
                    linkSetup.delete(user.id);
                }

                return linkSetup.delete(user.id);
            }

            linkSetup.set(user.id, 2);

            embedConstants.embed.title = "Aere Link Process";
            embedConstants.embed.description = `Go **[here](https://microsoft.com/link?otc=${code.user_code})** and link your account.\n\nIf it doesn't include a code when you click the link, enter the code below.\n\n\`\`\`${code.user_code}\`\`\`\n\n`;

            try {
                await msg.edit({ embed: embedConstants.embed, components: [] });
            } catch {
                return linkSetup.delete(user.id);
            }

            timeout = setTimeout(() => {
                embedConstants.embed.title = "";
                embedConstants.embed.description = "Link Expired\nTry again later.";

                linkSetup.delete(user.id);
                dbUser.linkDevice = "";
                dbUser.didLink = false;
                dbUser.linkData = {};
                dbUser.playFabId = "";
                dbUser.save();

                clearTimeout(timeout);

                return msg.edit({ embed: embedConstants.embed, components: [] });
            }, 300000);
        });

        try {
            flowData = await flow.getXboxToken();

            embedConstants.embed.title = "";

            if (!flowData) {
                cleanLinkData(dbUser, linkSetup);
                embedConstants.embed.description = "Something went wrong.\nTry again later. Status 131";
                return msg.edit({ embed: embedConstants.embed });
            }

            if (typeof flowData.userXUID != "string") {
                cleanLinkData(dbUser, linkSetup);
                embedConstants.embed.description = "Something went wrong.\nTry again later. Status 137";
                return msg.edit({ embed: embedConstants.embed });
            }

            const { userXUID: xuid } = flowData;

            // So if the bot randomly quits, they can just do it again!
            await dbUser.save();

            const xboxAPI = new XboxAPI(dbUser.id);
            const user = await xboxAPI.getXboxUser(xuid);

            // We can stop the timeout now, since we're taking requests.
            clearTimeout(timeout);

            if (!user) {
                cleanLinkData(dbUser, linkSetup);
                embedConstants.embed.description = "Something went wrong.\nTry again later. Status 148";
                return msg.edit({ embed: embedConstants.embed });
            }

            const { gamertag, displayPicRaw } = user;

            const PlayfabAPI = new PlayFabAPI(dbUser.id);
            const playFabData = await PlayfabAPI.loginWithXbox();

            const { errorMsg, PlayFabId } = playFabData;

            if (typeof errorMsg === "string" && errorMsg) {
                cleanLinkData(dbUser, linkSetup);
                embedConstants.embed.description = `Something went wrong while logging into PlayFab.\nMore information is listed here.\n\n\`\`\`${errorMsg}\`\`\`\n\nTry again later or with a new account. Status 163`;
                return msg.edit({ embed: embedConstants.embed });
            }

            if (typeof PlayFabId != "string") {
                cleanLinkData(dbUser, linkSetup);
                embedConstants.embed.description = "Something went wrong.\nTry again later. Status 168";
                return msg.edit({ embed: embedConstants.embed });
            }

            dbUser.playFabId = PlayFabId.toLowerCase();
            dbUser.didLink = true;
            dbUser.linkDevice = device;
            await dbUser.save();

            embedConstants.embed.title = "Aere Link Confirmation";
            embedConstants.embed.thumbnail.url = displayPicRaw;
            embedConstants.embed.description = `**Account**\n${embedConstants.emojis.RT}Successfully linked the account **${gamertag}**.`;

            msg.edit({ embed: embedConstants.embed });
        } catch (error) {
            cleanLinkData(dbUser, linkSetup);
            embedConstants.embed.title = "";

            const errorString = error.toString();

            if (errorString?.includes("does not have an Xbox profile")) {
                embedConstants.embed.description = "Something went wrong.\nTry again later. Status 204";
                return msg.edit({ embed: embedConstants.embed });
            }

            if (errorString?.includes("service abuse mode")) {
                embedConstants.embed.description = "Something went wrong.\nTry again later. Status 209";
                return msg.edit({ embed: embedConstants.embed });
            }

            if (errorString?.includes("Client application access to the requested scope.")) {
                embedConstants.embed.description = "Something went wrong.\nTry again later. Status 214";
                return msg.edit({ embed: embedConstants.embed });
            }

            if (errorString?.includes("The provided value for input parameter 'device_code'")) {
                embedConstants.embed.description = "Something went wrong.\nTry again later. Status 219";
                return msg.edit({ embed: embedConstants.embed });
            }

            console.log(error, typeof errorString, typeof error)

            // Only IF it's unhandled
            embedConstants.embed.description = "Something went wrong.\nTry again later. Status 226 Unhandled";
            return msg.edit({ embed: embedConstants.embed });
        }
    }
};

function cleanLinkData(dbUser, linkSetup) {
    linkSetup.delete(dbUser.id);
    dbUser.didLink = false;
    dbUser.linkData = {};
    dbUser.linkDevice = "";
    dbUser.playFabId = "";
    dbUser.save();
}