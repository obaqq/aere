const { Client, createClient } = require("bedrock-protocol");
const { NIL, v3: uuidv3, v4: uuidv4, v5: uuidv5 } = require("uuid");

const fs = require("fs");

const { getCacheFactory, generateRandomString, deviceMapping, delay } = require("./Util.js");
const PlayFabAPI = require("./PlayFab.js");
const XboxAPI = require("./Xbox.js");
const input_data = require("../ext/input_data.json");

const skins = {};
const skinFiles = fs.readdirSync("./ext/skins").filter(file => file.endsWith(".json"));

for (let i = 0, len = skinFiles.length; i < len; i++) {
    let skin = skinFiles[i].replace(".json", "");

    try {
        skins[skin] = JSON.parse(fs.readFileSync(`./ext/skins/${skin}.json`, "utf8"));
    } catch (err) {
        console.error(`Error while loading skin: ${skin}\n${err}`);
    }
}

Client.prototype.tick = 0n;

Client.prototype.move = function (position) {
    if (typeof position != "object") return;

    let data = {
        position: {
            x: position.x,
            y: position.y,
            z: position.z
        },
        move_vector: { x: 0, z: 0 },
        analogue_move_vector: { x: 0, z: 0 },
        pitch: 0,
        yaw: 0,
        head_yaw: 0,
        delta: {
            x: position.x - this.currentPos.x,
            y: position.y - this.currentPos.y,
            z: position.z - this.currentPos.z,
        },
        input_data,
        interact_rotation: { x: 0, z: 0 },
        camera_orientation: { x: 0, y: 0, z: 0 },
        raw_move_vector: { x: 0, z: 0 },
        input_mode: getInputMode(this.deviceOS),
        play_mode: "normal",
        interaction_model: "classic",
        tick: this.tick
    };

    this.currentPos = {
        x: position.x,
        y: position.y,
        z: position.z
    };

    this.queue("player_auth_input", data);

    this.tick += 1n;
}

async function bpClient(address, dbUser, realm, configuration) {
    let userFlow = deviceMapping[dbUser.linkDevice] || {};

    const {
        namespoof = { enabled: false, username: "" },
        ssbp = { enabled: false, type: NaN },
        batchingInterval = 0
    } = configuration ?? {};

    const XAPI = new XboxAPI(dbUser.id);
    const PFAPI = new PlayFabAPI(dbUser.id);

    let deviceOS = userFlow.deviceOS;

    let skinNames = ["noor", "zuri", "makena", "ari", "alex", "steve", "kai"];
    let randomSkin = skinNames[~~(Math.random() * skinNames.length)];
    let skinSelected = skins[randomSkin];

    const guiScaleOptions = [0, -1, -2];

    const options = {
        host: address.ip,
        port: address.port,
        skipPing: true,
        profilesFolder: getCacheFactory(dbUser),
        authTitle: userFlow.authTitle,
        deviceType: userFlow.deviceType,
        flow: userFlow.flow,
        batchingInterval,
        skinData: {
            ClientRandomId: Date.now(),
            CurrentInputMode: getInputMode(deviceOS),
            DefaultInputMode: getInputMode(deviceOS),
            DeviceModel: userFlow.deviceModel,
            DeviceOS: deviceOS,
            DeviceId: getDeviceId(deviceOS),
            PlayFabId: dbUser.playFabId,
            GUIScale: guiScaleOptions[Math.floor(Math.random() * 3)],
            LanguageCode: "en_US",
            OverrideSkin: false,
            PlatformOnlineId: (deviceOS === 11 || deviceOS === 12) ? generateRandomString(19, "1234567890") : "",
            UIProfile: userFlow.UIProfile,
            MaxViewDistance: userFlow.maxViewDistance,
            MemoryTier: userFlow.memoryTier,
            PlatformType: userFlow.platformType,
            GraphicsMode: 0,
            TrustedSkin: true,
            ...skinSelected
        }
    };

    const client = createClient(options);

    let interval, moveInterval;

    XAPI.sendPresence({
        state: "active",
        activity: {
            richPresence: {
                id: `Realm_${realm.gamemode}`,
                scid: userFlow.scid
            }
        }
    });

    XAPI.sendInGamePresence(realm, true);

    interval = setInterval(async () => {
        XAPI.sendPresence({
            state: "active",
            activity: {
                richPresence: {
                    id: `Realm_${realm.gamemode}`,
                    scid: userFlow.scid
                }
            }
        });

        XAPI.sendInGamePresence(realm, true);
    }, 300000);

    PFAPI.updateLoginCount();

    client.options.skinData.SkinId = client.options.skinData.SkinId.replaceAll("ea4b5c0be7c6c72e", dbUser.playFabId);

    const JSGD = Buffer.from(client.options.skinData.SkinGeometryData, 'base64').toString('utf8');
    client.options.skinData.SkinGeometryData = Buffer.from(JSGD.replaceAll("ea4b5c0be7c6c72e", dbUser.playFabId), 'utf8').toString('base64');

    const SRP = Buffer.from(client.options.skinData.SkinGeometryData, 'base64').toString('utf8');
    client.options.skinData.SkinResourcePatch = Buffer.from(SRP.replaceAll("ea4b5c0be7c6c72e", dbUser.playFabId), 'utf8').toString('base64');

    if (ssbp.enabled) {
        switch (ssbp.type) {
            case 0:
                client.options.skinData.AnimatedImageData = new Array(1000).fill({});
                break;
            default:
                break;
        }
    }

    if (namespoof.enabled) {
        client.options.skinData.ThirdPartyName = namespoof.username;
        client.options.skinData.ThirdPartyNameOnly = namespoof.enabled;
    }

    client._disconnect = client.disconnect;

    let wasKicked = false;

    client.disconnect = () => {
        wasKicked = true;

        clearInterval(interval);
        clearInterval(moveInterval);
        XAPI.sendInGamePresence(realm, false);

        client._disconnect();
    };

    client.on("kick", async (data) => {
        wasKicked = true;

        clearInterval(interval);
        clearInterval(moveInterval);
        if (data.message != "%disconnect.kicked") XAPI.sendInGamePresence(realm, false);

        console.log(`${JSON.stringify(data)}`);
    });

    client.on("error", (error) => {
        if (wasKicked) return;

        client.emit("kick", { message: String(error) });
    });

    client.on("close", () => {
        if (wasKicked) return;

        client.emit("kick", { message: "Lost connection" });
    });

    client.on("play_status", async (packet) => {
        if (packet.status === "player_spawn") {
            client.write("serverbound_loading_screen", {
                type: 1
            })

            await delay(750)

            client.write("serverbound_loading_screen", {
                type: 2
            })
        }
    })

    client.once("start_game", (packet) => {
        client.plrRuntimeID = packet.runtime_entity_id;
        client.currentPos = packet.player_position;

        moveInterval = setInterval(() => {
            client.move({ x: client.currentPos.x, y: client.currentPos.y, z: client.currentPos.z });
        }, 20);
    });

    client.on("respawn", (data) => {
        switch (data.state) {
            case 0:
                client.write('respawn', {
                    runtime_entity_id: client.plrRuntimeID,
                    state: 2,
                    position: { x: 0, y: 0, z: 0 },
                });
                break;
            case 1:
                client.write('player_action', {
                    runtime_entity_id: client.plrRuntimeID,
                    action: 'respawn',
                    position: { x: 0, y: 0, z: 0 },
                    result_position: { x: 0, y: 0, z: 0 },
                    face: -1
                });

                client.currentPos = data.position;
                break;
        }
    });

    client.on("move_player", (packet) => {
        if (packet.runtime_id === Number(client.plrRuntimeID)) {
            client.currentPos = packet.position;
        }
    });

    client.on("correct_player_move_prediction", (packet) => {
        client.currentPos = packet.position;
        client.tick = packet.tick;
    })

    client.on("packet_violation_warning", (packet) => {
        console.log(packet);
    });

    return client;
}

function getDeviceId(deviceOS) {
    if (!deviceOS) return;

    const deviceIdMap = {
        1: uuidv4().replace(/-/g, ""),
        2: uuidv4().replace(/-/g, "").toUpperCase(),
        11: uuidv3(uuidv4(), NIL),
        12: uuidv5(uuidv4(), NIL),
    };

    return deviceIdMap[deviceOS];
};

function getInputMode(deviceOS) {
    if (!deviceOS) return;

    const inputModeMap = {
        1: 2, 2: 2,
        11: 3, 12: 3,
    };

    return inputModeMap[deviceOS];
};

module.exports = bpClient;