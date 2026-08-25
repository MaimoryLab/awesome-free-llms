export function hasAdminCredentials(authorization: string | null) {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password || !authorization?.startsWith("Basic ")) return false;
  try {
    const bytes = Uint8Array.from(atob(authorization.slice(6)), (character) => character.charCodeAt(0));
    const decoded = new TextDecoder().decode(bytes);
    const separator = decoded.indexOf(":");
    return separator >= 0 && decoded.slice(0, separator) === username && decoded.slice(separator + 1) === password;
  } catch {
    return false;
  }
}

export function adminUnauthorizedResponse() {
  return new Response("需要后台账号和密码", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Free LLM Hub Admin", charset="UTF-8"' },
  });
}
