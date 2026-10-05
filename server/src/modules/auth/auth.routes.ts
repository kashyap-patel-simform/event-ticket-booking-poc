import { Router } from "express";
import { validate } from "../../shared/middleware/validate.js";
import { loginHandler, logoutHandler, refreshHandler, registerHandler } from "./auth.controller.js";
import { loginSchema, logoutSchema, refreshSchema, registerSchema } from "./auth.types.js";

export const authRouter = Router();

authRouter.post("/register", validate(registerSchema), registerHandler);
authRouter.post("/login", validate(loginSchema), loginHandler);
authRouter.post("/refresh", validate(refreshSchema), refreshHandler);
authRouter.post("/logout", validate(logoutSchema), logoutHandler);
