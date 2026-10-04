"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockCollectorAdapter = void 0;
class MockCollectorAdapter {
    pagesData = new Map();
    setPageData(pageNumber, items) {
        this.pagesData.set(pageNumber, items);
    }
    async fetchPage(pageNumber) {
        const items = this.pagesData.get(pageNumber) || [];
        const hasNextPage = this.pagesData.has(pageNumber + 1);
        return {
            pageNumber,
            items,
            hasNextPage,
            totalPageCount: this.pagesData.size,
        };
    }
}
exports.MockCollectorAdapter = MockCollectorAdapter;
//# sourceMappingURL=MockCollectorAdapter.js.map