import { createFileRoute, redirect, useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";

import { CatalogForm } from "#/admin/catalog-form";
import { CatalogImport } from "#/admin/catalog-import";
import { Button } from "#/components/ui/button";
import { EmptyState } from "#/components/ui/empty-state";
import { Field, Input, Select } from "#/components/ui/field";
import { Notice } from "#/components/ui/notice";
import { PageHeader } from "#/components/ui/page-header";
import { Toast, ToastProvider } from "#/components/ui/toast";
import {
  deleteAdminBook,
  deleteAdminCatalogBook,
  deleteAdminUser,
  loadAdminDashboard,
  setAdminUserBanned,
  setAdminUserLanguage,
  setAdminUserRole,
  type AdminDashboard,
  type AdminFailure,
  type AdminUpload,
  type AdminUserRow,
} from "#/admin/api";
import { resetSessionCache } from "#/auth/session";
import { documentTitle, languageName, message, pageOfTotal } from "#/i18n/messages";
import type { Locale, NativeLanguage } from "#/i18n/types";
import { useReaderSettings } from "#/reader/use-reader-settings";

function guardAdmin(context: { user: { role: string } | null }): void {
  if (!context.user) throw redirect({ to: "/sign-in" });
  if (context.user.role !== "admin") throw redirect({ to: "/" });
}

const adminRoute = createFileRoute("/admin")({
  staleTime: 0,
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === "string" ? search.q.slice(0, 80) : "",
  }),
  loaderDeps: ({ search }) => ({ q: search.q }),
  beforeLoad: ({ context }) => {
    guardAdmin(context);
  },
  loader: ({ deps }) =>
    loadAdminDashboard({ data: { userQuery: deps.q, userCursor: "", uploadCursor: "" } }),
  component: AdminPage,
});

export const Route = adminRoute.update({
  head: ({ match }) => ({
    meta: [
      {
        title: documentTitle(message(match.context.settings.interfaceLocale, "adminTitle")),
      },
    ],
  }),
});

const nativeLanguages = ["uk", "ru"] as const satisfies readonly NativeLanguage[];
const roles = ["user", "admin"] as const;

function formatWhen(value: string, locale: Locale): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(date);
}

function failureMessage(locale: Locale, error: AdminFailure | null): string | null {
  if (error === "last-admin") return message(locale, "lastAdmin");
  if (error === "listed") return message(locale, "listedAdmin");
  if (error === "invalid-input") return message(locale, "invalidCatalog");
  if (error === "reserved-id") return message(locale, "reservedId");
  if (error === "duplicate") return message(locale, "duplicateBook");
  if (error === null) return null;
  return message(locale, "actionFailed");
}

function StatusBadge({ children }: { children: string }) {
  return (
    <span className="inline-flex rounded-full border border-border px-2 py-0.5 text-xs text-foreground">
      {children}
    </span>
  );
}

function AdminPage() {
  const dashboard = Route.useLoaderData();
  const search = Route.useSearch();
  const { settings } = useReaderSettings();
  const locale = settings.interfaceLocale;

  return (
    <div className="flex w-full flex-col gap-10">
      <PageHeader title={message(locale, "adminTitle")} />
      {dashboard === null ? (
        <Notice tone="danger">{message(locale, "actionFailed")}</Notice>
      ) : (
        <AdminPanels dashboard={dashboard} locale={locale} query={search.q} />
      )}
    </div>
  );
}

function AdminPanels({
  dashboard,
  locale,
  query,
}: {
  dashboard: AdminDashboard;
  locale: Locale;
  query: string;
}) {
  const router = useRouter();
  const navigate = useNavigate();
  const [pending, setPending] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [roleChoice, setRoleChoice] = useState<{ id: string; role: "admin" | "user" } | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [draftQuery, setDraftQuery] = useState(query);
  const [adding, setAdding] = useState(false);
  const [moreUsers, setMoreUsers] = useState<AdminUserRow[]>([]);
  const [userNext, setUserNext] = useState(dashboard.userNext);
  const [moreUploads, setMoreUploads] = useState<AdminUpload[]>([]);
  const [uploadNext, setUploadNext] = useState(dashboard.uploadNext);
  const signature = `${query}\n${dashboard.users.map((user) => `${user.id}:${user.role}:${user.banned}`).join("\n")}\n${dashboard.uploads.map((book) => book.id).join("\n")}`;
  const [seen, setSeen] = useState(signature);
  if (seen !== signature) {
    setSeen(signature);
    setMoreUsers([]);
    setUserNext(dashboard.userNext);
    setMoreUploads([]);
    setUploadNext(dashboard.uploadNext);
    setDraftQuery(query);
  }

  const users = [...dashboard.users, ...moreUsers];
  const uploads = [...dashboard.uploads, ...moreUploads];

  function showError(key: string, error: AdminFailure) {
    const text = failureMessage(locale, error) ?? message(locale, "actionFailed");
    setRowErrors((current) => ({ ...current, [key]: text }));
    setToast(text);
  }

  async function run(
    key: string,
    action: () => Promise<{ ok: true } | { ok: false; error: AdminFailure }>,
  ) {
    if (pending !== null) return;
    setPending(key);
    setRowErrors((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
    try {
      const result = await action();
      if (!result.ok) {
        showError(key, result.error);
        return;
      }
      setConfirm(null);
      setRoleChoice(null);
      resetSessionCache();
      await router.invalidate();
    } catch {
      showError(key, "unavailable");
    } finally {
      setPending(null);
    }
  }

  async function moreUsersPage() {
    if (pending !== null || userNext === null) return;
    setPending("users-more");
    try {
      const result = await loadAdminDashboard({
        data: { userQuery: query, userCursor: userNext, uploadCursor: "" },
      });
      if (!result) {
        setToast(message(locale, "actionFailed"));
        return;
      }
      setMoreUsers((current) => {
        const seenIds = new Set([...dashboard.users, ...current].map((item) => item.id));
        const combined = [...current];
        for (const item of result.users) {
          if (seenIds.has(item.id)) continue;
          seenIds.add(item.id);
          combined.push(item);
        }
        return combined;
      });
      setUserNext(result.userNext);
    } catch {
      setToast(message(locale, "actionFailed"));
    } finally {
      setPending(null);
    }
  }

  async function moreUploadsPage() {
    if (pending !== null || uploadNext === null) return;
    setPending("uploads-more");
    try {
      const result = await loadAdminDashboard({
        data: { userQuery: query, userCursor: "", uploadCursor: uploadNext },
      });
      if (!result) {
        setToast(message(locale, "actionFailed"));
        return;
      }
      setMoreUploads((current) => {
        const seenIds = new Set([...dashboard.uploads, ...current].map((item) => item.id));
        const combined = [...current];
        for (const item of result.uploads) {
          if (seenIds.has(item.id)) continue;
          seenIds.add(item.id);
          combined.push(item);
        }
        return combined;
      });
      setUploadNext(result.uploadNext);
    } catch {
      setToast(message(locale, "actionFailed"));
    } finally {
      setPending(null);
    }
  }

  return (
    <ToastProvider>
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-foreground">{message(locale, "catalogHeading")}</h2>
        <p className="text-sm text-muted-foreground">{message(locale, "catalogNote")}</p>
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {dashboard.catalog.map((book) => {
              const confirmKey = `catalog:${book.id}`;
              return (
                <li key={book.id} className="flex flex-col gap-2 border-b border-border py-3">
                  <div>
                    <h3 className="display-title text-xl text-foreground">{book.title[locale]}</h3>
                    <p className="text-sm text-muted-foreground">{book.author}</p>
                    {book.stored ? null : (
                      <p className="text-sm text-muted-foreground">{message(locale, "bundledBook")}</p>
                    )}
                    <p className="text-sm text-foreground">
                      {message(locale, "chaptersLabel")}: {book.chapterCount}
                      {" · "}
                      {message(locale, "sentencesLabel")}: {book.sentenceCount}
                    </p>
                  </div>
                  {book.stored ? (
                    confirm === confirmKey ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm text-foreground">{book.title[locale]}</p>
                        <Button
                          type="button"
                          variant="danger"
                          autoFocus
                          busy={pending === confirmKey}
                          onClick={() =>
                            void run(confirmKey, () => deleteAdminCatalogBook({ data: { bookId: book.id } }))
                          }
                        >
                          {message(locale, "confirmDeletePermanent")}
                        </Button>
                        <Button type="button" variant="secondary" onClick={() => setConfirm(null)}>
                          {message(locale, "cancelAction")}
                        </Button>
                      </div>
                    ) : (
                      <Button type="button" variant="secondary" onClick={() => setConfirm(confirmKey)}>
                        {message(locale, "deleteCatalogBook")}
                      </Button>
                    )
                  ) : null}
                  {rowErrors[confirmKey] ? (
                    <p role="alert" className="text-sm text-destructive">
                      {rowErrors[confirmKey]}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
          <div className="flex flex-col gap-4">
            <CatalogImport
              locale={locale}
              disabled={false}
              onImported={async () => {
                await router.invalidate();
              }}
            />
            <div>
              <Button type="button" variant="secondary" onClick={() => setAdding((value) => !value)}>
                {message(locale, "addCatalogBook")}
              </Button>
            </div>
            {adding ? (
              <CatalogForm
                locale={locale}
                disabled={false}
                onSaved={async () => {
                  setAdding(false);
                  await router.invalidate();
                }}
              />
            ) : null}
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-foreground">{message(locale, "usersHeading")}</h2>
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void navigate({ to: "/admin", search: { q: draftQuery.trim() } });
          }}
        >
          <Field id="admin-user-search" label={message(locale, "searchUsers")} className="min-w-64 flex-1">
            <Input value={draftQuery} onChange={(event) => setDraftQuery(event.target.value)} />
          </Field>
          <Button type="submit" variant="secondary">
            {message(locale, "searchUsers")}
          </Button>
        </form>
        {users.length === 0 ? (
          <EmptyState>{message(locale, "noUsers")}</EmptyState>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {pageOfTotal(locale, users.length, dashboard.userTotal)}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">{message(locale, "usersHeading")}</th>
                    <th className="py-2 pr-3 font-medium">{message(locale, "roleLabel")}</th>
                    <th className="py-2 pr-3 font-medium">{message(locale, "nativeLanguage")}</th>
                    <th className="py-2 pr-3 font-medium">{message(locale, "createdLabel")}</th>
                    <th className="py-2 font-medium">{message(locale, "statusActive")}</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => {
                    const mine = user.id === dashboard.actorId;
                    const confirmKey = `user:${user.id}`;
                    const roleKey = `role:${user.id}`;
                    const chosen = roleChoice?.id === user.id ? roleChoice.role : user.role;
                    return (
                      <tr key={user.id} className="border-t border-border align-top">
                        <td className="py-3 pr-3">
                          <p className="font-medium text-foreground">
                            {user.name || user.email}
                            {mine ? (
                              <span className="ml-2 font-normal text-muted-foreground">
                                {message(locale, "youLabel")}
                              </span>
                            ) : null}
                          </p>
                          <p className="break-all text-muted-foreground">{user.email}</p>
                          {user.banned ? <StatusBadge>{message(locale, "statusBanned")}</StatusBadge> : null}
                        </td>
                        <td className="py-3 pr-3">
                          <Field
                            id={`user-role-${user.id}`}
                            label={message(locale, "roleLabel")}
                            hint={user.listed ? message(locale, "listedAdmin") : undefined}
                          >
                            <Select
                              value={chosen}
                              disabled={user.listed || pending === roleKey}
                              onChange={(event) => {
                                const role = event.target.value === "admin" ? "admin" : "user";
                                setRoleChoice(role === user.role ? null : { id: user.id, role });
                              }}
                            >
                              {roles.map((role) => (
                                <option key={role} value={role}>
                                  {message(locale, role === "admin" ? "roleAdmin" : "roleUser")}
                                </option>
                              ))}
                            </Select>
                          </Field>
                          {roleChoice?.id === user.id && roleChoice.role !== user.role ? (
                            <div className="mt-2 flex flex-wrap gap-2">
                              <p className="w-full text-sm text-foreground">{message(locale, "roleConfirm")}</p>
                              <Button
                                type="button"
                                autoFocus
                                busy={pending === roleKey}
                                onClick={() =>
                                  void run(roleKey, () =>
                                    setAdminUserRole({ data: { userId: user.id, role: roleChoice.role } }),
                                  )
                                }
                              >
                                {message(locale, "roleConfirm")}
                              </Button>
                              <Button type="button" variant="secondary" onClick={() => setRoleChoice(null)}>
                                {message(locale, "cancelAction")}
                              </Button>
                            </div>
                          ) : null}
                          {rowErrors[roleKey] ? (
                            <p role="alert" className="mt-1 text-sm text-destructive">
                              {rowErrors[roleKey]}
                            </p>
                          ) : null}
                        </td>
                        <td className="py-3 pr-3">
                          <Field id={`user-language-${user.id}`} label={message(locale, "nativeLanguage")}>
                            <Select
                              value={user.nativeLanguage}
                              disabled={pending === `language:${user.id}`}
                              onChange={(event) => {
                                const nativeLanguage = event.target.value === "ru" ? "ru" : "uk";
                                void run(`language:${user.id}`, () =>
                                  setAdminUserLanguage({ data: { userId: user.id, nativeLanguage } }),
                                );
                              }}
                            >
                              {nativeLanguages.map((language) => (
                                <option key={language} value={language}>
                                  {languageName(locale, language)}
                                </option>
                              ))}
                            </Select>
                          </Field>
                        </td>
                        <td className="py-3 pr-3 text-muted-foreground">{formatWhen(user.createdAt, locale)}</td>
                        <td className="py-3">
                          <div className="flex flex-col items-start gap-2">
                            {mine ? null : (
                              <Button
                                type="button"
                                variant="secondary"
                                busy={pending === `ban:${user.id}`}
                                onClick={() =>
                                  void run(`ban:${user.id}`, () =>
                                    setAdminUserBanned({ data: { userId: user.id, banned: !user.banned } }),
                                  )
                                }
                              >
                                {message(locale, user.banned ? "unblockUser" : "blockUser")}
                              </Button>
                            )}
                            {mine ? null : confirm === confirmKey ? (
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm text-foreground">{user.name || user.email}</p>
                                <Button
                                  type="button"
                                  variant="danger"
                                  autoFocus
                                  busy={pending === `delete:${user.id}`}
                                  onClick={() =>
                                    void run(`delete:${user.id}`, () => deleteAdminUser({ data: { userId: user.id } }))
                                  }
                                >
                                  {message(locale, "confirmDeletePermanent")}
                                </Button>
                                <Button type="button" variant="secondary" onClick={() => setConfirm(null)}>
                                  {message(locale, "cancelAction")}
                                </Button>
                              </div>
                            ) : (
                              <Button type="button" variant="secondary" onClick={() => setConfirm(confirmKey)}>
                                {message(locale, "deleteUser")}
                              </Button>
                            )}
                            {rowErrors[confirmKey] ? (
                              <p role="alert" className="text-sm text-destructive">
                                {rowErrors[confirmKey]}
                              </p>
                            ) : null}
                            {rowErrors[`ban:${user.id}`] ? (
                              <p role="alert" className="text-sm text-destructive">
                                {rowErrors[`ban:${user.id}`]}
                              </p>
                            ) : null}
                            {rowErrors[`language:${user.id}`] ? (
                              <p role="alert" className="text-sm text-destructive">
                                {rowErrors[`language:${user.id}`]}
                              </p>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {userNext ? (
              <Button type="button" variant="secondary" busy={pending === "users-more"} onClick={() => void moreUsersPage()}>
                {message(locale, "loadMore")}
              </Button>
            ) : null}
          </>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-foreground">{message(locale, "uploadsHeading")}</h2>
        {uploads.length === 0 ? (
          <EmptyState>{message(locale, "noUploads")}</EmptyState>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {pageOfTotal(locale, uploads.length, dashboard.uploadTotal)}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">{message(locale, "uploadTitleLabel")}</th>
                    <th className="py-2 pr-3 font-medium">{message(locale, "ownerLabel")}</th>
                    <th className="py-2 pr-3 font-medium">{message(locale, "sentencesLabel")}</th>
                    <th className="py-2 pr-3 font-medium">{message(locale, "createdLabel")}</th>
                    <th className="py-2 font-medium">{message(locale, "statusActive")}</th>
                  </tr>
                </thead>
                <tbody>
                  {uploads.map((book) => {
                    const confirmKey = `book:${book.id}`;
                    return (
                      <tr key={book.id} className="border-t border-border align-top">
                        <td className="py-3 pr-3 font-medium text-foreground">{book.title}</td>
                        <td className="py-3 pr-3 break-all text-muted-foreground">{book.ownerEmail || "—"}</td>
                        <td className="py-3 pr-3">{book.sentenceCount}</td>
                        <td className="py-3 pr-3 text-muted-foreground">{formatWhen(book.createdAt, locale)}</td>
                        <td className="py-3">
                          <div className="flex flex-col items-start gap-2">
                            {book.alignment === "pending" ? (
                              <StatusBadge>{message(locale, "alignmentPending")}</StatusBadge>
                            ) : null}
                            {confirm === confirmKey ? (
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm text-foreground">{book.title}</p>
                                <Button
                                  type="button"
                                  variant="danger"
                                  autoFocus
                                  busy={pending === confirmKey}
                                  onClick={() =>
                                    void run(confirmKey, () => deleteAdminBook({ data: { bookId: book.id } }))
                                  }
                                >
                                  {message(locale, "confirmDeletePermanent")}
                                </Button>
                                <Button type="button" variant="secondary" onClick={() => setConfirm(null)}>
                                  {message(locale, "cancelAction")}
                                </Button>
                              </div>
                            ) : (
                              <Button type="button" variant="secondary" onClick={() => setConfirm(confirmKey)}>
                                {message(locale, "deleteBook")}
                              </Button>
                            )}
                            {rowErrors[confirmKey] ? (
                              <p role="alert" className="text-sm text-destructive">
                                {rowErrors[confirmKey]}
                              </p>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {uploadNext ? (
              <Button
                type="button"
                variant="secondary"
                busy={pending === "uploads-more"}
                onClick={() => void moreUploadsPage()}
              >
                {message(locale, "loadMore")}
              </Button>
            ) : null}
          </>
        )}
      </section>
      <Toast
        open={toast !== null}
        onOpenChange={(open) => {
          if (!open) setToast(null);
        }}
        title={toast ?? ""}
        closeLabel={message(locale, "closePanel")}
      />
    </ToastProvider>
  );
}
