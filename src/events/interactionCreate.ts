import { AudioPlayer } from "@discordjs/voice";
import { Client, Interaction, CommandInteraction } from "discord.js";
import { Commands } from "../commands";
import { SongQueue } from "../interfaces/song";

const handleSlashCommand = async (
  client: Client,
  interaction: CommandInteraction,
  songQueue: SongQueue,
  audioPlayer: AudioPlayer
) => {
  const slashCommand = Commands.find(
    (command) => command.name === interaction.commandName
  );

  if (!slashCommand) {
    console.error(
      "Command " +
        interaction.commandName +
        " was not found in available Commands"
    );
    return;
  }

  await interaction.deferReply();

  slashCommand.run(client, interaction, songQueue, audioPlayer);
};

export default (
  client: Client,
  songQueue: SongQueue,
  audioPlayer: AudioPlayer
) => {
  client.on("interactionCreate", async (interaction: Interaction) => {
    if (interaction.isCommand() || interaction.isContextMenuCommand()) {
      await handleSlashCommand(client, interaction, songQueue, audioPlayer);
    }
  });
};
