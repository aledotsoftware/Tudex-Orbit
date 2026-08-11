import React, { createContext, useContext, useEffect, useState } from 'react';

export const OIDC_CONFIG = {
  clientId: 'beef5e21-8af3-49f7-8964-be108c41b986',
  authorizeUrl: 'https://passport.tudexnetworks.com/authorize',
  tokenUrl: 'https://passport.tudexnetworks.com/api/oidc/token',
  userinfoUrl: 'https://passport.tudexnetworks.com/api/oidc/userinfo',
  endSessionUrl: 'https://passport.tudexnetworks.com/api/oidc/end-session',
  scope: 'openid profile email',
};

export interface OidcUser {
  sub?: string;
  id?: string;
  name?: string;
  username?: string;
  preferred_username?: string;
  email?: string;
  picture?: string;
  avatar?: string;
  [key: string]: any;
}

interface AuthContextType {
  user: OidcUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper function to generate cryptographically secure random string
function generateRandomString(length: number): string {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const values = window.crypto.getRandomValues(new Uint8Array(length));
  return Array.from(values).map(x => possible[x % possible.length]).join('');
}

// Helper to compute SHA-256 base64url challenge for PKCE
async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await window.crypto.subtle.digest('SHA-256', data);
  const binary = String.fromCharCode(...new Uint8Array(digest));
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<OidcUser | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('tudex_orbit_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const redirectUri = window.location.origin + window.location.pathname;

  const fetchUserInfo = async (accessToken: string) => {
    try {
      const res = await fetch(OIDC_CONFIG.userinfoUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (res.ok) {
        const userData = await res.json();
        setUser(userData);
        setToken(accessToken);
        localStorage.setItem('tudex_orbit_token', accessToken);
        return true;
      } else {
        // Invalid or expired token
        localStorage.removeItem('tudex_orbit_token');
        setToken(null);
        setUser(null);
        return false;
      }
    } catch (err: any) {
      console.error('Error fetching user info:', err);
      setError('Error al consultar perfil de usuario.');
      return false;
    }
  };

  const login = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const verifier = generateRandomString(64);
      const state = generateRandomString(32);
      const challenge = await generateCodeChallenge(verifier);

      sessionStorage.setItem('oidc_code_verifier', verifier);
      sessionStorage.setItem('oidc_state', state);

      const params = new URLSearchParams({
        response_type: 'code',
        client_id: OIDC_CONFIG.clientId,
        redirect_uri: redirectUri,
        scope: OIDC_CONFIG.scope,
        code_challenge: challenge,
        code_challenge_method: 'S256',
        state: state,
      });

      window.location.href = `${OIDC_CONFIG.authorizeUrl}?${params.toString()}`;
    } catch (err: any) {
      console.error('Failed to initiate login flow:', err);
      setError('Error iniciando sesión en Tudex Passport.');
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('tudex_orbit_token');
    sessionStorage.removeItem('oidc_code_verifier');
    sessionStorage.removeItem('oidc_state');
    setToken(null);
    setUser(null);

    const logoutUrl = `${OIDC_CONFIG.endSessionUrl}?post_logout_redirect_uri=${encodeURIComponent(redirectUri)}`;
    window.location.href = logoutUrl;
  };

  useEffect(() => {
    const initAuth = async () => {
      const searchParams = new URLSearchParams(window.location.search);
      const code = searchParams.get('code');
      const state = searchParams.get('state');

      if (code) {
        const savedVerifier = sessionStorage.getItem('oidc_code_verifier');
        const savedState = sessionStorage.getItem('oidc_state');

        // Clean URL search parameters immediately for clean state
        window.history.replaceState({}, document.title, window.location.pathname);

        if (savedVerifier && state === savedState) {
          sessionStorage.removeItem('oidc_code_verifier');
          sessionStorage.removeItem('oidc_state');

          try {
            const tokenRes = await fetch(OIDC_CONFIG.tokenUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: new URLSearchParams({
                grant_type: 'authorization_code',
                client_id: OIDC_CONFIG.clientId,
                code: code,
                redirect_uri: redirectUri,
                code_verifier: savedVerifier,
              }),
            });

            if (tokenRes.ok) {
              const tokenData = await tokenRes.json();
              if (tokenData.access_token) {
                await fetchUserInfo(tokenData.access_token);
              } else {
                setError('No se recibió token de acceso de Tudex Passport.');
              }
            } else {
              const errBody = await tokenRes.text();
              console.error('Token error response:', errBody);
              setError('Fallo al canjear el código de autorización.');
            }
          } catch (err: any) {
            console.error('Error exchanging authorization code:', err);
            setError('Error de comunicación con Tudex Passport.');
          }
        } else {
          setError('Estado de autenticación inválido o expirado.');
        }
      } else if (token) {
        // Validate existing token
        await fetchUserInfo(token);
      }

      setIsLoading(false);
    };

    initAuth();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user && !!token,
        isLoading,
        error,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
