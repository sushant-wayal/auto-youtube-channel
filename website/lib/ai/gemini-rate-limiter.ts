import Redis from "ioredis";

const MIN_REQUEST_INTERVAL_MS = 21_000;

const RESERVE_SLOT_SCRIPT = `
local now_parts = redis.call('TIME')
local now_ms = tonumber(now_parts[1]) * 1000 + math.floor(tonumber(now_parts[2]) / 1000)
local interval_ms = tonumber(ARGV[1])
local next_allowed_ms = tonumber(redis.call('GET', KEYS[1]) or '0')
local scheduled_ms = math.max(now_ms, next_allowed_ms)
local next_slot_ms = scheduled_ms + interval_ms
local ttl_ms = math.max(interval_ms * 2, next_slot_ms - now_ms + interval_ms)

redis.call('SET', KEYS[1], next_slot_ms, 'PX', ttl_ms)
return math.max(0, scheduled_ms - now_ms)
`;

let redisClient: Redis | undefined;

function getRedisClient(): Redis {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error("REDIS_URL is required to enforce Gemini project request limits");
  }

  if (!redisClient) redisClient = new Redis(redisUrl);
  return redisClient;
}

/**
 * Reserve a start time in a shared Redis queue for this Google Cloud project.
 * A 21-second interval stays below 3 requests in every rolling 60-second window.
 */
export async function waitForGeminiProjectSlot(projectId: string): Promise<void> {
  const bucket = projectId.trim() || "shared-default";
  const redisKey = `gemini:request-slot:v1:${encodeURIComponent(bucket)}`;
  const waitMs = Number(await getRedisClient().eval(
    RESERVE_SLOT_SCRIPT,
    1,
    redisKey,
    String(MIN_REQUEST_INTERVAL_MS),
  ));

  if (waitMs > 0) {
    await new Promise<void>((resolve) => setTimeout(resolve, waitMs));
  }
}
