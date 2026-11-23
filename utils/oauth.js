export async function authenticate() {
  const token = await getToken(true);
  if (!token) throw new Error("Chrome did not return a Gmail access token.");
  return token;
}

export async function getToken(interactive = false) {
  const clientId = chrome.runtime.getManifest().oauth2?.client_id;
  if (!clientId || clientId.startsWith("YOUR_")) {
    throw new Error(`Gmail setup required. Configure an OAuth client for extension ID ${chrome.runtime.id} in manifest.json.`);
  }
  try {
    const { token } = await chrome.identity.getAuthToken({ interactive });
    return token || null;
  } catch (error) {
    if (!interactive && /not signed in|interaction required|not granted|no token/i.test(error.message)) return null;
    if (interactive) {
      throw new Error(`${error.message} Check the OAuth client for extension ID ${chrome.runtime.id}.`);
    }
    throw error;
  }
}

export async function removeCachedToken(token) {
  if (token) await chrome.identity.removeCachedAuthToken({ token });
}

export async function clearGmailAuthorization() {
  await chrome.identity.clearAllCachedAuthTokens();
}
