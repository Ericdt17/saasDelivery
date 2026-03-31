"use strict";

jest.mock("../../utils/jwt", () => ({
  verifyToken: jest.fn(),
  extractTokenFromHeader: jest.fn(),
  extractTokenFromCookie: jest.fn(),
}));

const jwtUtils = require("../../utils/jwt");
const {
  authenticateToken,
  authorizeRole,
} = require("../../api/middleware/auth");

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe("authenticateToken", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when no token in cookie or header", () => {
    jwtUtils.extractTokenFromCookie.mockReturnValue(null);
    jwtUtils.extractTokenFromHeader.mockReturnValue(null);

    const req = { cookies: {}, headers: {}, path: "/foo", originalUrl: "/foo" };
    const res = mockRes();
    const next = jest.fn();

    authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("sets req.user and calls next when token is valid", () => {
    jwtUtils.extractTokenFromCookie.mockReturnValue("valid.jwt");
    jwtUtils.verifyToken.mockReturnValue({
      userId: 7,
      agencyId: 2,
      email: "a@b.com",
      role: "agency",
    });

    const req = { cookies: { auth_token: "valid.jwt" }, path: "/x" };
    const res = mockRes();
    const next = jest.fn();

    authenticateToken(req, res, next);

    expect(req.user).toEqual({
      userId: 7,
      agencyId: 2,
      email: "a@b.com",
      role: "agency",
      groupId: null,
    });
    expect(next).toHaveBeenCalled();
  });

  it("allows logout path with invalid token (req.user null, next)", () => {
    jwtUtils.extractTokenFromCookie.mockReturnValue("bad");
    jwtUtils.verifyToken.mockImplementation(() => {
      throw new Error("Invalid token");
    });

    const req = {
      cookies: { auth_token: "bad" },
      path: "/logout",
      originalUrl: "/api/v1/auth/logout",
    };
    const res = mockRes();
    const next = jest.fn();

    authenticateToken(req, res, next);

    expect(req.user).toBeNull();
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("returns 401 when token verification fails on non-logout routes", () => {
    jwtUtils.extractTokenFromCookie.mockReturnValue("bad");
    jwtUtils.verifyToken.mockImplementation(() => {
      throw new Error("Invalid token");
    });

    const req = { cookies: { auth_token: "bad" }, path: "/deliveries" };
    const res = mockRes();
    const next = jest.fn();

    authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

describe("authorizeRole", () => {
  it("returns 401 when req.user is missing", () => {
    const mw = authorizeRole(["super_admin"]);
    const req = {};
    const res = mockRes();
    const next = jest.fn();

    mw(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 403 when role is not allowed", () => {
    const mw = authorizeRole(["super_admin"]);
    const req = { user: { role: "agency" } };
    const res = mockRes();
    const next = jest.fn();

    mw(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next when role is allowed", () => {
    const mw = authorizeRole(["agency", "super_admin"]);
    const req = { user: { role: "agency" } };
    const res = mockRes();
    const next = jest.fn();

    mw(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});
