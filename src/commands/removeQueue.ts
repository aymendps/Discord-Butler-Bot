import {
  CommandInteraction,
  Client,
  InteractionReplyOptions,
} from "discord.js";
import { sendInteractionReply } from ".";
import { Command } from "../interfaces/command";
import { SongQueue } from "../interfaces/song";
import { executeRemoveQueue } from "../functions/removeQueue";

export const RemoveQueueCommand: Command = {
  name: "remove-all",
  description: "Remove all songs from the queue",
  run: async (
    client: Client,
    interaction: CommandInteraction,
    songQueue: SongQueue
  ) => {
    executeRemoveQueue(songQueue, async (options: InteractionReplyOptions) => {
      return await sendInteractionReply(interaction, options);
    });
  },
};
