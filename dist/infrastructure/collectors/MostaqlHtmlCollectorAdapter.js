"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MostaqlHtmlCollectorAdapter = void 0;
const config_1 = require("../../shared/config");
const errors_1 = require("../../shared/errors");
const MostaqlParser_1 = require("./MostaqlParser");
class MostaqlHtmlCollectorAdapter {
    baseUrl;
    userAgent;
    sessionCookie;
    minDelayMs;
    maxDelayMs;
    constructor(config = {}) {
        this.baseUrl = config.baseUrl || 'https://mostaql.com';
        this.userAgent = config.userAgent || config_1.defaultConfig.userAgent;
        this.sessionCookie = config.sessionCookie || config_1.defaultConfig.mostaqlSessionCookie;
        this.minDelayMs = config.minDelayMs ?? config_1.defaultConfig.minDelayMs;
        this.maxDelayMs = config.maxDelayMs ?? config_1.defaultConfig.maxDelayMs;
    }
    async fetchPage(pageNumber) {
        await this.applyDelay();
        const targetUrl = `${this.baseUrl}/projects?page=${pageNumber}`;
        const headers = {
            'User-Agent': this.userAgent,
            'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        };
        if (this.sessionCookie) {
            headers['Cookie'] = this.sessionCookie;
        }
        try {
            const response = await fetch(targetUrl, { headers });
            if (!response.ok) {
                MostaqlParser_1.MostaqlParser.checkAuthenticationStatus('', response.status, response.url);
                throw new errors_1.MostaqlNetworkError(`Failed to fetch page ${pageNumber}. HTTP ${response.status}`, response.status);
            }
            const html = await response.text();
            MostaqlParser_1.MostaqlParser.checkAuthenticationStatus(html, response.status, response.url);
            const { items, hasNextPage } = MostaqlParser_1.MostaqlParser.parseListingPage(html);
            return {
                pageNumber,
                items,
                hasNextPage,
            };
        }
        catch (error) {
            if (error instanceof Error && error.name.startsWith('Mostaql')) {
                throw error;
            }
            throw new errors_1.MostaqlNetworkError(`Network error while fetching page ${pageNumber}: ${error.message}`);
        }
    }
    async fetchProjectDetail(item) {
        await this.applyDelay();
        const headers = {
            'User-Agent': this.userAgent,
            'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8',
        };
        if (this.sessionCookie) {
            headers['Cookie'] = this.sessionCookie;
        }
        try {
            const response = await fetch(item.sourceUrl, { headers });
            if (!response.ok) {
                MostaqlParser_1.MostaqlParser.checkAuthenticationStatus('', response.status, response.url);
                return item; // Fallback to item without detail
            }
            const detailHtml = await response.text();
            return MostaqlParser_1.MostaqlParser.enrichWithDetailPage(item, detailHtml);
        }
        catch {
            return item;
        }
    }
    async applyDelay() {
        if (this.maxDelayMs > 0) {
            const delay = Math.floor(Math.random() * (this.maxDelayMs - this.minDelayMs + 1)) + this.minDelayMs;
            await this.sleep(delay);
        }
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
exports.MostaqlHtmlCollectorAdapter = MostaqlHtmlCollectorAdapter;
//# sourceMappingURL=MostaqlHtmlCollectorAdapter.js.map