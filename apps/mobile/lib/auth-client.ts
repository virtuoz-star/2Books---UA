import { expoClient } from "@better-auth/expo/client";
import { createAuthClient } from "better-auth/react";
import * as SecureStore from "expo-secure-store";

import { apiBase } from "@/lib/api";

export const authClient = createAuthClient({
  baseURL: apiBase(),
  plugins: [
    expoClient({
      scheme: "twobooks",
      storagePrefix: "2books",
      storage: SecureStore,
    }),
  ],
});
