const XboxAPI = require("./Xbox.js");

const { deviceMapping } = require("./Util.js");
const { userModel } = require("./Database.js");

async function RealmAPI(accountID) {
  let rAPI = new realmAPI(accountID);

  await rAPI.init();

  return rAPI;
}

class realmAPI {
  constructor(accountID) {
    this.accountID = accountID;
    this.XboxAPI = new XboxAPI(accountID);
  }

  async init() {
    this.authToken = await this.XboxAPI.getXboxToken("https://pocket.realms.minecraft.net/");
    this.dbUser = await userModel.findOne({ id: this.accountID }, { linkDevice: 1 }).lean();
    this.userFlow = deviceMapping[this.dbUser?.linkDevice ?? "Android"];
    this.headers = {
      "Accept": "*/*",
      "charset": "utf-8",
      "client-ref": "6cb94105f2e04905396f9612b5d0912e3f136942",
      "client-version": "1.21.70",
      "x-clientplatform": this.userFlow?.deviceType ?? "Windows",
      "x-networkprotocolversion": "786",
      "content-type": "application/json",
      "user-agent": this.userFlow?.userAgent ?? "MCPE/UWP",
      "Accept-Language": "en-US",
      "Accept-Encoding": "gzip, deflate, br",
      "Host": "pocket.realms.minecraft.net",
      "Connection": "Keep-Alive"
    };
  }

  async getRealms() {
    const response = await fetch("https://bedrock.frontendlegacy.realms.minecraft-services.net/worlds", {
      method: "GET",
      headers: {
        ...this.headers,
        "authorization": this.authToken,
      },
    });

    switch (response.status) {
      case 200:
      case 403:
        break;
      default:
        console.log(`Error: ${response.status} ${response.statusText}`);
        return response.status;
    }

    const data = await response.json();

    return data.servers;
  }

  async getRealmInfo(realmCode, quick = true) {
    const response = await fetch(`https://bedrock.frontendlegacy.realms.minecraft-services.net/worlds/v1/link/${realmCode}`, {
      method: "GET",
      headers: {
        ...this.headers,
        "authorization": this.authToken
      }
    });

    if (response.status !== 200) {
      console.log(`Error: ${response.status} ${response.statusText} getRealmInfo`);

      return { body: await response.json(), status: response.status }
    }

    let realm = await response.json();

    if (!realm.member) await this.joinRealm(realmCode);

    // So we can get the members and other data for /realm
    if (!quick) realm = await this.getRealmInfoByID(realm.id);

    return realm
  }

  async getRealmInfoByID(realmID) {
    const response = await fetch(`https://bedrock.frontendlegacy.realms.minecraft-services.net/worlds/${realmID}`, {
      method: "GET",
      headers: {
        ...this.headers,
        "authorization": this.authToken
      }
    });

    if (response.status !== 200) {
      console.log(`Error: ${response.status} ${response.statusText} getRealmInfo`);

      return { body: await response.json(), status: response.status }
    }

    return await response.json();
  }

  async joinRealm(code) {
    const response = await fetch(`https://bedrock.frontendlegacy.realms.minecraft-services.net/invites/v1/link/accept/${code}`, {
      method: "POST",
      headers: {
        ...this.headers,
        "authorization": this.authToken,
      }
    });

    if (response.status !== 200) {
      console.log(`Error: ${response.status} ${response.statusText} ${await response.text()} joinRealm`);

      return response.status;
    }

    let data = await response.json();

    return data
  }

  async getRealmIP(realmID) {
    while (true) {
      const response = await fetch(`https://bedrock.frontendlegacy.realms.minecraft-services.net/worlds/${realmID}/join`, {
        method: "GET",
        headers: {
          ...this.headers,
          "authorization": this.authToken
        }
      });

      switch (response.status) {
        case 200:
          return await response.json();
        case 503:
          await new Promise(resolve => setTimeout(resolve, 1350));
          break;
        case 502:
        case 504:
          return { status: response.status }
        case 403:
        default:
          console.log(`Error: ${response.status} ${response.statusText}`,);
          return { body: await response.json(), status: response.status }
      }
    }
  }

  async getInvites() {
    const response = await fetch(`https://bedrock.frontendlegacy.realms.minecraft-services.net/invites/pending`, {
      method: "GET",
      headers: {
        ...this.headers,
        "authorization": this.authToken,
      }
    });

    switch (response.status) {
      case 200:
      case 403:
        break;
      default:
        console.log(`Error: ${response.status} ${response.statusText} ${await response.text()}`);
        return response.status;
    }

    return (await response.json()).invites
  }

  async acceptInvite(inviteId) {
    const response = await fetch(`https://bedrock.frontendlegacy.realms.minecraft-services.net/invites/accept/${inviteId}`, {
      method: "PUT",
      headers: {
        ...this.headers,
        "authorization": this.authToken
      }
    });

    return response.status
  }
}

module.exports = RealmAPI;