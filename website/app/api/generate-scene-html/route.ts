import { NextRequest, NextResponse } from "next/server";
import Redis from "ioredis";
import SceneHtmlGenerationService from "@/lib/scene-html/scene-html-generation";

const redis = new Redis(process.env.REDIS_URL!);

export async function POST(request: NextRequest) {
  let ticket: number | undefined;
  try {
    const body = await request.json();
    const narration = typeof body.narration === "string" ? body.narration : "";

    if (!narration.trim() && body.allowEmptyNarration !== true) {
      return NextResponse.json(
        { error: "Narration is required" },
        { status: 400 }
      );
    }

    // 1. Atomically acquire ticket
    ticket = await redis.incr("html_queue:last_enquiry");
    console.log(`[Queue] Ticket ${ticket} acquired for sceneId: ${body.sceneId || "unknown"}`);

    // 2. Wait until my turn
    while (true) {
      const turnStr = await redis.get("html_queue:turn");
      const turn = turnStr ? parseInt(turnStr, 10) : 1;

      if (turn === ticket) {
        console.log(`[Queue] Ticket ${ticket} is now active.`);
        break;
      }

      // Crash recovery
      if (turn === ticket - 1) {
        const processingExists = await redis.exists("html_queue:processing");
        if (!processingExists) {
          // Attempt recovery atomically
          const recovered = await redis.eval(
            `
            local turn = tonumber(redis.call('get', 'html_queue:turn'))
            local processing = redis.call('exists', 'html_queue:processing')
            local targetTurn = tonumber(ARGV[1])
            if turn == targetTurn and processing == 0 then
              redis.call('incr', 'html_queue:turn')
              return 1
            end
            return 0
            `,
            0,
            String(ticket - 1)
          );

          if (recovered === 1) {
            console.log(`[Queue] Recovery event: Ticket ${ticket} detected previous ticket ${ticket - 1} crashed/died. Advanced turn.`);
            continue;
          }
        }
      }

      console.log(`[Queue] Ticket ${ticket} waiting. Current turn: ${turn}.`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    // 3. Create lease (90 seconds crash safe time)
    await redis.set("html_queue:processing", String(ticket), "EX", 90);
    console.log(`[Queue] Ticket ${ticket} created processing lease.`);

    let keepLeaseAlive = true;
    const leaseInterval = setInterval(async () => {
      if (!keepLeaseAlive) return;
      try {
        const ttl = await redis.ttl("html_queue:processing");
        if (ttl > 0 && ttl <= 10) {
          await redis.expire("html_queue:processing", ttl + 30);
          console.log(`[Queue] Ticket ${ticket} extended processing lease. New TTL: ${ttl + 30}`);
        }
      } catch (err) {
        console.error(`[Queue] Ticket ${ticket} failed to extend lease:`, err);
      }
    }, 5000);

    // 4. Call Gemini
    const service = new SceneHtmlGenerationService();
    console.log(`[Queue] Ticket ${ticket} invoking Gemini html generation...`);
    let html: string;
    let soundEvents: unknown[] = [];
    try {
      const result = await service.generateSceneHtml({
        narration,
        isShort: body.isShort === true,
        sceneId: typeof body.sceneId === "string" ? body.sceneId : undefined,
        duration: typeof body.duration === "number" ? body.duration : undefined,
      });
      html = result.html;
      soundEvents = result.soundEvents;
    } finally {
      keepLeaseAlive = false;
      clearInterval(leaseInterval);
    }
    console.log(`[Queue] Ticket ${ticket} Gemini html generation completed.`);

    const finalTtl = await redis.ttl("html_queue:processing");
    if (finalTtl > 0 && finalTtl < 30) {
      await redis.expire("html_queue:processing", 30);
      console.log(`[Queue] Ticket ${ticket} ensured final lease is at least 30 seconds.`);
    }

    // Return HTML, sound events and ticket immediately (let worker handle cooldown/advancement)
    return NextResponse.json({ html, soundEvents, ticket });
  } catch (error) {
    console.error("Scene HTML generation error:", error);

    // Defensive cleanup on failure inside route
    if (ticket !== undefined) {
      try {
        console.log(`[Queue] Failure occurred for ticket ${ticket}. Releasing queue turn...`);
        const currentTurnStr = await redis.get("html_queue:turn");
        const currentTurn = currentTurnStr ? parseInt(currentTurnStr, 10) : 1;

        // Only advance turn if we were the current turn
        if (currentTurn === ticket) {
          await redis.multi()
            .incr("html_queue:turn")
            .del("html_queue:processing")
            .exec();
          console.log(`[Queue] Successfully advanced turn from ticket ${ticket} and deleted processing key.`);
        }
      } catch (redisError) {
        console.error(`[Queue] Error during cleanup for ticket ${ticket}:`, redisError);
      }
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate scene HTML" },
      { status: 500 }
    );
  }
}
