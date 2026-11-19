// A completion for an older snapshot must not mark a newer edit as saved.
export function createAutosave({
  snapshot,
  write,
  onSaving = () => {},
  onSaved = () => {},
  onError = () => {},
  delay = 500,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
}) {
  let revision = 0,
    pending = false,
    timer;
  function flush() {
    clearTimer(timer);
    if (!pending) return;
    const savingRevision = revision;
    pending = false;
    try {
      const operation = write(snapshot());
      Promise.resolve(operation).then(
        () => {
          if (savingRevision === revision && !pending) onSaved();
        },
        (error) => failed(error, savingRevision),
      );
    } catch (error) {
      failed(error, savingRevision);
    }
  }
  function failed(error, savingRevision) {
    if (savingRevision !== revision) return;
    pending = true;
    onError(error);
  }
  return {
    schedule() {
      revision++;
      pending = true;
      onSaving();
      clearTimer(timer);
      timer = setTimer(flush, delay);
    },
    flush,
  };
}
