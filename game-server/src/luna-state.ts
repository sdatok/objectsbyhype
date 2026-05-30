import { Schema, type, MapSchema, ArraySchema } from "@colyseus/schema";
import type { GameStatus } from "./state";
import { Obstacle, Player, Zone } from "./state";

/** Luna the dog — synced so every client sees the same chase. */
export class LunaDog extends Schema {
  @type("number") x = 0;
  @type("number") y = 0;
  @type("number") vx = 0;
  @type("number") vy = 0;
  @type("number") speed = 0;
  @type("string") targetSessionId = "";
  @type("number") catchAtMs = 0;
}

export class EscapeLunaState extends Schema {
  @type("string") status: GameStatus = "WAITING";
  @type("string") matchId = "";
  @type("string") prizeTitle = "";

  @type("number") startedAtMs = 0;
  @type("number") endedAtMs = 0;
  @type("number") countdownEndsAtMs = 0;
  @type("number") matchEndsAtMs = 0;
  @type("number") zoneShrink01 = 0;

  @type({ map: Player }) players = new MapSchema<Player>();
  @type([Obstacle]) obstacles = new ArraySchema<Obstacle>();
  @type(Zone) zone = new Zone();
  @type(LunaDog) dog = new LunaDog();
}
