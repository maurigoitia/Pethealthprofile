"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// @vitest-environment node
const vitest_1 = require("vitest");
const sessionQueue_1 = require("../sessionQueue");
(0, vitest_1.describe)("gmail session query builder", () => {
    (0, vitest_1.it)("preserva el anclaje a la mascota y excluye mails de Pessy", () => {
        const query = (0, sessionQueue_1.buildGmailSearchQuery)({
            afterDate: new Date("2023-03-30T00:00:00.000Z"),
            beforeDate: new Date("2026-03-30T00:00:00.000Z"),
            petName: "Thor",
            petId: "iVoXhESOZ8FvuiWT43Ey",
        });
        (0, vitest_1.expect)(query).toContain("\"Thor\"");
        (0, vitest_1.expect)(query).toContain("subject:eco");
        (0, vitest_1.expect)(query).toContain("filename:hemograma");
        (0, vitest_1.expect)(query).toContain("-from:noreply@pessy.app");
        (0, vitest_1.expect)(query).toContain("after:2023/03/30");
        (0, vitest_1.expect)(query).toContain("before:2026/03/30");
    });
});
//# sourceMappingURL=sessionQueue.test.js.map