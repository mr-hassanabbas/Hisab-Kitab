import { describe, it, expect, beforeEach, vi } from "vitest";
import { RateLimiter, AIRateLimiter, ToolRateLimiter } from "./rate-limiter";

describe("RateLimiter", () => {
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    rateLimiter = new RateLimiter(60000, 5); // 5 requests per minute
  });

  describe("isAllowed", () => {
    it("should allow first request", () => {
      const result = rateLimiter.isAllowed("user1");
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
    });

    it("should allow requests within limit", () => {
      for (let i = 0; i < 5; i++) {
        const result = rateLimiter.isAllowed("user1");
        expect(result.allowed).toBe(true);
      }
    });

    it("should deny request when limit exceeded", () => {
      for (let i = 0; i < 5; i++) {
        rateLimiter.isAllowed("user1");
      }
      const result = rateLimiter.isAllowed("user1");
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it("should handle different users independently", () => {
      for (let i = 0; i < 5; i++) {
        rateLimiter.isAllowed("user1");
      }
      const result = rateLimiter.isAllowed("user2");
      expect(result.allowed).toBe(true);
    });

    it("should reset after time window", () => {
      vi.useFakeTimers();
      
      for (let i = 0; i < 5; i++) {
        rateLimiter.isAllowed("user1");
      }
      
      vi.advanceTimersByTime(61000); // Advance past the window
      
      const result = rateLimiter.isAllowed("user1");
      expect(result.allowed).toBe(true);
      
      vi.useRealTimers();
    });
  });

  describe("clear", () => {
    it("should clear rate limit for identifier", () => {
      for (let i = 0; i < 5; i++) {
        rateLimiter.isAllowed("user1");
      }
      
      rateLimiter.clear("user1");
      
      const result = rateLimiter.isAllowed("user1");
      expect(result.allowed).toBe(true);
    });
  });

  describe("getUsage", () => {
    it("should return current usage", () => {
      rateLimiter.isAllowed("user1");
      rateLimiter.isAllowed("user1");
      
      const usage = rateLimiter.getUsage("user1");
      expect(usage.count).toBe(2);
      expect(usage.remaining).toBe(3);
    });

    it("should return zero usage for new identifier", () => {
      const usage = rateLimiter.getUsage("newuser");
      expect(usage.count).toBe(0);
      expect(usage.remaining).toBe(5);
    });
  });

  describe("resetAll", () => {
    it("should reset all rate limits", () => {
      rateLimiter.isAllowed("user1");
      rateLimiter.isAllowed("user2");
      
      rateLimiter.resetAll();
      
      expect(rateLimiter.getUsage("user1").count).toBe(0);
      expect(rateLimiter.getUsage("user2").count).toBe(0);
    });
  });
});

describe("AIRateLimiter", () => {
  it("should have correct default limits", () => {
    const limiter = new AIRateLimiter();
    const result = limiter.isAllowed("user1");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9); // 10 - 1
  });
});

describe("ToolRateLimiter", () => {
  it("should have correct default limits", () => {
    const limiter = new ToolRateLimiter();
    const result = limiter.isAllowed("user1");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(29); // 30 - 1
  });
});