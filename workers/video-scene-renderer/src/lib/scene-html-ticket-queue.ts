import { randomUUID } from "crypto";
import Redis from "ioredis";

const QUEUE_KEY = "scene-html:ticket-queue:v2";
const SEQUENCE_KEY = "scene-html:ticket-sequence:v2";
const ACTIVE_KEY = "scene-html:ticket-active:v2";
const HEARTBEAT_PREFIX = "scene-html:ticket-heartbeat:v2:";
// Longer than the Vercel route's 300-second hard limit. Healthy workers renew
// this lease; the longer expiry gives crashed workers a safe recovery window.
const LEASE_MS = 330_000;
const HEARTBEAT_MS = 30_000;

const ENQUEUE_SCRIPT = `
local sequence = redis.call('INCR', KEYS[1])
redis.call('ZADD', KEYS[2], sequence, ARGV[1])
redis.call('SET', KEYS[3], 'queued', 'PX', ARGV[2])
return sequence
`;

const ACQUIRE_SCRIPT = `
if redis.call('GET', KEYS[2]) then return 0 end

local head = redis.call('ZRANGE', KEYS[1], 0, 0)[1]
while head do
  local heartbeatKey = ARGV[2] .. head
  if redis.call('EXISTS', heartbeatKey) == 1 then break end
  redis.call('ZREM', KEYS[1], head)
  head = redis.call('ZRANGE', KEYS[1], 0, 0)[1]
end

if head ~= ARGV[1] then return 0 end
redis.call('ZREM', KEYS[1], ARGV[1])
redis.call('SET', KEYS[2], ARGV[1], 'PX', ARGV[3])
redis.call('SET', KEYS[3], 'active', 'PX', ARGV[3])
return 1
`;

const HEARTBEAT_SCRIPT = `
local renewed = 0
if redis.call('GET', KEYS[1]) == ARGV[1] then
  redis.call('PEXPIRE', KEYS[1], ARGV[2])
  redis.call('PEXPIRE', KEYS[2], ARGV[2])
  renewed = 1
elseif redis.call('EXISTS', KEYS[2]) == 1 then
  redis.call('PEXPIRE', KEYS[2], ARGV[2])
  renewed = 1
end
return renewed
`;

const RELEASE_SCRIPT = `
redis.call('ZREM', KEYS[1], ARGV[1])
redis.call('DEL', KEYS[3])
if redis.call('GET', KEYS[2]) == ARGV[1] then
  redis.call('DEL', KEYS[2])
end
return 1
`;

const CANCEL_SCRIPT = `
redis.call('ZREM', KEYS[1], ARGV[1])
redis.call('DEL', KEYS[2])
return 1
`;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Queue complete scene-generation requests in the long-running renderer.
 * This keeps parallel Shorts/long-form jobs from waiting inside Vercel while
 * preserving FIFO order and the separate per-Gemini-call 3-RPM limiter.
 */
export async function acquireSceneHtmlTicket(label: string): Promise<() => Promise<void>> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error("REDIS_URL is required for AI scene ticket management");

  const redis = new Redis(redisUrl);
  const ticket = randomUUID();
  const heartbeatKey = `${HEARTBEAT_PREFIX}${ticket}`;
  let acquired = false;
  let heartbeatTimer: ReturnType<typeof setInterval> | undefined;

  try {
    const position = await redis.eval(
      ENQUEUE_SCRIPT,
      3,
      SEQUENCE_KEY,
      QUEUE_KEY,
      heartbeatKey,
      ticket,
      String(LEASE_MS),
    );
    console.error(`[SceneQueue] Ticket ${ticket} queued for ${label} (sequence ${position}).`);

    while (!acquired) {
      const result = await redis.eval(
        ACQUIRE_SCRIPT,
        3,
        QUEUE_KEY,
        ACTIVE_KEY,
        heartbeatKey,
        ticket,
        HEARTBEAT_PREFIX,
        String(LEASE_MS),
      );
      acquired = Number(result) === 1;
      if (acquired) break;

      await redis.eval(
        HEARTBEAT_SCRIPT,
        2,
        ACTIVE_KEY,
        heartbeatKey,
        ticket,
        String(LEASE_MS),
      );
      await delay(1_000);
    }

    console.error(`[SceneQueue] Ticket ${ticket} acquired for ${label}.`);
    heartbeatTimer = setInterval(() => {
      void redis.eval(
        HEARTBEAT_SCRIPT,
        2,
        ACTIVE_KEY,
        heartbeatKey,
        ticket,
        String(LEASE_MS),
      ).catch((error) => console.error(`[SceneQueue] Ticket ${ticket} heartbeat failed:`, error));
    }, HEARTBEAT_MS);

    let released = false;
    return async () => {
      if (released) return;
      released = true;
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      try {
        await redis.eval(RELEASE_SCRIPT, 3, QUEUE_KEY, ACTIVE_KEY, heartbeatKey, ticket);
        console.error(`[SceneQueue] Ticket ${ticket} released for ${label}.`);
      } finally {
        await redis.quit();
      }
    };
  } catch (error) {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    try {
      if (acquired) {
        await redis.eval(RELEASE_SCRIPT, 3, QUEUE_KEY, ACTIVE_KEY, heartbeatKey, ticket);
      } else {
        await redis.eval(CANCEL_SCRIPT, 2, QUEUE_KEY, heartbeatKey, ticket);
      }
    } catch (cleanupError) {
      console.error(`[SceneQueue] Ticket ${ticket} cleanup failed:`, cleanupError);
    }
    await redis.quit();
    throw error;
  }
}
