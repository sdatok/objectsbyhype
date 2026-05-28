import { Schema, type, MapSchema, ArraySchema } from "@colyseus/schema";

/**
 * @colyseus/schema state for the Survivor room. Every property decorated
 * with @type is automatically delta-synced to clients on each patch.
 *
 * Conventions:
 *   - All positions in WORLD units. Client maps world -> screen pixels.
 *   - `status` mirrors the SurvivorMatchStatus enum used in Postgres.
 *   - `phase` adds a transient "COUNTDOWN" between WAITING and PLAYING.
 */

export type GameStatus = "WAITING" | "COUNTDOWN" | "PLAYING" | "ENDED";

export class Player extends Schema {
  @type("string") email = "";
  @type("string") displayName = "";

  @type("number") x = 0;
  @type("number") y = 0;
  @type("number") aim = 0; // radians

  @type("number") hp = 0;
  @type("number") kills = 0;

  @type("boolean") alive = false;

  /** Server time (ms since epoch) when the player died — null while alive. */
  @type("number") deathAt = 0;

  /** Last shot timestamp; client uses for cooldown HUD. */
  @type("number") lastShotAt = 0;

  /** Final placement once the match ends (1 = winner). 0 until decided. */
  @type("number") placement = 0;

  /** True once they're connected to the room; flipped off on disconnect. */
  @type("boolean") connected = false;

  /** Currently equipped weapon. Defaults to pistol; tower/pickup buffs expire. */
  @type("string") weapon = "pistol";

  /** UNIX ms when a temporary weapon reverts to default pistol. 0 = base loadout. */
  @type("number") weaponExpiresAtMs = 0;

  /** Slime body colour (hex). Chosen in lobby. */
  @type("string") slimeColor = "#22d3ee";
  /** Eye expression preset 0..3. */
  @type("number") slimeFace = 0;

  /** Collision radius multiplier (1 = default PLAYER_RADIUS). */
  @type("number") radiusScale = 1;
  /** Move speed multiplier (1 = default PLAYER_SPEED). */
  @type("number") speedScale = 1;
  /** Current HP cap (default PLAYER_MAX_HP). */
  @type("number") maxHp = 100;
  /** UNIX ms burn DoT ends (flamethrower). */
  @type("number") burnUntilMs = 0;
  /** UNIX ms freeze slow ends (ice bow). */
  @type("number") frozenUntilMs = 0;
  /** towerCycleEndsAtMs of the cycle that last granted a gun (avoid re-roll every tick). */
  @type("number") gunGrantedCycleEndsAtMs = 0;
  /** @deprecated — kept for schema compat */
  @type("number") towerBuffExpiresAtMs = 0;
  /** @deprecated — kept for schema compat */
  @type("string") towerBuffKind = "";
}

export class Bullet extends Schema {
  @type("string") ownerId = "";
  @type("number") x = 0;
  @type("number") y = 0;
  @type("number") vx = 0;
  @type("number") vy = 0;
  /** Server time when the bullet was spawned; used for TTL on the server. */
  @type("number") spawnedAt = 0;
  /** Per-bullet TTL in ms (weapons override the default). */
  @type("number") ttlMs = 1500;
  /** Weapon kind that spawned this bullet — drives client-side tint. */
  @type("string") kind = "pistol";
}

export class Pickup extends Schema {
  /** "health" | weapon kind */
  @type("string") kind = "";
  @type("number") x = 0;
  @type("number") y = 0;
  @type("number") spawnedAt = 0;
}

/**
 * Axis-aligned bounding-box obstacle. Generated once at match start and never
 * mutated thereafter. Players are pushed out, bullets stop on hit, and pickups
 * refuse to spawn inside.
 */
export class Obstacle extends Schema {
  /** cliff/rock/palm/wreck/gorilla/flower/tower_* — blocks movement + bullets. */
  @type("string") kind = "rock";
  /** World position of the AABB centre. */
  @type("number") x = 0;
  @type("number") y = 0;
  @type("number") w = 80;
  @type("number") h = 80;
}

export class Zone extends Schema {
  @type("number") cx = 0;
  @type("number") cy = 0;
  @type("number") radius = 0;
  /** Future target radius (zone is currently shrinking toward this). */
  @type("number") targetRadius = 0;
}

export class SurvivorState extends Schema {
  @type("string") status: GameStatus = "WAITING";
  @type("string") matchId = "";
  @type("string") prizeTitle = "";

  /** Server clock the match started (PLAYING). 0 before that. */
  @type("number") startedAtMs = 0;
  /** Server clock the match ended. 0 while playing. */
  @type("number") endedAtMs = 0;
  /** UNIX ms when countdown will become PLAYING (only while COUNTDOWN). */
  @type("number") countdownEndsAtMs = 0;
  /** UNIX ms when the playing phase auto-ends (only while PLAYING). */
  @type("number") matchEndsAtMs = 0;
  /** 0..1 how far the safe zone has shrunk (synced each tick for reliable client render). */
  @type("number") zoneShrink01 = 0;

  /** Vendor tower lit for the current weapon cycle (tower_* kind or empty). */
  @type("string") activeTowerKind = "";
  /** Weapon granted at the active tower this cycle (pistol, rocket, etc.). */
  @type("string") activeBonusKind = "";
  /** UNIX ms when the current tower bonus cycle ends. */
  @type("number") towerCycleEndsAtMs = 0;
  /** Monotonic counter — drives sequential tower + weapon rotation. */
  @type("number") towerCycleIndex = 0;

  @type({ map: Player }) players = new MapSchema<Player>();
  @type([Bullet]) bullets = new ArraySchema<Bullet>();
  @type([Pickup]) pickups = new ArraySchema<Pickup>();
  @type([Obstacle]) obstacles = new ArraySchema<Obstacle>();
  @type(Zone) zone = new Zone();
}
