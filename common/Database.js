"use strict";

const mongoose = require("mongoose");
const config = require("../ext/config.json");

const userSchema = new mongoose.Schema({
  id: String,
  blacklisted: Boolean,
  staff: Boolean,
  didLink: Boolean,
  playFabId: String,
  linkDevice: String,
  linkData: Object
});

const user = mongoose.model("User", userSchema);

mongoose.set("strictQuery", true);

mongoose.connect(config.DB_URL).catch((error) => {
  console.error(error);
  process.exit(1);
});

function createUserDefaults(data) {
  if (!data.id) throw TypeError("Missing User ID");

  return new user({
    _id: data._id,
    id: data.id,
    blacklisted: data.blacklisted ?? false,
    staff: data.staff ?? false,
    didLink: data.didLink ?? false,
    playFabId: data.playFabId ?? "",
    linkDevice: data.linkDevice ?? "",
    linkData: data.linkData ?? {}
  });
}

module.exports = {
  userModel: user,
  createUserDefaults: createUserDefaults
};