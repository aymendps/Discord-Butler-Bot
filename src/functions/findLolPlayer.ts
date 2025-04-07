import axios, { AxiosResponse } from "axios";
import { EmbedBuilder } from "discord.js";
import * as dotenv from "dotenv";
dotenv.config({ path: __dirname + "/../../.env" });
import { RIOT_TOKEN } from "../config";
import { ChampionMasteryDTO } from "../interfaces/championMastery.dto";
import { LeagueEntryDTO } from "../interfaces/leagueEntry.dto";
import { sendReplyFunction } from "../interfaces/sendReplyFunction";
import { SummonerDTO } from "../interfaces/summoner.dto";

const findLolPlayer = async (summonerName: string) => {
  try {
    const summoner: AxiosResponse<SummonerDTO> = await axios.get(
      `https://euw1.api.riotgames.com/lol/summoner/v4/summoners/by-name/${summonerName}?api_key=${RIOT_TOKEN}`
    );
    const { id, profileIconId, summonerLevel, name } = summoner.data;

    const patch = await axios.get(
      "https://ddragon.leagueoflegends.com/api/versions.json"
    );

    const profileIconLink = `https://ddragon.leagueoflegends.com/cdn/${patch.data[0]}/img/profileicon/${profileIconId}.png`;

    const { data: leagueEntries }: AxiosResponse<LeagueEntryDTO[]> =
      await axios.get(
        `https://euw1.api.riotgames.com/lol/league/v4/entries/by-summoner/${id}?api_key=${RIOT_TOKEN}`
      );

    const rankedSolo = leagueEntries.find(
      (entry) => entry.queueType === "RANKED_SOLO_5x5"
    );
    const rankedFlex = leagueEntries.find(
      (entry) => entry.queueType === "RANKED_FLEX_SR"
    );

    const { data: championMasteries }: AxiosResponse<ChampionMasteryDTO[]> =
      await axios.get(
        `https://euw1.api.riotgames.com/lol/champion-mastery/v4/champion-masteries/by-summoner/${id}/top?api_key=${RIOT_TOKEN}`
      );

    const championMasteriesMapped = championMasteries.map((champ) => {
      return { id: champ.championId, points: champ.championPoints };
    });

    const { data } = await axios.get(
      `http://ddragon.leagueoflegends.com/cdn/${patch.data[0]}/data/en_US/champion.json`
    );

    const champions: Object = data.data;

    let bestChamps: { name: string; points: number }[] = [];

    championMasteriesMapped.forEach((c) => {
      for (const key in champions) {
        if (champions.hasOwnProperty(key)) {
          const champ = champions[key];
          if (Number(champ.key) === Number(c.id)) {
            bestChamps.push({ name: champ.name, points: c.points });
          }
        }
      }
    });

    return {
      profileIconLink,
      summonerLevel,
      name,
      rankedFlex,
      rankedSolo,
      bestChamps,
    };
  } catch (error) {
    console.log(error);
    return null;
  }
};

export const executeFindLolPlayer = async (
  summonerName: string,
  sendReplyFunction: sendReplyFunction
) => {
  try {
    const summonerData = await findLolPlayer(summonerName);
    if (!summonerData) {
      sendReplyFunction({
        embeds: [
          new EmbedBuilder()
            .setTitle(`Summoner '${summonerName}' was not found`)
            .setDescription(
              "Make sure that you typed a valid EUW summoner name"
            )
            .setColor("DarkRed"),
        ],
      });
      return;
    }

    const rankedSoloEmbeds = summonerData.rankedSolo
      ? [
          {
            name: "Ranked Solo Tier",
            value:
              summonerData.rankedSolo.tier + " " + summonerData.rankedSolo.rank,
            inline: true,
          },
          {
            name: "Ranked Solo LP",
            value: summonerData.rankedSolo.leaguePoints.toString(),
            inline: true,
          },
          {
            name: "Ranked Solo HotStreak",
            value: summonerData.rankedSolo.hotStreak ? "Yes" : "No",
            inline: true,
          },
          {
            name: "Ranked Solo Wins",
            value: summonerData.rankedSolo.wins.toString(),
            inline: true,
          },
          {
            name: "Ranked Solo Losses",
            value: summonerData.rankedSolo.losses.toString(),
            inline: true,
          },
          {
            name: "Ranked Solo Winrate",
            value:
              (
                (Number(summonerData.rankedSolo.wins) * 100) /
                (Number(summonerData.rankedSolo.wins) +
                  Number(summonerData.rankedSolo.losses))
              )
                .toFixed(2)
                .toString() + "%",
            inline: true,
          },
          {
            name: "\u200b",
            value: "\u200b",
            inline: false,
          },
        ]
      : [];

    const rankedFlexEmbeds = summonerData.rankedFlex
      ? [
          {
            name: "Ranked Flex Tier",
            value:
              summonerData.rankedFlex.tier + " " + summonerData.rankedFlex.rank,
            inline: true,
          },
          {
            name: "Ranked Flex LP",
            value: summonerData.rankedFlex.leaguePoints.toString(),
            inline: true,
          },
          {
            name: "Ranked Flex HotStreak",
            value: summonerData.rankedFlex.hotStreak ? "Yes" : "No",
            inline: true,
          },
          {
            name: "Ranked Flex Wins",
            value: summonerData.rankedFlex.wins.toString(),
            inline: true,
          },
          {
            name: "Ranked Flex Losses",
            value: summonerData.rankedFlex.losses.toString(),
            inline: true,
          },
          {
            name: "Ranked Flex Winrate",
            value:
              (
                (Number(summonerData.rankedFlex.wins) * 100) /
                (Number(summonerData.rankedFlex.wins) +
                  Number(summonerData.rankedFlex.losses))
              )
                .toFixed(2)
                .toString() + "%",
            inline: true,
          },
          {
            name: "\u200b",
            value: "\u200b",
            inline: false,
          },
        ]
      : [];

    sendReplyFunction({
      embeds: [
        new EmbedBuilder()
          .setTitle("League Of Legends - " + summonerData.name)
          .setURL(
            `https://www.op.gg/summoners/euw/${summonerName.replace(/\s/g, "")}`
          )
          .setThumbnail(summonerData.profileIconLink)
          .setColor("DarkGreen")
          .addFields(
            {
              name: "Summoner Level",
              value: summonerData.summonerLevel.toString(),
            },
            {
              name: "\u200b",
              value: "\u200b",
              inline: false,
            },
            ...rankedSoloEmbeds,
            ...rankedFlexEmbeds,
            {
              name: "1st Most Played",
              value: summonerData?.bestChamps[0]?.name,
              inline: true,
            },
            {
              name: "2nd Most Played",
              value: summonerData?.bestChamps[1]?.name,
              inline: true,
            },
            {
              name: "3rd Most Played",
              value: summonerData?.bestChamps[2]?.name,
              inline: true,
            }
          ),
      ],
    });
  } catch (error) {
    sendReplyFunction({
      embeds: [
        new EmbedBuilder()
          .setTitle(`Summoner '${summonerName}' was not found`)
          .setDescription("Make sure that you typed a valid EUW summoner name")
          .setColor("DarkRed"),
      ],
    });
    console.log(error);
  }
};
