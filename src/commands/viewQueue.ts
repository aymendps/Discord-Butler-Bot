import {
  CommandInteraction,
  Client,
  InteractionReplyOptions,
} from "discord.js";
import { sendInteractionReply } from ".";
import { Command } from "../interfaces/command";
import { SongQueue } from "../interfaces/song";
import { executeViewQueue } from "../functions/viewQueue";

export const ViewQueueCommand: Command = {
  name: "queue",
  description: "View the songs in the queue with their current order",
  run: async (
    client: Client,
    interaction: CommandInteraction,
    songQueue: SongQueue
  ) => {
    executeViewQueue(songQueue, async (options: InteractionReplyOptions) => {
      return await sendInteractionReply(interaction, options);
    });
  },
};
