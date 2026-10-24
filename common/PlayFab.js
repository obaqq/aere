const fetch = require("node-fetch");
const XboxAPI = require("./Xbox.js");

class PlayFabAPI {
	constructor(accountID) {
		this.apiUrl = "https://20ca2.playfabapi.com";
		this.sdkVersion = "XPlatCppSdk-3.6.190304";
		this.XAPI = new XboxAPI(accountID);
		this.api_headers = {
			"Accept": "application/json",
			"content-type": "application/json",
			"User-Agent": "libhttpclient/1.0.0.0",
			"x-playfabsdk": this.sdkVersion,
			"Accept-Language": "en-US",
			"Accept-Encoding": "gzip, deflate, br",
			"Host": "20ca2.playfabapi.com",
			"Connection": "Keep-Alive",
			"Cache-Control": "no-cache"
		};
	}

	async loginWithXbox() {
		const authToken = await this.XAPI.getXboxToken("rp://playfabapi.com/");

		if (authToken.errorMsg) return authToken;

		const body = JSON.stringify({
			CreateAccount: true,
			EncryptedRequest: null,
			InfoRequestParameters: {
				GetCharacterInventories: false,
				GetCharacterList: false,
				GetPlayerProfile: true,
				GetPlayerStatistics: false,
				GetTitleData: false,
				GetUserAccountInfo: true,
				GetUserData: false,
				GetUserInventory: false,
				GetUserReadOnlyData: false,
				GetUserVirtualCurrency: false,
				PlayerStatisticNames: null,
				ProfileConstraints: null,
				TitleDataKeys: null,
				UserDataKey: null,
				UserReadOnlyDataKeys: null
			},
			PlayerSecret: null,
			TitleId: "20CA2",
			XboxToken: authToken
		}, null, 2);

		const response = await fetch(`${this.apiUrl}/Client/LoginWithXbox?sdk=${this.sdkVersion}`, {
			method: "POST",
			headers: {
				...this.api_headers,
				"Content-Length": body.length
			},
			body,
		});

		const data = await response.json();

		if (data.status !== "OK") return { errorMsg: `[loginWithXbox] ${data.code} ${data.status}. Error: ${data.errorMessage}` };

		return data.data;
	}

	async updateLoginCount() {
		const authData = await this.loginWithXbox();

		if (authData.errorMsg) return authData;

		const profile = await this.XAPI.getXboxUser(authData.InfoResultPayload.AccountInfo.XboxInfo.XboxUserId);

		if (!profile) return;

		const body = JSON.stringify({
			Data: { "GamertagHint": profile.gamertag },
			Entity: { "Id": authData.PlayFabId, "Type": "master_player_account" },
			Permission: "Public"
		}, null, 2);

		const updateResponse = await fetch(`${this.apiUrl}/Client/UpdateUserPublisherData`, {
			method: "POST",
			headers: {
				...this.api_headers,
				"x-authorization": authData.SessionTicket,
				"Content-Length": body.length
			},
			body
		});

		const updateData = await updateResponse.json();

		if (updateData.status !== "OK") return { errorMsg: `[updateLoginCount] ${updateData.code} ${updateData.status}. Error: ${updateData.errorMessage}` };

		return { updateData };
	}
}

module.exports = PlayFabAPI;