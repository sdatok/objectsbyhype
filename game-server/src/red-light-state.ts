import { Schema, type, MapSchema } from "@colyseus/schema";
import type { GameStatus } from "./state";
import { Player } from "./state";
import {
  RLGL_FINISH_Y,
  RLGL_START_Y,
  RLGL_TRACK_LENGTH,
  RLGL_TRACK_WIDTH,
} from "./red-light-constants";

export class RedLightState extends Schema {
  @type("string") status: GameStatus = "WAITING";
  @type("string") matchId = "";
  @type("string") prizeTitle = "";

  @type("number") startedAtMs = 0;
  @type("number") endedAtMs = 0;
  @type("number") countdownEndsAtMs = 0;
  @type("number") matchEndsAtMs = 0;

  /** GREEN | TURNING | RED */
  @type("string") lightPhase = "GREEN";
  @type("number") roundNumber = 1;
  @type("number") phaseEndsAtMs = 0;

  @type("number") trackWidth = RLGL_TRACK_WIDTH;
  @type("number") trackLength = RLGL_TRACK_LENGTH;
  @type("number") startLineY = RLGL_START_Y;
  @type("number") finishLineY = RLGL_FINISH_Y;

  @type({ map: Player }) players = new MapSchema<Player>();
}
