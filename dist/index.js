"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MostaqlMonitorPlatform = void 0;
const Database_1 = require("./infrastructure/database/Database");
const SqliteProjectRepository_1 = require("./infrastructure/repositories/SqliteProjectRepository");
const SqliteCollectionRunRepository_1 = require("./infrastructure/repositories/SqliteCollectionRunRepository");
class MostaqlMonitorPlatform {
    db;
    projectRepository;
    collectionRunRepository;
    constructor(dbPath) {
        this.db = new Database_1.AppDatabase(dbPath);
        const rawDb = this.db.getRawConnection();
        this.projectRepository = new SqliteProjectRepository_1.SqliteProjectRepository(rawDb);
        this.collectionRunRepository = new SqliteCollectionRunRepository_1.SqliteCollectionRunRepository(rawDb);
    }
    close() {
        this.db.close();
    }
}
exports.MostaqlMonitorPlatform = MostaqlMonitorPlatform;
if (require.main === module) {
    console.log('Mostaql Market Intelligence Platform Core Initialized.');
    const platform = new MostaqlMonitorPlatform();
    console.log('Database initialized successfully.');
    platform.close();
}
//# sourceMappingURL=index.js.map