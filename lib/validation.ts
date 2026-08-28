import { z } from "zod"

/**
 * A lenient UUID check for Postgres-generated ids. Zod's built-in `.uuid()`
 * enforces RFC 4122 version/variant nibbles, which rejects ids that are
 * perfectly valid to Postgres's `uuid` column type but don't happen to carry
 * those bits (e.g. hand-crafted stable ids used by seed data). Match the
 * general 8-4-4-4-12 hex shape instead and let the database be the final
 * authority on real foreign-key validity.
 */
export function uuidField(message = "Invalid id.") {
  return z
    .string()
    .regex(
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
      message
    )
}
