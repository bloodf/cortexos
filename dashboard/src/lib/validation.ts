export const VALID_HEALTH_TYPES = new Set(["http", "tcp", "docker", "process"]);
export const SLUG_RE = /^[a-z0-9][a-z0-9._-]{0,62}$/;
export const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;
export const DATA_IMAGE_PREFIX = "data:image/";
export const MAX_ICON_IMAGE_LENGTH = 350 * 1024;
