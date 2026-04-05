// @vitest-environment node
import { describe, expect, it } from "vitest";

import { buildGmailSearchQuery } from "../sessionQueue";

describe("gmail session query builder", () => {
  it("preserva el anclaje a la mascota y excluye mails de Pessy", () => {
    const query = buildGmailSearchQuery({
      afterDate: new Date("2023-03-30T00:00:00.000Z"),
      beforeDate: new Date("2026-03-30T00:00:00.000Z"),
      petName: "Thor",
      petId: "iVoXhESOZ8FvuiWT43Ey",
    });

    expect(query).toContain("\"Thor\"");
    expect(query).toContain("subject:eco");
    expect(query).toContain("filename:hemograma");
    expect(query).toContain("-from:noreply@pessy.app");
    expect(query).toContain("after:2023/03/30");
    expect(query).toContain("before:2026/03/30");
  });
});
