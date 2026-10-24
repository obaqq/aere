const { Authflow } = require("prismarine-auth");

const { getCacheFactory, deviceMapping } = require("./Util.js");
const { userModel } = require("./Database.js");

class XboxAPI {
  constructor(accountID) {
    this.accountID = accountID;
  }

  cleanLinkData(dbUser) {
    dbUser.didLink = false;
    dbUser.linkData = {};
    dbUser.linkDevice = "";
    dbUser.playFabId = "";
    dbUser.save();
  }

  async getXboxToken(relyingParty) {
    const dbUser = await userModel.findOne({ id: this.accountID });

    let userFlow = deviceMapping[dbUser.linkDevice] || {};

    if (dbUser.linkDevice.length === 0) {
      this.cleanLinkData(dbUser);
      console.log(`(${dbUser.id}) has nothing in the linkDevice field. Device Choosen: ${dbUser.linkDevice}`);
      return;
    }

    let flow = new Authflow(undefined, getCacheFactory(dbUser), {
      flow: userFlow.flow,
      authTitle: userFlow.authTitle,
      deviceType: userFlow.deviceType,
    }, (data) => {
      this.cleanLinkData(dbUser);
      console.log(data);
      return data;
    });

    let xboxToken = await flow.getXboxToken(relyingParty);

    if (typeof xboxToken.userXUID === "string" || typeof xboxToken.userXUID === "number") this.xuid = xboxToken?.userXUID;

    return `XBL3.0 x=${xboxToken.userHash};${xboxToken.XSTSToken}`;
  }

  async sendPresence(body) {
    const authToken = await this.getXboxToken();

    body = JSON.stringify(body);

    if (authToken?.errorMsg) return authToken;

    const response = await fetch(`https://userpresence.xboxlive.com/users/xuid(${this.xuid})/devices/current/titles/current`, {
      method: "POST",
      headers: {
        "x-xbl-contract-version": 3,
        "Accept-Encoding": "gzip, deflate",
        "Accept": "application/json",
        "Accept-Language": "en-US",
        "Content-Length": body.length,
        "Authorization": authToken,
        "Content-Type": "application/json; charset=UTF-8",
        "Host": "userpresence.xboxlive.com",
        "Connection": "Keep-Alive",
        "Cache-Control": "no-cache"
      },
      body: body
    });

    if (response.status === 200) return "success";
    if (response.status !== 200) console.log({ errorMsg: `${response.status} ${response.statusText} ${await response.text()}` });

    return;
  }

  async sendInGamePresence(realm, inGame) {
    const authToken = await this.getXboxToken();

    if (authToken?.errorMsg) return authToken;

    const response = await fetch(`https://clubpresence.xboxlive.com/clubs/${realm.clubId}/users/xuid(${this.xuid})/session?titleFamilyId=3347393a-1a27-4e26-a623-31173bb86ee1`, {
      method: "POST",
      headers: {
        "Accept-Language": "en-US",
        "Authorization": authToken,
        "Content-Type": "application/json",
        "User-Agent": "libhttpclient/1.0.0.0",
        "x-xbl-contract-version": "1",
        "Accept-Encoding": "gzip, deflate, br",
        "Host": "clubpresence.xboxlive.com",
        "Connection": "Keep-Alive",
        "Cache-Control": "no-cache"
      },
      body: JSON.stringify({ "inGame": inGame })
    });

    if (response.status === 204) return "success";
    if (response.status === 409) return;
    if (response.status !== 200) console.log({ errorMsg: `${response.status} ${response.statusText} ${await response.text()}` });

    return;
  }

  async getXboxUser(xuid) {
    if (!xuid) return;

    const authToken = await this.getXboxToken();

    if (authToken?.errorMsg) return authToken;

    const response = await fetch(`https://peoplehub.xboxlive.com/users/me/people/xuids(${xuid})/decoration/detail,preferredColor,presenceDetail`, {
      method: "GET",
      headers: {
        "x-xbl-contract-version": 4,
        "Accept-Encoding": "gzip, deflate",
        "Accept": "application/json",
        "User-Agent": "WindowsGameBar/5.823.1271.0",
        "Accept-Language": "en-US",
        "Authorization": authToken,
        "Host": "peoplehub.xboxlive.com",
        "Connection": "Keep-Alive"
      }
    });

    switch (response.status) {
      case 200:
        const user = (await response.json()).people[0];
        return user;
      case 400:
      case 401:
        return null;
      default:
        console.log({ errorMsg: `${response.status} ${response.statusText} ${await response.text()}` });
    }
  }

  async getXboxUsers(xuids = []) {
    if (xuids.length === 0) return [];

    const authToken = await this.getXboxToken();

    if (authToken.errorMsg) return authToken;

    const response = await fetch("https://peoplehub.xboxlive.com/users/me/people/batch/decoration/detail,presenceDetail", {
      method: "POST",
      headers: {
        "x-xbl-contract-version": 4,
        "Accept-Encoding": "gzip, deflate",
        "Accept": "application/json",
        "User-Agent": "WindowsGameBar/5.823.1271.0",
        "Accept-Language": "en-US",
        "Authorization": authToken,
        "Host": "peoplehub.xboxlive.com",
        "Connection": "Keep-Alive"
      },
      body: JSON.stringify({ xuids })
    });

    if (response.status !== 200) return { errorMsg: `${response.status} ${response.statusText} ${await response.text()}` };

    const users = (await response.json()).people;

    return users;
  }
}

module.exports = XboxAPI;