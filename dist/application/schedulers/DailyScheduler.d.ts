import { DailyCollectionUseCase } from '../use-cases/DailyCollectionUseCase';
export declare class DailyScheduler {
    private readonly dailyCollectionUseCase;
    private timer;
    private isStarted;
    constructor(dailyCollectionUseCase: DailyCollectionUseCase);
    start(cronHour?: number, cronMinute?: number): void;
    triggerManual(): Promise<any>;
    stop(): void;
}
