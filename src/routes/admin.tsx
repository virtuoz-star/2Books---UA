import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useState } from "react";

import { CatalogForm } from "#/admin/catalog-form";
import { CatalogImport } from "#/admin/catalog-import";
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
} from "#/admin/api";
import { languageName, message } from "#/i18n/messages";
import type { Locale, NativeLanguage } from "#/i18n/types";
import { useReaderSettings } from "#/reader/use-reader-settings";

export const Route = createFileRoute("/admin")({
  beforeLoad: ({ context }) => {
    if (!context.user) throw redirect({ to: "/sign-in" });
    if (context.user.role !== "admin") throw redirect({ to: "/" });
  },
  loader: () => loadAdminDashboard(),
  component: AdminPage,
});

const nativeLanguages = ["uk", "ru"] as const satisfies readonly NativeLanguage[];
const roles = ["user", "admin"] as const;

const fieldClass =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground";
const buttonClass =
  "cursor-pointer rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground disabled:cursor-default disabled:opacity-60";
const dangerClass =
  "cursor-pointer rounded-md border-0 bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:cursor-default disabled:opacity-60";

function formatWhen(value: string, locale: Locale): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(date);
}

function failureMessage(locale: Locale, error: AdminFailure | null): string | null {
  if (error === "last-admin") return message(locale, "lastAdmin");
  if (error === "invalid-input") return message(locale, "invalidCatalog");
  if (error === "reserved-id") return message(locale, "reservedId");
  if (error === "duplicate") return message(locale, "duplicateBook");
  if (error === null) return null;
  return message(locale, "actionFailed");
}

function AdminPage() {
  const dashboard = Route.useLoaderData();
  const { settings } = useReaderSettings();
  const locale = settings.interfaceLocale;

  return (
    <main className="flex w-full flex-col gap-10">
      <h1 className="text-2xl font-semibold text-foreground">{message(locale, "adminTitle")}</h1>
      {dashboard === null ? (
        <p role="alert" className="text-base text-foreground">
          {message(locale, "actionFailed")}
        </p>
      ) : (
        <AdminPanels dashboard={dashboard} locale={locale} />
      )}
    </main>
  );
}

function AdminPanels({ dashboard, locale }: { dashboard: AdminDashboard; locale: Locale }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [error, setError] = useState<AdminFailure | null>(null);
  const errorMessage = failureMessage(locale, error);

  async function run(
    key: string,
    action: () => Promise<{ ok: true } | { ok: false; error: AdminFailure }>,
  ) {
    if (pending !== null) return;
    setPending(key);
    setError(null);
    try {
      const result = await action();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setConfirm(null);
      await router.invalidate();
    } catch {
      setError("unavailable");
    } finally {
      setPending(null);
    }
  }

  return (
    <>
      {errorMessage ? (
        <p role="alert" className="text-sm text-foreground">
          {errorMessage}
        </p>
      ) : null}
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-foreground">{message(locale, "usersHeading")}</h2>
        {dashboard.users.length === 0 ? (
          <p className="text-base text-foreground">{message(locale, "noUsers")}</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-4 p-0">
            {dashboard.users.map((user) => {
              const mine = user.id === dashboard.actorId;
              const confirmKey = `user:${user.id}`;
              return (
                <li
                  key={user.id}
                  className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4"
                >
                  <div className="flex flex-col gap-1">
                    <p className="text-base font-medium text-foreground">
                      {user.name || user.email}
                      {mine ? (
                        <span className="ml-2 text-sm font-normal text-muted-foreground">
                          {message(locale, "youLabel")}
                        </span>
                      ) : null}
                    </p>
                    <p className="break-all text-sm text-muted-foreground">{user.email}</p>
                    <p className="text-sm text-muted-foreground">
                      {message(locale, "createdLabel")}: {formatWhen(user.createdAt, locale)}
                    </p>
                    <p className="text-sm text-foreground">
                      {user.banned
                        ? message(locale, "statusBanned")
                        : message(locale, "statusActive")}
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
                      {message(locale, "roleLabel")}
                      <select
                        id={`user-role-${user.id}`}
                        value={user.role}
                        disabled={pending !== null}
                        onChange={(event) => {
                          const role = event.target.value === "admin" ? "admin" : "user";
                          void run(`role:${user.id}`, () =>
                            setAdminUserRole({ data: { userId: user.id, role } }),
                          );
                        }}
                        className={fieldClass}
                      >
                        {roles.map((role) => (
                          <option key={role} value={role}>
                            {message(locale, role === "admin" ? "roleAdmin" : "roleUser")}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
                      {message(locale, "nativeLanguage")}
                      <select
                        id={`user-language-${user.id}`}
                        value={user.nativeLanguage}
                        disabled={pending !== null}
                        onChange={(event) => {
                          const nativeLanguage = event.target.value === "ru" ? "ru" : "uk";
                          void run(`language:${user.id}`, () =>
                            setAdminUserLanguage({ data: { userId: user.id, nativeLanguage } }),
                          );
                        }}
                        className={fieldClass}
                      >
                        {nativeLanguages.map((language) => (
                          <option key={language} value={language}>
                            {languageName(locale, language)}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {mine ? null : (
                      <button
                        type="button"
                        disabled={pending !== null}
                        onClick={() =>
                          void run(`ban:${user.id}`, () =>
                            setAdminUserBanned({ data: { userId: user.id, banned: !user.banned } }),
                          )
                        }
                        className={buttonClass}
                      >
                        {message(locale, user.banned ? "unblockUser" : "blockUser")}
                      </button>
                    )}
                    {mine ? null : confirm === confirmKey ? (
                      <>
                        <button
                          type="button"
                          disabled={pending !== null}
                          onClick={() =>
                            void run(`delete:${user.id}`, () =>
                              deleteAdminUser({ data: { userId: user.id } }),
                            )
                          }
                          className={dangerClass}
                        >
                          {message(locale, "confirmDelete")}
                        </button>
                        <button
                          type="button"
                          disabled={pending !== null}
                          onClick={() => setConfirm(null)}
                          className={buttonClass}
                        >
                          {message(locale, "cancelAction")}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        disabled={pending !== null}
                        onClick={() => setConfirm(confirmKey)}
                        className={buttonClass}
                      >
                        {message(locale, "deleteUser")}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-foreground">
          {message(locale, "catalogHeading")}
        </h2>
        <p className="text-sm text-muted-foreground">{message(locale, "catalogNote")}</p>
        <CatalogImport
          locale={locale}
          disabled={pending !== null}
          onImported={async () => {
            await router.invalidate();
          }}
        />
        <CatalogForm
          locale={locale}
          disabled={pending !== null}
          onSaved={async () => {
            await router.invalidate();
          }}
        />
        <ul className="m-0 flex list-none flex-col gap-4 p-0">
          {dashboard.catalog.map((book) => {
            const confirmKey = `catalog:${book.id}`;
            return (
              <li
                key={book.id}
                className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4"
              >
                <div className="flex flex-col gap-1">
                  <h3 className="display-title text-2xl font-medium text-foreground">
                    {book.title[locale]}
                  </h3>
                  <p className="text-sm text-muted-foreground">{book.author}</p>
                  {book.stored ? null : (
                    <p className="text-sm text-muted-foreground">
                      {message(locale, "bundledBook")}
                    </p>
                  )}
                  <p className="text-sm text-foreground">
                    {message(locale, "chaptersLabel")}: {book.chapterCount}
                  </p>
                  <p className="text-sm text-foreground">
                    {message(locale, "sentencesLabel")}: {book.sentenceCount}
                  </p>
                </div>
                {book.stored ? (
                  <div className="flex flex-wrap gap-2">
                    {confirm === confirmKey ? (
                      <>
                        <button
                          type="button"
                          disabled={pending !== null}
                          onClick={() =>
                            void run(`catalog:${book.id}`, () =>
                              deleteAdminCatalogBook({ data: { bookId: book.id } }),
                            )
                          }
                          className={dangerClass}
                        >
                          {message(locale, "confirmDelete")}
                        </button>
                        <button
                          type="button"
                          disabled={pending !== null}
                          onClick={() => setConfirm(null)}
                          className={buttonClass}
                        >
                          {message(locale, "cancelAction")}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        disabled={pending !== null}
                        onClick={() => setConfirm(confirmKey)}
                        className={buttonClass}
                      >
                        {message(locale, "deleteCatalogBook")}
                      </button>
                    )}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-foreground">
          {message(locale, "uploadsHeading")}
        </h2>
        {dashboard.uploads.length === 0 ? (
          <p className="text-base text-foreground">{message(locale, "noUploads")}</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-4 p-0">
            {dashboard.uploads.map((book) => {
              const confirmKey = `book:${book.id}`;
              return (
                <li
                  key={book.id}
                  className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4"
                >
                  <div className="flex flex-col gap-1">
                    <h3 className="text-base font-medium text-foreground">{book.title}</h3>
                    <p className="break-all text-sm text-muted-foreground">
                      {message(locale, "ownerLabel")}: {book.ownerEmail || "—"}
                    </p>
                    <p className="text-sm text-foreground">
                      {message(locale, "sentencesLabel")}: {book.sentenceCount}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {message(locale, "createdLabel")}: {formatWhen(book.createdAt, locale)}
                    </p>
                    {book.alignment === "pending" ? (
                      <p className="text-sm text-foreground">
                        {message(locale, "alignmentPending")}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {confirm === confirmKey ? (
                      <>
                        <button
                          type="button"
                          disabled={pending !== null}
                          onClick={() =>
                            void run(`book:${book.id}`, () =>
                              deleteAdminBook({ data: { bookId: book.id } }),
                            )
                          }
                          className={dangerClass}
                        >
                          {message(locale, "confirmDelete")}
                        </button>
                        <button
                          type="button"
                          disabled={pending !== null}
                          onClick={() => setConfirm(null)}
                          className={buttonClass}
                        >
                          {message(locale, "cancelAction")}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        disabled={pending !== null}
                        onClick={() => setConfirm(confirmKey)}
                        className={buttonClass}
                      >
                        {message(locale, "deleteBook")}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
