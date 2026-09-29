import { describe, expect, it } from "vitest";

import {
  isRecoveryFor,
  RESET_DONE_COOKIE,
  resetDoneCookieOptions,
  passwordUpdateError,
  RECOVERY_COOKIE,
  recoveryCookieOptions,
  resetLinkProblem,
} from "@/lib/auth/recovery";

describe("recoveryCookieOptions", () => {
  it("is httpOnly, short-lived and scoped to the reset page", () => {
    const options = recoveryCookieOptions();
    expect(options.httpOnly).toBe(true);
    expect(options.path).toBe("/reset-password");
    expect(options.maxAge).toBeLessThanOrEqual(15 * 60);
    expect(RECOVERY_COOKIE).toBe("bf_pw_recovery");
  });
});

describe("resetDoneCookieOptions", () => {
  it("is a brief httpOnly flash scoped to the reset page", () => {
    const options = resetDoneCookieOptions();
    expect(RESET_DONE_COOKIE).not.toBe(RECOVERY_COOKIE);
    expect(options.httpOnly).toBe(true);
    expect(options.path).toBe("/reset-password");
    expect(options.maxAge).toBeLessThanOrEqual(120);
  });
});

describe("isRecoveryFor", () => {
  it("accepts only the signed-in user's own marker", () => {
    expect(isRecoveryFor("user-1", "user-1")).toBe(true);
    expect(isRecoveryFor("user-2", "user-1")).toBe(false);
    expect(isRecoveryFor(undefined, "user-1")).toBe(false);
    expect(isRecoveryFor("", "user-1")).toBe(false);
  });
});

describe("resetLinkProblem", () => {
  it("reports nothing for a clean URL", () => {
    expect(resetLinkProblem(new URLSearchParams(""))).toBeNull();
  });

  it("recognises Supabase's expired-link redirect", () => {
    expect(
      resetLinkProblem(
        new URLSearchParams("error=access_denied&error_code=otp_expired&error_description=x"),
      ),
    ).toBe("expired");
  });

  it("works on a #fragment parsed as params", () => {
    expect(resetLinkProblem(new URLSearchParams("#error_code=otp_expired".slice(1)))).toBe(
      "expired",
    );
  });

  it("treats our own failure marker and other errors as invalid", () => {
    expect(resetLinkProblem(new URLSearchParams("error=invalid_link"))).toBe("invalid");
    expect(resetLinkProblem(new URLSearchParams("error=server_error"))).toBe("invalid");
  });
});

describe("passwordUpdateError", () => {
  it("explains a reused password", () => {
    expect(passwordUpdateError({ code: "same_password" })).toMatch(/different/);
  });

  it("explains an expired session", () => {
    expect(passwordUpdateError({ code: "session_not_found" })).toMatch(/expired/);
  });

  it("never echoes unknown internals", () => {
    const message = passwordUpdateError({ code: "unexpected_failure" });
    expect(message).not.toMatch(/unexpected_failure/);
    expect(passwordUpdateError(undefined)).toBe(message);
  });
});
