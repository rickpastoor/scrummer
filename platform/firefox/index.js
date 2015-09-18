var data = require("sdk/self").data;
var pageMod = require("sdk/page-mod");

pageMod.PageMod({
  include: "*.trello.com",
  contentScriptFile: data.url("scrummer.js"),
  contentStyleFile: data.url("scrummer.css"),
  attachTo: ["top"]
});
