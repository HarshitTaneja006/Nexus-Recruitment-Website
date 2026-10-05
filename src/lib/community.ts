/**
 * NEXUS community invite - post-acceptance WhatsApp community.
 *
 * Single non-nullable env var (no default, no fallback):
 *   NEXUS_WHATSAPP_COMMUNITY_LINK="https://chat.whatsapp.com/…"
 *
 * Every ACCEPTED status email must carry this link. The getter throws
 * when the variable is unset so a missing link fails loudly at queue
 * time instead of shipping an acceptance mail without the invite.
 */

export const NEXUS_COMMUNITY_ENV_KEY = "NEXUS_WHATSAPP_COMMUNITY_LINK";

/** Required community invite URL - throws when the env var is unset. */
export function getNexusCommunityLink(): string {
  const value = process.env[NEXUS_COMMUNITY_ENV_KEY]?.trim();
  if (!value) {
    throw new Error(
      `${NEXUS_COMMUNITY_ENV_KEY} is not configured - set it to the Nexus WhatsApp Community invite URL`
    );
  }
  return value;
}
