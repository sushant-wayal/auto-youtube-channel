import { SeriesManager } from "./shared/services/series-manager";

async function runTest() {
    console.log("Testing SeriesManager autoInitiateSeriesIfNeeded...");
    const sm = new SeriesManager();
    try {
        await sm.autoInitiateSeriesIfNeeded();
        console.log("Success!");
    } catch (e) {
        console.error("Failed:", e);
    } finally {
        // sm.close() is not exposed, but we can exit
        process.exit(0);
    }
}

runTest();
