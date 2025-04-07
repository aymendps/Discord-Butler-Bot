export function sanitizePlaylistID(str: string) {
  return str
    .toLowerCase()
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");
}
