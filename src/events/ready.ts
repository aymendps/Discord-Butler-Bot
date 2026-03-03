import { Client } from "discord.js";
import { Commands } from "../commands";

export default (client: Client) => {
  client.on("clientReady", async () => {
    if (!client.user || !client.application) {
      return;
    }

    await client.application.commands.set(Commands);

    console.log("Butler Bot is online");
  });
};
