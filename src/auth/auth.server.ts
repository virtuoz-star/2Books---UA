import { env } from "cloudflare:workers";
import { betterAuth } from "better-auth";
import { getOAuthState } from "better-auth/api";
import { admin } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { expo } from "@better-auth/expo";
import { getRequest } from "@tanstack/react-start/server";

import { isListedAdmin } from "#/auth/admins";

function createAuth(input: {
  baseURL: string;
  secret: string;
  clientId: string;
  clientSecret: string;
  origins: string[];
}) {
  return betterAuth({
    database: env.DB,
    secret: input.secret,
    baseURL: input.baseURL,
    trustedOrigins: input.origins,
    emailAndPassword: { enabled: false },
    socialProviders:
      input.clientId.length > 0 && input.clientSecret.length > 0
        ? {
            google: {
              clientId: input.clientId,
              clientSecret: input.clientSecret,
              prompt: "select_account",
            },
          }
        : undefined,
    user: {
      additionalFields: {
        nativeLanguage: {
          type: "string",
          required: false,
          defaultValue: "uk",
          input: true,
        },
      },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            const fields = user as { email?: string; nativeLanguage?: unknown; role?: string };
            const email = typeof fields.email === "string" ? fields.email : "";
            const state = await getOAuthState();
            const fromState =
              state !== null && typeof state === "object" ? state.nativeLanguage : undefined;
            const nativeLanguage =
              fromState === "uk" || fromState === "ru"
                ? fromState
                : fields.nativeLanguage === "ru"
                  ? "ru"
                  : "uk";
            const role = isListedAdmin(email, env.ADMIN_EMAILS) ? "admin" : fields.role;
            return { data: { ...user, nativeLanguage, role } };
          },
        },
      },
    },
    plugins: [expo(), admin(), tanstackStartCookies()],
  });
}

let cached: { key: string; auth: ReturnType<typeof createAuth> } | null = null;

function configuredBaseURL(request?: Request): string {
  const configured = env.BETTER_AUTH_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  if (request) return new URL(request.url).origin;
  try {
    return new URL(getRequest().url).origin;
  } catch {
    return "http://localhost:3001";
  }
}

export function googleAuthConfigured(): boolean {
  const secret = env.BETTER_AUTH_SECRET?.trim() ?? "";
  const clientId = env.GOOGLE_CLIENT_ID?.trim() ?? "";
  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim() ?? "";
  return secret.length >= 16 && clientId.length > 0 && clientSecret.length > 0;
}

export function getAuth(request?: Request) {
  const secret = env.BETTER_AUTH_SECRET?.trim() ?? "";
  if (secret.length < 16) throw new Error("unavailable");
  const baseURL = configuredBaseURL(request);
  const clientId = env.GOOGLE_CLIENT_ID?.trim() ?? "";
  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim() ?? "";
  const key = `${baseURL}\n${secret}\n${clientId}\n${clientSecret}`;
  if (cached?.key === key) return cached.auth;

  const origins = new Set<string>([baseURL, "twobooks://", "twobooks://*"]);
  if (request) origins.add(new URL(request.url).origin);
  const hostname = new URL(baseURL).hostname;
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    origins.add("exp://");
    origins.add("exp://**");
    origins.add("exp://192.168.*.*:*/**");
    origins.add("exp://10.*.*.*:*/**");
    origins.add("exp://172.*.*.*:*/**");
  }

  const auth = createAuth({
    baseURL,
    secret,
    clientId,
    clientSecret,
    origins: [...origins],
  });
  cached = { key, auth };
  return auth;
}
