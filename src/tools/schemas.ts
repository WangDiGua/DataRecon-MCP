import { z } from "zod";

/** MySQL identifier (unquoted): letters, digits, underscore; max 64. */
export const mysqlIdentifierSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-zA-Z0-9_]+$/);
