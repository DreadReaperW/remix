import { mock } from "./mock.js";
export function createTestContext(options) {
    let cleanups = [];
    let testContext = {
        mock: mock.fn,
        spyOn(obj, method, impl) {
            let mockFn = mock.spyOn(obj, method, impl);
            if (mockFn.mock.restore)
                cleanups.push(mockFn.mock.restore);
            return mockFn;
        },
        after(fn) {
            cleanups.push(fn);
        },
        async serve(handler) {
            if (!options.createServer || !options.browser) {
                throw new Error('t.serve() is only available in E2E test suites');
            }
            let server = await options.createServer(handler);
            let page = await options.browser.newPage({
                ...options.playwrightPageOptions,
                baseURL: server.baseUrl,
            });
            if (options.playwrightPageOptions?.navigationTimeout != null) {
                page.setDefaultNavigationTimeout(options.playwrightPageOptions.navigationTimeout);
            }
            if (options.playwrightPageOptions?.actionTimeout != null) {
                page.setDefaultTimeout(options.playwrightPageOptions.actionTimeout);
            }
            cleanups.push(async () => {
                if (!options.open) {
                    await page.close();
                }
                await server.close();
            });
            return page;
        },
    };
    return {
        testContext,
        async cleanup() {
            for (let fn of cleanups)
                await fn();
            cleanups.length = 0;
        },
    };
}
