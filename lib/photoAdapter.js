export function resolveVoterPhoto(url) {
  if (!url) return "/images/voter-placeholder.png";
  if (String(url).startsWith("placeholder://")) {
    return "/images/voter-placeholder.png";
  }
  return String(url);
}
