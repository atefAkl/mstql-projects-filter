import { DailyCollectionUseCase } from '../use-cases/DailyCollectionUseCase';

export class DailyScheduler {
  private timer: NodeJS.Timeout | null = null;
  private isStarted: boolean = false;

  constructor(private readonly dailyCollectionUseCase: DailyCollectionUseCase) {}

  public start(cronHour: number = 0, cronMinute: number = 0): void {
    if (this.isStarted) return;
    this.isStarted = true;

    console.log(`[DailyScheduler] Service initialized. Scheduled daily run set for ${cronHour.toString().padStart(2, '0')}:${cronMinute.toString().padStart(2, '0')}:01 UTC.`);
    
    // Check every minute if midnight (00:00) reached
    this.timer = setInterval(async () => {
      const now = new Date();
      if (now.getUTCHours() === cronHour && now.getUTCMinutes() === cronMinute && !DailyCollectionUseCase.isRunning()) {
        console.log('[DailyScheduler] Midnight trigger reached. Launching scheduled daily collection...');
        try {
          const res = await this.dailyCollectionUseCase.execute(false);
          console.log(`[DailyScheduler] Scheduled run completed successfully. Pages: ${res.run.pagesProcessed}, New Projects: ${res.newProjectsCount}`);
        } catch (err) {
          console.error('[DailyScheduler] Scheduled run error:', err);
        }
      }
    }, 60000);
  }

  public async triggerManual(): Promise<any> {
    console.log('[DailyScheduler] Manual trigger invoked by user.');
    return await this.dailyCollectionUseCase.execute(true);
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isStarted = false;
  }
}
