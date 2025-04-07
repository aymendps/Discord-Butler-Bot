import { BannedChampionDTO } from "./bannedChampion.dto";
import { CurrentLoLMatchParticipantDTO } from "./currentLolMatchParticipant.dto";

export interface CurrentLoLMatchDTO {
  gameId: number;
  gameLength: number;
  bannedChampions: BannedChampionDTO[];
  participants: CurrentLoLMatchParticipantDTO[];
}
