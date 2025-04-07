import { Client, EmbedBuilder, GuildMember } from "discord.js";
import { Song } from "../interfaces/song";
import { sendReplyFunction } from "../interfaces/sendReplyFunction";
import fs = require("fs");
import path = require("path");

export const executeViewFavorites = async (
  client: Client,
  member: GuildMember,
  memberTagArgs: string,
  sendReplyFunction: sendReplyFunction
) => {
  try {
    let username = member.user.username;
    let nickname = member.nickname;

    if (memberTagArgs) {
      const taggedMember = await member.guild.members.fetch(
        memberTagArgs.slice(0, -1).substring(2)
      );
      if (taggedMember) {
        username = taggedMember.user.username;
        nickname = taggedMember.nickname;
      }
    }

    const file = fs.readFileSync(
      path.join(__dirname, `../../.data/${username}.data`),
      "utf-8"
    );
    const faves: Song[] = JSON.parse(file);
    const fields = faves.map((song, index) => {
      return {
        name: `Song #${index}`,
        value: `${song.title}\n${song.url}`,
        inline: false,
      };
    });

    const iterations = Math.ceil(fields.length / 25);
    for (let i = 0; i < iterations; i++) {
      await sendReplyFunction({
        embeds: [
          new EmbedBuilder()
            .setTitle(`${nickname}'s Faves - Page ${i + 1}/${iterations}`)
            .addFields(fields.slice(i * 25, i * 25 + 25))
            .setColor("DarkGreen"),
        ],
      });
    }
  } catch (error) {
    if (error.code === "ENOENT") {
      sendReplyFunction({
        embeds: [
          new EmbedBuilder()
            .setTitle("No Favorites..?")
            .setDescription(
              "You don't have any songs that were added to your favorites!"
            )
            .setColor("DarkGold"),
        ],
      });
    } else {
      console.log(error);
      sendReplyFunction({
        embeds: [
          new EmbedBuilder()
            .setTitle("Something went wrong")
            .setDescription("Could not find your faves...")
            .setColor("DarkRed"),
        ],
      });
    }
  }
};
