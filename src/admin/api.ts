import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";

import type { AdminDashboard, AdminFailure } from "#/admin/dashboard.server";
import { prepareCatalogBook, type PreparedCatalogBook } from "#/library/catalog-draft";

export type {
  AdminCatalogBook,
  AdminDashboard,
  AdminFailure,
  AdminUpload,
  AdminUserRow,
} from "#/admin/dashboard.server";

function privateNoStore(): void {
  try {
    setResponseHeader("Cache-Control", "private, no-store");
    setResponseHeader("Vary", "Cookie");
  } catch {
    // A missing response context must not block the admin read.
  }
}

function assertId(value: unknown): string {
  if (typeof value !== "string" || value.length < 1 || value.length > 80) {
    throw new Error("invalid id");
  }
  return value;
}

function assertRole(value: unknown): "admin" | "user" {
  if (value !== "admin" && value !== "user") throw new Error("invalid role");
  return value;
}

function assertNativeLanguage(value: unknown): "uk" | "ru" {
  if (value !== "uk" && value !== "ru") throw new Error("invalid native language");
  return value;
}

export const loadAdminDashboard = createServerFn({ method: "GET" }).handler(
  async (): Promise<AdminDashboard | null> => {
    privateNoStore();
    try {
      const { loadDashboard } = await import("#/admin/dashboard.server");
      const result = await loadDashboard();
      if ("error" in result) return null;
      return result;
    } catch {
      return null;
    }
  },
);

export const setAdminUserRole = createServerFn({ method: "POST" })
  .validator((input: { userId: string; role: "admin" | "user" }) => {
    return { userId: assertId(input?.userId), role: assertRole(input?.role) };
  })
  .handler(async ({ data }): Promise<{ ok: true } | { ok: false; error: AdminFailure }> => {
    privateNoStore();
    try {
      const { setUserRole } = await import("#/admin/dashboard.server");
      return await setUserRole(data.userId, data.role);
    } catch {
      return { ok: false, error: "unavailable" };
    }
  });

export const setAdminUserLanguage = createServerFn({ method: "POST" })
  .validator((input: { userId: string; nativeLanguage: "uk" | "ru" }) => {
    return {
      userId: assertId(input?.userId),
      nativeLanguage: assertNativeLanguage(input?.nativeLanguage),
    };
  })
  .handler(async ({ data }): Promise<{ ok: true } | { ok: false; error: AdminFailure }> => {
    privateNoStore();
    try {
      const { setUserLanguage } = await import("#/admin/dashboard.server");
      return await setUserLanguage(data.userId, data.nativeLanguage);
    } catch {
      return { ok: false, error: "unavailable" };
    }
  });

export const setAdminUserBanned = createServerFn({ method: "POST" })
  .validator((input: { userId: string; banned: boolean }) => {
    if (typeof input?.banned !== "boolean") throw new Error("invalid ban");
    return { userId: assertId(input.userId), banned: input.banned };
  })
  .handler(async ({ data }): Promise<{ ok: true } | { ok: false; error: AdminFailure }> => {
    privateNoStore();
    try {
      const { setUserBanned } = await import("#/admin/dashboard.server");
      return await setUserBanned(data.userId, data.banned);
    } catch {
      return { ok: false, error: "unavailable" };
    }
  });

export const deleteAdminUser = createServerFn({ method: "POST" })
  .validator((input: { userId: string }) => {
    return { userId: assertId(input?.userId) };
  })
  .handler(async ({ data }): Promise<{ ok: true } | { ok: false; error: AdminFailure }> => {
    privateNoStore();
    try {
      const { deleteUser } = await import("#/admin/dashboard.server");
      return await deleteUser(data.userId);
    } catch {
      return { ok: false, error: "unavailable" };
    }
  });

export const createAdminCatalogBook = createServerFn({ method: "POST" })
  .validator((input: PreparedCatalogBook) => {
    const prepared = prepareCatalogBook(input);
    if (!prepared.ok) throw new Error("invalid catalog");
    return prepared.book;
  })
  .handler(async ({ data }): Promise<{ ok: true } | { ok: false; error: AdminFailure }> => {
    privateNoStore();
    try {
      const { createCatalogBook } = await import("#/admin/dashboard.server");
      return await createCatalogBook(data);
    } catch {
      return { ok: false, error: "unavailable" };
    }
  });

export const importAdminCatalogFile = createServerFn({ method: "POST" })
  .validator((input: { fileBase64: string }) => {
    if (typeof input?.fileBase64 !== "string") throw new Error("invalid catalog");
    if (input.fileBase64.length < 1 || input.fileBase64.length > 34_000_000) {
      throw new Error("invalid catalog");
    }
    return { fileBase64: input.fileBase64 };
  })
  .handler(async ({ data }): Promise<{ ok: true } | { ok: false; error: AdminFailure }> => {
    privateNoStore();
    try {
      const { importCatalogFile } = await import("#/admin/dashboard.server");
      return await importCatalogFile(data.fileBase64);
    } catch {
      return { ok: false, error: "unavailable" };
    }
  });

export const deleteAdminCatalogBook = createServerFn({ method: "POST" })
  .validator((input: { bookId: string }) => {
    return { bookId: assertId(input?.bookId) };
  })
  .handler(async ({ data }): Promise<{ ok: true } | { ok: false; error: AdminFailure }> => {
    privateNoStore();
    try {
      const { deleteCatalogBook } = await import("#/admin/dashboard.server");
      return await deleteCatalogBook(data.bookId);
    } catch {
      return { ok: false, error: "unavailable" };
    }
  });

export const deleteAdminBook = createServerFn({ method: "POST" })
  .validator((input: { bookId: string }) => {
    return { bookId: assertId(input?.bookId) };
  })
  .handler(async ({ data }): Promise<{ ok: true } | { ok: false; error: AdminFailure }> => {
    privateNoStore();
    try {
      const { deleteUpload } = await import("#/admin/dashboard.server");
      return await deleteUpload(data.bookId);
    } catch {
      return { ok: false, error: "unavailable" };
    }
  });
