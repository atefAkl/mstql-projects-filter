"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DailyScheduler = void 0;
const DailyCollectionUseCase_1 = require("../use-cases/DailyCollectionUseCase");
class DailyScheduler {
    dailyCollectionUseCase;
    timer = null;
    isStarted = false;
    constructor(dailyCollectionUseCase) {
        this.dailyCollectionUseCase = dailyCollectionUseCase;
    }
    start(cronHour = 0, cronMinute = 0) {
        if (this.isStarted)
            return;
        this.isStarted = true;
        console.log(`[DailyScheduler] Service initialized. Scheduled daily run set for ${cronHour.toString().padStart(2, '0')}:${cronMinute.toString().padStart(2, '0')}:01 UTC.`);
        // Check every minute if midnight (00:00) reached
        this.timer = setInterval(async () => {
            const now = new Date();
            if (now.getUTCHours() === cronHour && now.getUTCMinutes() === cronMinute && !DailyCollectionUseCase_1.DailyCollectionUseCase.isRunning()) {
                console.log('[DailyScheduler] Midnight trigger reached. Launching scheduled daily collection...');
                try {
                    const res = await this.dailyCollectionUseCase.execute(false);
                    console.log(`[DailyScheduler] Scheduled run completed successfully. Pages: ${res.run.pagesProcessed}, New Projects: ${res.newProjectsCount}`);
                }
                catch (err) {
                    console.error('[DailyScheduler] Scheduled run error:', err);
                }
            }
        }, 60000);
    }
    async triggerManual() {
        console.log('[DailyScheduler] Manual trigger invoked by user.');
        return await this.dailyCollectionUseCase.execute(true);
    }
    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        this.isStarted = false;
    }
}
exports.DailyScheduler = DailyScheduler;
//# sourceMappingURL=DailyScheduler.js.map