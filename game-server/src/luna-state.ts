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
  /** Server time when Luna last jumped over an obstacle (client VFX). */
  @type("number") jumpAtMs = 0;
  /** While now < shootUntilMs, Luna stands still and fires. */
  @type("number") shootUntilMs = 0;
  /** Gun aim (radians) during shoot phase. */
  @type("number") aimAngle = 0;
  /** Server time of last bullet spawned this barrage. */
  @type("number") lastBulletAtMs = 0;
  /** When the next stand-still barrage begins. */
  @type("number") nextBarrageAtMs = 0;
}

/** Luna's piercing shots — pass through obstacles. */
export class LunaBullet extends Schema {
  @type("number") x = 0;
  @type("number") y = 0;
  @type("number") vx = 0;
  @type("number") vy = 0;
  @type("number") spawnedAtMs = 0;
}

/** Circular pit — players fall through; Luna treats as solid. */
export class LunaPit extends Schema {
  @type("number") x = 0;
  @type("number") y = 0;
  @type("number") radius = 60;
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
  @type([LunaPit]) pits = new ArraySchema<LunaPit>();
  @type([LunaBullet]) bullets = new ArraySchema<LunaBullet>();
  @type(Zone) zone = new Zone();
  @type(LunaDog) dog = new LunaDog();
}
