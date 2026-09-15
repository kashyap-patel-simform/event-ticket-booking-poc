import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../../src/app.js";

describe("GET /api/health", () => {
  it("responds with ok status", async () => {
    const res = await request(app).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("generates a request id and echoes it in the response header", async () => {
    const res = await request(app).get("/api/health");

    expect(res.headers["x-request-id"]).toBeTruthy();
  });

  it("reuses a caller-supplied x-request-id for correlation", async () => {
    const res = await request(app).get("/api/health").set("x-request-id", "test-correlation-id");

    expect(res.headers["x-request-id"]).toBe("test-correlation-id");
  });
});
