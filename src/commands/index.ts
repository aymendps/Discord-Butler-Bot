import {
  CommandInteraction,
  InteractionReplyOptions,
  MessageCreateOptions,
  TextChannel,
} from "discord.js";
import { Command } from "../interfaces/command";
import { AddSongCommand } from "./addSong";
import { findActiveLolMatchCommand } from "./findActiveLolMatch";
import { FindLolPlayerCommand } from "./findLolPlayer";
import { HelloCommand } from "./hello";
import { LoopSongCommand } from "./loopSong";
import { PlaySongCommand } from "./playSong";
import { SkipSongCommand } from "./skipSong";
import { StopSongCommand } from "./stopSong";
import { RemoveSongCommand } from "./removeSong";
import { SeekSongTimeCommand } from "./seekSongTime";
import { AddToFavoritesCommand } from "./addToFavorites";
import { ViewFavoritesCommand } from "./viewFavorites";
import { PlayFavoritesCommand } from "./playFavorites";
import { SearchSongCommand } from "./searchSong";
import { SuggestSongCommand } from "./suggestSong";
import { ViewQueueCommand } from "./viewQueue";
import { RemoveQueueCommand } from "./removeQueue";
import { AddToPlaylistCommand } from "./addToPlaylist";
import { ViewPlaylistCommand } from "./viewPlaylist";
import { ViewPlaylistAllCommand } from "./viewPlaylistAll";
import { PlayPlaylistCommand } from "./playPlaylist";
import { PlaySongFromFileCommand } from "./playSongFromFile";

export const sendInteractionReply = async (
  interaction: CommandInteraction,
  options: InteractionReplyOptions
) => {
  try {
    return await interaction.followUp(options);
  } catch (error) {
    const channel = interaction.channel as TextChannel;
    return await channel.send(options as MessageCreateOptions);
  }
};

export const Commands: Command[] = [
  HelloCommand,
  SearchSongCommand,
  SuggestSongCommand,
  AddSongCommand,
  PlaySongCommand,
  PlaySongFromFileCommand,
  SkipSongCommand,
  StopSongCommand,
  LoopSongCommand,
  ViewQueueCommand,
  RemoveSongCommand,
  RemoveQueueCommand,
  SeekSongTimeCommand,
  AddToFavoritesCommand,
  ViewFavoritesCommand,
  PlayFavoritesCommand,
  AddToPlaylistCommand,
  PlayPlaylistCommand,
  ViewPlaylistCommand,
  ViewPlaylistAllCommand,
  FindLolPlayerCommand,
  findActiveLolMatchCommand,
];
