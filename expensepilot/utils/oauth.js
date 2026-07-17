const TOKEN_KEY = 'ep_oauth_token';
const TOKEN_EXPIRY_KEY = 'ep_oauth_token_expiry';

function isFirefox() {
  return typeof browser !== 'undefined' && browser.runtime && browser.runtime.getBrowserInfo;
}

export async function authenticate() {
  if (isFirefox()) {
    return authenticateFirefox();
  }
  return authenticateChrome();
}

async function authenticateChrome() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (!token) {
        reject(new Error('No token received'));
        return;
      }
      chrome.storage.local.set({
        [TOKEN_KEY]: token,
        [TOKEN_EXPIRY_KEY]: Date.now() + 3500 * 1000,
      });
      resolve(token);
    });
  });
}

async function authenticateFirefox() {
  const manifest = browser.runtime.getManifest();
  const clientId = manifest.oauth2 && manifest.oauth2.client_id;
  const scopes = manifest.oauth2 && manifest.oauth2.scopes;
  if (!clientId || !scopes) {
    throw new Error('OAuth2 client_id not configured in manifest.json');
  }
  const redirectUrl = browser.identity.getRedirectURL();
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('response_type', 'token');
  authUrl.searchParams.set('redirect_uri', redirectUrl);
  authUrl.searchParams.set('scope', scopes.join(' '));
  authUrl.searchParams.set('prompt', 'consent');

  const responseUrl = await browser.identity.launchWebAuthFlow({
    url: authUrl.toString(),
    interactive: true,
  });
  const url = new URL(responseUrl);
  const params = new URLSearchParams(url.hash.slice(1));
  const token = params.get('access_token');
  if (!token) throw new Error('No access token in OAuth response');
  
  const expiresIn = parseInt(params.get('expires_in') || '3600', 10);
  await browser.storage.local.set({
    [TOKEN_KEY]: token,
    [TOKEN_EXPIRY_KEY]: Date.now() + (expiresIn - 60) * 1000,
  });
  return token;
}

export async function getToken() {
  return new Promise((resolve) => {
    const storage = (typeof browser !== 'undefined' && browser.storage) ? browser.storage : chrome.storage;
    storage.local.get([TOKEN_KEY, TOKEN_EXPIRY_KEY], (result) => {
      const token = result[TOKEN_KEY];
      const expiry = result[TOKEN_EXPIRY_KEY];
      if (token && expiry && Date.now() < expiry) {
        resolve(token);
      } else {
        resolve(null);
      }
    });
  });
}

export async function revokeToken() {
  const token = await getToken();
  if (token) {
    try {
      await fetch(`https://accounts.google.com/o/oauth2/revoke?token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
    } catch { }
  }
  const storage = (typeof browser !== 'undefined' && browser.storage) ? browser.storage : chrome.storage;
  await new Promise(r => storage.local.remove([TOKEN_KEY, TOKEN_EXPIRY_KEY], r));
  if (!isFirefox() && chrome.identity && chrome.identity.removeCachedAuthToken && token) {
    chrome.identity.removeCachedAuthToken({ token }, () => {});
  }
}

export async function isTokenExpired() {
  return new Promise((resolve) => {
    const storage = (typeof browser !== 'undefined' && browser.storage) ? browser.storage : chrome.storage;
    storage.local.get([TOKEN_EXPIRY_KEY], (result) => {
      resolve(!result[TOKEN_EXPIRY_KEY] || Date.now() >= result[TOKEN_EXPIRY_KEY]);
    });
  });
}
