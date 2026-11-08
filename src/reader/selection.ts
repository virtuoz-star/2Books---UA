export type SelectionState = {
  selectedId: string | null;
  wordIndex?: number | null;
};

export function selectSentence(state: SelectionState, id: string): SelectionState {
  if (state.selectedId === id) return { selectedId: null };
  return { selectedId: id };
}

export function selectWord(
  state: SelectionState,
  sentenceId: string,
  wordIndex: number,
): SelectionState {
  if (state.selectedId === sentenceId && state.wordIndex === wordIndex) {
    return { selectedId: sentenceId, wordIndex: null };
  }
  return { selectedId: sentenceId, wordIndex };
}

export function clearSelection(): SelectionState {
  return { selectedId: null };
}
