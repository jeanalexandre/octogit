<script lang="ts">
  import type {
    ChangeStatusView,
    FileChangeView,
    MismatchView,
    WorkingTreeView,
  } from "../bindings";

  let {
    tree,
    branch = null,
    onstageall,
    onunstageall,
    oncommit,
    onloadlast,
    canAmend = false,
    identity = null,
    blocked = null,
    onfix,
  }: {
    /** L'identité du `.git/config` local diffère du profil : l'état bloqué remplace la ligne d'identité. */
    blocked?: Pick<MismatchView, "profileName" | "rows"> | null;
    /** « Fix repository identity » : écrit les valeurs du profil ; rejette avec un message si l'écriture échoue. */
    onfix?: () => Promise<void>;
    tree: WorkingTreeView;
    /** Branche courante : nomme le bouton Commit. */
    branch?: string | null;
    onstageall: () => void;
    onunstageall: () => void;
    /** Commit (ou amend) des fichiers indexés ; rejette avec le message de Git si le commit est refusé. */
    oncommit: (summary: string, description: string, amend: boolean) => Promise<void>;
    /** Message complet du dernier commit (Amend last commit). */
    onloadlast: () => Promise<string>;
    /** Il y a un commit à amender. */
    canAmend?: boolean;
    /** Identité effective conforme au profil rattaché ; `null` : la ligne n'est pas affichée. */
    identity?: { profile: string; email: string } | null;
  } = $props();

  const LETTERS: Record<ChangeStatusView, string> = { modified: "M", added: "A", deleted: "D" };
  /** Fichiers modifiés, un fichier présent des deux côtés compté une fois (comme la ligne WIP). */
  const count = $derived(new Set([...tree.unstaged, ...tree.staged].map((f) => f.path)).size);
  const clean = $derived(count === 0);

  let summary = $state("");
  let description = $state("");
  let amend = $state(false);
  let busy = $state(false);
  let failure: string | null = $state(null);
  /** Brouillon saisi avant de cocher Amend, rendu à l'identique quand on décoche. */
  let draft: { summary: string; description: string } | null = null;
  /** Invalide la lecture du dernier message si Amend change entre-temps. */
  let amendToken = 0;

  /** Pourquoi Commit est désactivé, ou `null`. Rien n'est jamais indexé automatiquement. */
  const reason = $derived(
    blocked
      ? `Identity does not match profile ${blocked.profileName}.`
      : tree.staged.length === 0
        ? "No staged changes"
        : summary.trim() === ""
          ? "Summary required"
          : null,
  );
  const differing = $derived(blocked?.rows.filter((row) => row.differs) ?? []);
  let fixing = $state(false);

  async function fix() {
    if (fixing || !onfix) return;
    fixing = true;
    failure = null;
    try {
      await onfix();
    } catch (e) {
      failure = (typeof e === "string" ? e : "The identity could not be fixed.").split("\n")[0];
    } finally {
      fixing = false;
    }
  }

  /** Sépare le message d'un commit : première ligne, puis le corps sans ses lignes vides de tête. */
  function split(message: string) {
    const [first = "", ...rest] = message.replace(/\r\n/g, "\n").split("\n");
    return { summary: first, description: rest.join("\n").replace(/^\n+/, "").trimEnd() };
  }

  async function toggleAmend() {
    const token = ++amendToken;
    if (amend) {
      draft = { summary, description };
      try {
        const last = split(await onloadlast());
        if (token !== amendToken) return;
        summary = last.summary;
        description = last.description;
      } catch {
        if (token !== amendToken) return;
        amend = false;
        draft = null;
        failure = "Could not read the last commit message.";
      }
    } else if (draft) {
      summary = draft.summary;
      description = draft.description;
      draft = null;
    }
  }

  async function commit() {
    if (reason !== null || busy) return;
    busy = true;
    failure = null;
    try {
      await oncommit(summary, description, amend);
      summary = "";
      description = "";
      amend = false;
      draft = null;
      amendToken++;
    } catch (e) {
      failure = (typeof e === "string" ? e : "The commit failed.").split("\n")[0];
    } finally {
      busy = false;
    }
  }

  function keydown(event: KeyboardEvent) {
    if (event.metaKey && event.key === "Enter") {
      event.preventDefault();
      void commit();
    }
  }
</script>

<section class="changes" aria-label="Working changes">
  <h2>Working changes{clean ? "" : ` · ${count} ${count === 1 ? "file" : "files"}`}</h2>
  {#if clean}
    <p class="clean">Working tree clean.</p>
  {:else}
    {@render group("Unstaged", tree.unstaged, "Stage all", onstageall)}
    {@render group("Staged", tree.staged, "Unstage all", onunstageall)}
  {/if}
  <div class="form">
    <label class="field">
      <span>Summary</span>
      <input type="text" bind:value={summary} onkeydown={keydown} />
    </label>
    <label class="field">
      <span>Description</span>
      <textarea rows="4" bind:value={description} onkeydown={keydown}></textarea>
    </label>
    <label class="check">
      <input type="checkbox" bind:checked={amend} disabled={!canAmend} onchange={toggleAmend} />
      Amend last commit
    </label>
    {#if blocked}
      <div class="blocked">
        <p><strong>{reason}</strong></p>
        {#each differing as row (row.setting)}
          <p>Expected: {row.profile}</p>
          <p>Found in .git/config: {row.local ?? "(not set)"}</p>
        {/each}
        <button type="button" disabled={fixing} onclick={fix}>Fix repository identity</button>
      </div>
    {/if}
    <button type="button" class="commit" disabled={reason !== null || busy} onclick={commit}>
      {branch ? `Commit to ${branch}` : "Commit"}
      <kbd aria-hidden="true">⌘↵</kbd>
    </button>
    {#if !blocked}
      {#if identity}
        <p class="identity">✓ Identity matches profile {identity.profile} · {identity.email}</p>
      {/if}
      {#if reason}
        <p class="reason">{reason}</p>
      {/if}
    {/if}
    {#if failure}
      <p class="failure" role="alert">{failure}</p>
    {/if}
  </div>
</section>

{#snippet group(title: string, files: FileChangeView[], action: string, run: () => void)}
  <div class="head">
    <h3>{title} · {files.length}</h3>
    <button type="button" class="all" disabled={files.length === 0} onclick={run}>{action}</button>
  </div>
  <ul class="files" aria-label={title}>
    {#each files as file (file.path)}
      <li>
        <span class="status {file.status}" aria-label={file.status}>{LETTERS[file.status]}</span>
        <span class="path">{file.path}</span>
      </li>
    {/each}
  </ul>
{/snippet}

<style>
  .changes {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 10px;
    height: 100%;
    padding: 12px;
    overflow-y: auto;
    background: var(--surface-raised);
    border-left: 1px solid var(--border);
    color: var(--ink);
  }

  h2,
  h3,
  p {
    margin: 0;
  }

  h2 {
    font-size: 14px;
  }

  h3 {
    color: var(--muted);
    font-size: 12px;
    font-weight: 400;
  }

  .clean {
    color: var(--muted);
    font-size: 13px;
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  button {
    padding: 4px 10px;
    border: 1px solid var(--border-strong);
    border-radius: 5px;
    background: transparent;
    color: var(--ink);
    font: inherit;
    font-size: 12px;
    cursor: pointer;
  }

  button:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }

  button:disabled {
    border-color: var(--border);
    color: var(--muted);
    cursor: default;
  }

  .all {
    padding: 0 8px;
  }

  .form {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: auto;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 4px;
    color: var(--muted);
    font-size: 12px;
  }

  .field input,
  .field textarea {
    box-sizing: border-box;
    width: 100%;
    padding: 5px 8px;
    border: 1px solid var(--border-strong);
    border-radius: 5px;
    background: var(--surface);
    color: var(--ink);
    font: inherit;
    font-size: 13px;
    resize: vertical;
  }

  .field input:focus-visible,
  .field textarea:focus-visible,
  .check input:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }

  .check {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
  }

  .identity {
    color: var(--success);
    font-size: 12px;
  }

  .blocked {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px;
    border: 1px solid var(--warning);
    border-radius: 5px;
    background: var(--surface);
    font-size: 12px;
    overflow-wrap: anywhere;
  }

  .blocked button {
    align-self: flex-start;
    margin-top: 4px;
  }

  .reason {
    color: var(--muted);
    font-size: 12px;
  }

  .failure {
    color: var(--danger);
    font-size: 12px;
  }

  .commit {
    padding: 6px 10px;
    border-color: var(--brand);
    background: var(--brand);
    color: var(--on-brand);
    font-size: 13px;
    font-weight: 600;
  }

  .commit:disabled {
    border-color: var(--border);
    background: transparent;
    color: var(--muted);
  }

  kbd {
    margin-left: 6px;
    font: inherit;
    font-size: 12px;
    opacity: 0.85;
  }

  .files {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .files li {
    display: flex;
    gap: 8px;
    align-items: center;
    padding: 2px 4px;
  }

  .path {
    font-family: ui-monospace, "SF Mono", monospace;
    font-size: 12px;
    overflow-wrap: anywhere;
  }

  .status {
    display: inline-grid;
    flex: none;
    place-items: center;
    width: 16px;
    height: 16px;
    border-radius: 4px;
    color: var(--on-label);
    font-size: 12px;
    font-weight: 700;
    line-height: 1;
  }

  .modified {
    background: var(--warning);
  }

  .added {
    background: var(--success);
  }

  .deleted {
    background: var(--danger);
  }
</style>
