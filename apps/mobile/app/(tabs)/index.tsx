import { getDocumentAsync } from "expo-document-picker";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";

import { acceptIncomingUri } from "@/app/+native-intent";
import { ScreenState } from "@/components/screen-state";
import {
  BookCover,
  Button,
  Card,
  IconButton,
  Notice,
  ProgressBar,
  Screen,
  Sheet,
  SkeletonBlock,
  TopBar,
  useSnackbar,
} from "@/components/ui";
import { fetchBooks } from "@/lib/api";
import { catalogDownloadName, downloadCatalogBook } from "@/lib/catalog-download";
import { isImportLocked, runImport, subscribeImportLock } from "@/lib/import-lock";
import { enqueueIncoming, hasIncoming, incomingShareAction, subscribeIncoming, takeIncoming } from "@/lib/incoming-file";
import { markForBook, mergeLibrary, sameBookId, type LibraryRow } from "@/lib/library-merge";
import {
  deleteLocalBook,
  importLocalBook,
  loadLocalSummaries,
  readLocalChapterList,
  readStoredPosition,
  type ImportResult,
} from "@/lib/local-library";
import { chapterCountLabel, message, partProgress, type MessageKey } from "@/lib/messages";
import { continueFromPosition } from "@/lib/reading-resume";
import {
  loadLastReading,
  loadReadingMarks,
  type ReadingMark,
} from "@/lib/reading-progress";
import { useSettings } from "@/lib/settings";
import { space, useTheme } from "@/lib/theme";
import { displayTitle } from "@/lib/titles";
import type { BookSummary, Locale } from "@/lib/types";

type SharePayload = { value: string; shareType: string };
type ResolvedSharePayload = SharePayload & { originalName?: string | null };
type RowDownload = { status: "running" } | { status: "error" } | { status: "done" };

function isAbort(reason: unknown, signal: AbortSignal): boolean {
  if (signal.aborted) return true;
  return reason instanceof Error && reason.name === "AbortError";
}

function progressFor(marks: Record<string, ReadingMark>, bookId: string): number {
  const ratio = markForBook(marks, bookId)?.ratio ?? 0;
  return Number.isFinite(ratio) && ratio > 0 ? ratio : 0;
}

function importErrorKey(error: Extract<ImportResult, { ok: false }>["error"]): MessageKey {
  if (error === "reserved-id") return "importReserved";
  if (error === "io") return "importFailed";
  return "importInvalid";
}

function probeSharing(): boolean {
  try {
    const sharing = require("expo-sharing") as { getSharedPayloads: () => unknown };
    sharing.getSharedPayloads();
    return true;
  } catch {
    return false;
  }
}

function ShareBridge() {
  const sharing = require("expo-sharing") as {
    useIncomingShare: () => {
      sharedPayloads: SharePayload[];
      resolvedSharedPayloads: ResolvedSharePayload[];
      clearSharedPayloads: () => void;
      refreshSharePayloads: () => void;
      isResolving: boolean;
    };
  };
  const {
    sharedPayloads,
    resolvedSharedPayloads,
    clearSharedPayloads,
    refreshSharePayloads,
    isResolving,
  } = sharing.useIncomingShare();
  const seen = useRef(new Set<string>());
  const sawResolving = useRef(false);
  const [sharePass, setSharePass] = useState(0);
  const batch = sharedPayloads.map((payload) => `${payload.shareType}:${payload.value}`).join("\0");
  const batchRef = useRef(batch);

  useEffect(() => {
    if (batchRef.current !== batch) {
      batchRef.current = batch;
      sawResolving.current = false;
      seen.current.clear();
      if (sharePass !== 0) {
        setSharePass(0);
        return;
      }
    }
    if (isResolving) sawResolving.current = true;
    const action = incomingShareAction({
      empty: sharedPayloads.length === 0,
      isResolving,
      sawResolving: sawResolving.current,
      pass: sharePass,
    });
    if (action === "clear") {
      seen.current.clear();
      sawResolving.current = false;
      if (sharePass !== 0) setSharePass(0);
      return;
    }
    if (action === "wait") {
      if (!isResolving && sharePass === 0) setSharePass(1);
      return;
    }
    const names = new Map<string, string>();
    for (const resolved of resolvedSharedPayloads) {
      if (resolved.shareType !== "file" || !resolved.originalName) continue;
      names.set(resolved.value, resolved.originalName);
    }
    for (const payload of sharedPayloads) {
      if (payload.shareType !== "file" || payload.value.length === 0) continue;
      if (seen.current.has(payload.value)) continue;
      seen.current.add(payload.value);
      if (!acceptIncomingUri(payload.value)) continue;
      enqueueIncoming({
        uri: payload.value,
        name: names.get(payload.value) ?? null,
        onReadSettled: () => {
          clearSharedPayloads();
          refreshSharePayloads();
          seen.current.clear();
          sawResolving.current = false;
        },
      });
    }
  }, [
    batch,
    clearSharedPayloads,
    isResolving,
    refreshSharePayloads,
    resolvedSharedPayloads,
    sharePass,
    sharedPayloads,
  ]);

  return null;
}

export default function BookListScreen() {
  const router = useRouter();
  const { settings } = useSettings();
  const { colors } = useTheme();
  const snackbar = useSnackbar();
  const locale = settings.interfaceLocale;
  const nativeLanguage = settings.nativeLanguage;
  const importing = useSyncExternalStore(subscribeImportLock, isImportLocked, isImportLocked);
  const [canShare] = useState(probeSharing);
  const [localBooks, setLocalBooks] = useState<BookSummary[] | null>(null);
  const [localFailed, setLocalFailed] = useState(false);
  const [catalog, setCatalog] = useState<BookSummary[] | null>(null);
  const [catalogError, setCatalogError] = useState(false);
  const [catalogAttempt, setCatalogAttempt] = useState(0);
  const [importError, setImportError] = useState<MessageKey | null>(null);
  const [readingFile, setReadingFile] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [downloads, setDownloads] = useState<Record<string, RowDownload>>({});
  const [marks, setMarks] = useState<Record<string, ReadingMark>>({});
  const [lastReading, setLastReading] = useState<ReadingMark | null>(null);
  const [menu, setMenu] = useState<LibraryRow | null>(null);
  const downloadAbort = useRef<AbortController | null>(null);
  const loaded = useRef(false);
  const draining = useRef(false);

  const refreshMarks = useCallback(async (books: BookSummary[]) => {
    const [stored, all] = await Promise.all([loadLastReading(), loadReadingMarks()]);
    setMarks(all);
    if (stored) {
      setLastReading(stored);
      return;
    }
    for (const book of books) {
      const position = await readStoredPosition(book.id);
      if (!position) continue;
      const chapters = (await readLocalChapterList(book.id)) ?? [];
      const drafted = continueFromPosition({ chapters, position });
      if (!drafted) continue;
      setLastReading({
        bookId: book.id,
        source: "local",
        title: displayTitle(book.title, "en"),
        author: book.author,
        updatedAt: 0,
        ...drafted,
      });
      return;
    }
    setLastReading(null);
  }, []);

  const refreshLocal = useCallback(async (recover = false) => {
    try {
      const books = await loadLocalSummaries({ recover });
      loaded.current = true;
      setLocalBooks(books);
      setLocalFailed(false);
      await refreshMarks(books);
    } catch (reason: unknown) {
      console.error(reason);
      if (!loaded.current) setLocalFailed(true);
    }
  }, [refreshMarks]);

  const finishImport = useCallback(
    async (result: ImportResult) => {
      setImportError(result.ok ? null : importErrorKey(result.error));
      await refreshLocal(true);
    },
    [refreshLocal],
  );

  const drain = useCallback(() => {
    if (draining.current) return;
    draining.current = true;
    void (async () => {
      try {
        for (;;) {
          const next = takeIncoming();
          if (!next) break;
          await runImport(async () => {
            setReadingFile(true);
            try {
              const result = await importLocalBook({
                uri: next.uri,
                name: next.name,
                onReadSettled: next.onReadSettled,
              });
              await finishImport(result);
            } catch {
              console.error("local-import", "io");
              setImportError("importFailed");
              await refreshLocal(true);
            } finally {
              setReadingFile(false);
            }
          });
        }
      } finally {
        draining.current = false;
        if (hasIncoming()) drain();
      }
    })();
  }, [finishImport, refreshLocal]);

  useEffect(() => {
    void runImport(() => refreshLocal(true));
  }, [refreshLocal]);

  useEffect(() => subscribeIncoming(drain), [drain]);

  useFocusEffect(
    useCallback(() => {
      drain();
    }, [drain]),
  );

  useEffect(() => {
    return () => {
      downloadAbort.current?.abort();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    fetchBooks(controller.signal)
      .then((next) => {
        if (!active) return;
        setCatalog(next);
        setCatalogError(false);
      })
      .catch((reason: unknown) => {
        if (!active || isAbort(reason, controller.signal)) return;
        console.error(reason);
        setCatalog(null);
        setCatalogError(true);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [catalogAttempt]);

  const retryCatalog = useCallback(() => {
    setCatalog(null);
    setCatalogError(false);
    setCatalogAttempt((value) => value + 1);
  }, []);

  const retryLocal = useCallback(() => {
    setLocalFailed(false);
    void runImport(() => refreshLocal(true));
  }, [refreshLocal]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void (async () => {
      try {
        await refreshLocal(true);
        retryCatalog();
      } finally {
        setRefreshing(false);
      }
    })();
  }, [refreshLocal, retryCatalog]);

  const pickFile = useCallback(() => {
    setImportError(null);
    void (async () => {
      try {
        const picked = await getDocumentAsync({
          copyToCacheDirectory: true,
          multiple: false,
          type: "*/*",
        });
        if (picked.canceled) {
          setImportError(null);
          return;
        }
        const asset = picked.assets[0];
        if (!asset) return;
        setImportError(null);
        setReadingFile(true);
        await runImport(async () => {
          try {
            const result = await importLocalBook({
              uri: asset.uri,
              name: asset.name,
              size: asset.size ?? null,
              deleteAfter: true,
            });
            await finishImport(result);
          } finally {
            setReadingFile(false);
          }
        });
      } catch {
        console.error("local-import", "io");
        setImportError("importFailed");
        setReadingFile(false);
        await refreshLocal(true);
      }
    })();
  }, [finishImport, refreshLocal]);

  const confirmDelete = useCallback(
    (book: BookSummary) => {
      Alert.alert(message(locale, "deleteConfirmTitle"), message(locale, "deleteConfirmBody"), [
        { text: message(locale, "cancel"), style: "cancel" },
        {
          text: message(locale, "deleteBook"),
          style: "destructive",
          onPress: () => {
            void runImport(async () => {
              try {
                await deleteLocalBook(book.id);
              } catch (reason: unknown) {
                console.error(reason);
              }
              await refreshLocal(true);
            });
          },
        },
      ]);
    },
    [locale, refreshLocal],
  );

  const downloadCatalog = useCallback(
    (bookId: string) => {
      setImportError(null);
      if (catalogDownloadName(bookId) === null) {
        setDownloads((current) => ({ ...current, [bookId]: { status: "error" } }));
        return;
      }
      if (isImportLocked()) return;
      const controller = new AbortController();
      downloadAbort.current?.abort();
      downloadAbort.current = controller;
      setDownloads((current) => ({ ...current, [bookId]: { status: "running" } }));
      void runImport(async () => {
        try {
          const result = await downloadCatalogBook({
            bookId,
            lang: nativeLanguage,
            signal: controller.signal,
          });
          if (result.ok) {
            setDownloads((current) => ({ ...current, [bookId]: { status: "done" } }));
            await refreshLocal(true);
            snackbar.show(message(locale, "savedOffline"), {
              label: message(locale, "open"),
              onPress: () => {
                router.push({ pathname: "/local/[bookId]", params: { bookId: result.id } });
              },
            });
            return;
          }
          if (controller.signal.aborted) return;
          setDownloads((current) => ({ ...current, [bookId]: { status: "error" } }));
        } catch {
          if (controller.signal.aborted) return;
          console.error("catalog-download", "http");
          setDownloads((current) => ({ ...current, [bookId]: { status: "error" } }));
        }
      });
    },
    [locale, nativeLanguage, refreshLocal, router, snackbar],
  );

  const openBook = (
    source: "local" | "catalog",
    bookId: string,
    mark?: { chapterId: string; sentenceId: string | null },
  ) => {
    router.push({
      pathname: source === "local" ? "/local/[bookId]" : "/books/[bookId]",
      params: mark
        ? { bookId, chapterId: mark.chapterId, sentenceId: mark.sentenceId ?? "" }
        : { bookId },
    });
  };

  const merged = localBooks === null ? null : mergeLibrary(catalogError ? null : catalog, localBooks);
  const localRows = merged?.rows.filter((row) => row.source === "local") ?? [];
  const catalogRows = merged?.rows.filter((row) => row.source === "catalog") ?? [];
  const catalogReady = catalog !== null && !catalogError;
  const showEmpty = catalogReady && localRows.length === 0 && catalogRows.length === 0;
  const continueBook =
    lastReading === null
      ? null
      : (localBooks?.find((book) => sameBookId(book.id, lastReading.bookId)) ??
        catalog?.find((book) => sameBookId(book.id, lastReading.bookId)) ??
        null);
  const continueLocal = continueBook
    ? localBooks?.find((book) => sameBookId(book.id, continueBook.id))
    : undefined;

  return (
    <Screen>
      {canShare ? <ShareBridge /> : null}
      <TopBar
        title={message(locale, "appName")}
        trailing={
          <>
            <IconButton
              icon="plus"
              label={message(locale, "importBook")}
              disabled={importing || localBooks === null}
              onPress={pickFile}
            />
            <IconButton
              icon="bookmark"
              label={message(locale, "savedWords")}
              onPress={() => {
                router.push("/words");
              }}
            />
            <IconButton
              icon="settings"
              label={message(locale, "settings")}
              onPress={() => {
                router.push("/settings");
              }}
            />
          </>
        }
      />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.tide} />
        }
        contentContainerStyle={{ paddingHorizontal: space.xl, paddingBottom: space.xxxl, gap: space.lg }}
      >
        {readingFile ? (
          <Text style={{ color: colors.quiet, fontSize: 16 }}>{message(locale, "importing")}</Text>
        ) : null}
        {importError ? (
          <Notice
            text={message(locale, importError)}
            dismissLabel={message(locale, "close")}
            onDismiss={() => {
              setImportError(null);
            }}
          />
        ) : null}
        {continueBook && lastReading ? (
          <Card>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={message(locale, "continueReading")}
              onPress={() => {
                openBook(continueLocal ? "local" : "catalog", continueLocal?.id ?? continueBook.id, {
                  chapterId: lastReading.chapterId,
                  sentenceId: lastReading.sentenceId,
                });
              }}
              style={{ flexDirection: "row", gap: space.md, alignItems: "center" }}
            >
              <BookCover bookId={continueBook.id} title={displayTitle(continueBook.title, locale)} />
              <View style={{ flex: 1, gap: space.xs }}>
                <Text style={{ color: colors.tide, fontSize: 13, fontWeight: "700" }}>
                  {message(locale, "continueReading")}
                </Text>
                <Text
                  maxFontSizeMultiplier={1.3}
                  style={{ color: colors.ink, fontFamily: "Literata", fontSize: 20, lineHeight: 26 }}
                >
                  {displayTitle(continueBook.title, locale)}
                </Text>
                <Text style={{ color: colors.quiet, fontSize: 14 }}>
                  {partProgress(locale, lastReading.chapterIndex + 1, Math.max(lastReading.chapterCount, 1))}
                </Text>
                {Number.isFinite(lastReading.ratio) ? <ProgressBar value={lastReading.ratio} /> : null}
              </View>
            </Pressable>
          </Card>
        ) : null}
        {localBooks === null ? (
          <View style={{ gap: space.md }}>
            <ScreenState locale={locale} error={localFailed} onRetry={retryLocal} />
            {localFailed ? null : (
              <>
                <SkeletonBlock />
                <SkeletonBlock />
              </>
            )}
          </View>
        ) : (
          <View style={{ gap: space.lg }}>
            <View style={{ gap: space.md }}>
              <Text accessibilityRole="header" maxFontSizeMultiplier={1.3} style={{ color: colors.ink, fontSize: 22, fontWeight: "700" }}>
                {message(locale, "onThisPhone")}
              </Text>
              {localRows.length === 0 ? (
                <Text style={{ color: colors.quiet, fontSize: 16 }}>{message(locale, "emptyCatalog")}</Text>
              ) : (
                localRows.map((row) => (
                  <BookRow
                    key={row.key}
                    row={row}
                    locale={locale}
                    progress={progressFor(marks, row.book.id)}
                    saved
                    onOpen={() => {
                      openBook("local", row.book.id);
                    }}
                    onMenu={() => {
                      setMenu(row);
                    }}
                  />
                ))
              )}
            </View>
            <View style={{ gap: space.md }}>
              <Text accessibilityRole="header" maxFontSizeMultiplier={1.3} style={{ color: colors.ink, fontSize: 22, fontWeight: "700" }}>
                {message(locale, "library")}
              </Text>
              {catalogError ? (
                <Notice
                  text={message(locale, "catalogUnavailable")}
                  actionLabel={message(locale, "retry")}
                  onAction={retryCatalog}
                />
              ) : null}
              {catalog === null && !catalogError ? (
                <View accessibilityRole="progressbar" style={{ flexDirection: "row", gap: space.sm, alignItems: "center" }}>
                  <ActivityIndicator color={colors.tide} />
                  <Text style={{ color: colors.quiet }}>{message(locale, "loading")}</Text>
                </View>
              ) : null}
              {catalogRows.map((row) => {
                const download = downloads[row.book.id];
                return (
                  <View key={row.key} style={{ gap: space.sm }}>
                    <BookRow
                      row={row}
                      locale={locale}
                      progress={progressFor(marks, row.book.id)}
                      saved={download?.status === "done"}
                      onOpen={() => {
                        openBook("catalog", row.book.id);
                      }}
                      onMenu={() => {
                        setMenu(row);
                      }}
                    />
                    {download?.status === "running" ? (
                      <View
                        accessibilityRole="progressbar"
                        accessibilityLabel={message(locale, "downloading")}
                        style={{ flexDirection: "row", gap: space.xs, alignItems: "center" }}
                      >
                        <ActivityIndicator color={colors.tide} />
                        <Text style={{ color: colors.quiet, fontSize: 14 }}>{message(locale, "downloading")}</Text>
                      </View>
                    ) : null}
                    {download?.status === "error" ? (
                      <Notice
                        text={message(locale, "downloadFailed")}
                        actionLabel={message(locale, "retry")}
                        onAction={() => {
                          downloadCatalog(row.book.id);
                        }}
                      />
                    ) : null}
                  </View>
                );
              })}
              {showEmpty ? <Text style={{ color: colors.quiet, fontSize: 16 }}>{message(locale, "emptyCatalog")}</Text> : null}
            </View>
          </View>
        )}
      </ScrollView>
      <Sheet modal visible={menu !== null} onClose={() => setMenu(null)} label={message(locale, "menu")}>
        <Text accessibilityRole="header" style={{ color: colors.ink, fontSize: 18, fontFamily: "Literata" }}>
          {menu ? displayTitle(menu.book.title, locale) : ""}
        </Text>
        {menu?.source === "catalog" ? (
          <Button
            label={message(locale, downloads[menu.book.id]?.status === "running" ? "downloading" : "downloadBook")}
            disabled={downloads[menu.book.id]?.status === "running"}
            onPress={() => {
              const bookId = menu.book.id;
              setMenu(null);
              downloadCatalog(bookId);
            }}
          />
        ) : null}
        {menu?.source === "local" ? (
          <Button
            variant="destructive"
            label={message(locale, "deleteBook")}
            onPress={() => {
              const book = menu.book;
              setMenu(null);
              confirmDelete(book);
            }}
          />
        ) : null}
        <Button variant="quiet" label={message(locale, "close")} onPress={() => setMenu(null)} />
      </Sheet>
    </Screen>
  );
}

function BookRow({
  row,
  locale,
  progress,
  saved,
  onOpen,
  onMenu,
}: {
  row: LibraryRow;
  locale: Locale;
  progress: number;
  saved: boolean;
  onOpen: () => void;
  onMenu: () => void;
}) {
  const { colors } = useTheme();
  const title = displayTitle(row.book.title, locale);
  return (
    <Card>
      <View style={{ flexDirection: "row", gap: space.md, alignItems: "center" }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={title}
          onPress={onOpen}
          style={({ pressed }) => ({
            flex: 1,
            flexDirection: "row",
            gap: space.md,
            alignItems: "center",
            transform: pressed ? [{ scale: 0.99 }] : undefined,
          })}
        >
          <BookCover bookId={row.book.id} title={title} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text
              maxFontSizeMultiplier={1.3}
              style={{ color: colors.ink, fontFamily: "Literata", fontSize: 18, lineHeight: 24 }}
            >
              {title}
            </Text>
            {row.book.author.trim() === "" ? null : (
              <Text style={{ color: colors.quiet, fontSize: 14 }}>{row.book.author}</Text>
            )}
            <Text style={{ color: colors.faint, fontSize: 13 }}>
              {chapterCountLabel(locale, row.book.chapterCount)}
            </Text>
            {progress > 0 ? <ProgressBar value={progress} /> : null}
            {saved ? (
              <Text style={{ color: colors.tide, fontSize: 13, fontWeight: "700" }}>
                {message(locale, "onThisPhone")}
              </Text>
            ) : null}
          </View>
        </Pressable>
        <IconButton icon="more-horizontal" label={message(locale, "menu")} onPress={onMenu} />
      </View>
    </Card>
  );
}
