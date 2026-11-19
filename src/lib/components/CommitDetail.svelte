<script lang="ts">
  import type { ChangeStatusView, CommitDetailView, MismatchView, RefView } from "../bindings";
  import { formatAbsolute, formatRelative } from "../relativeTime";

  let {
    detail,
    refs = [],
    oncheckout,
    oncreatebranch,
    onopenfile,
    editable = false,
    onamend,
    identity = null,
    blocked = null,
    noProfile = false,
    onfix,
  }: {
    /** Variante « dernier commit sur arbre propre » : Summary, Description et « Amend <sha> » (décidée par l'appelant à la sélection). */
    editable?: boolean;
    /** Amend du seul message ; rejette avec le message de Git si refusé. */
    onamend?: (summary: string, description: string) => Promise<void>;
    /** Identité effective conforme au profil rattaché ; `null` : la ligne n'est pas affichée. */
    identity?: { profile: string; email: string } | null;
    /** L'identité du `.git/config` local diffère du profil : raison et « Fix repository identity » sous Amend. */
    blocked?: Pick<MismatchView, "profileName" | "rows"> | null;
    /** Le dépôt n'a pas de profil rattaché : Amend est désactivé avec la raison « No profile ». */
    noProfile?: boolean;
    /** « Fix repository identity » ; rejette avec un message si l'écriture échoue. */
    onfix?: () => Promise<void>;
    /** Clic sur un fichier de la liste : rang (depuis 0) du fichier, pour ouvrir `DiffView`. */
    onopenfile?: (index: number) => void;
    detail: CommitDetailView;
    /** Refs que désigne ce commit (lues avec le dépôt) : seules les branches comptent pour Checkout. */
    refs?: RefView[];
    /** Checkout d'une branche locale ou d'une `origin/…` (même geste que le double-clic sur sa ref). */
    oncheckout?: (name: string) => void;
    /** « Create branch here » : l'identifiant complet de ce commit. */
    oncreatebranch?: (commit: string) => void;
  } = $props();

  /** Branches locales du commit ; à défaut, ses `origin/…` : Checkout agit alors comme celui de l'`origin/…`. */
  const targets = $derived.by(() => {
    const own = refs.filter((r) => r.target === detail.id);
    const locals = own.filter((r) => r.kind === "branch").map((r) => r.name);
    return locals.length > 0 ? locals : own.filter((r) => r.kind === "remote").map((r) => r.name);
  });

  let choosing = $state(false);
  let checkoutButton: HTMLButtonElement | undefined = $state();
  let chooser: HTMLElement | undefined = $state();

  function checkout() {
    if (targets.length === 1) oncheckout?.(targets[0]);
    else choosing = !choosing;
  }

  function choose(name: string) {
    choosing = false;
    oncheckout?.(name);
  }

  function closeChooser(refocus: boolean) {
    choosing = false;
    if (refocus) checkoutButton?.focus();
  }

  function focusFirst(node: HTMLElement, first: boolean) {
    if (first) node.focus();
  }

  function onchooserkeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeChooser(true);
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const items = [...(chooser?.querySelectorAll<HTMLElement>("[role='menuitem']") ?? [])];
      if (items.length === 0) return;
      const index = items.indexOf(document.activeElement as HTMLElement);
      const step = event.key === "ArrowDown" ? 1 : -1;
      items[(index + step + items.length) % items.length].focus();
    }
  }

  /** Un appui hors du menu de choix le ferme, sans checkout. */
  function onpointerdown(event: PointerEvent) {
    if (
      choosing &&
      !chooser?.contains(event.target as Node) &&
      !checkoutButton?.contains(event.target as Node)
    )
      closeChooser(false);
  }

  const LETTERS: Record<ChangeStatusView, string> = {
    modified: "M",
    added: "A",
    deleted: "D",
    conflicted: "U",
  };
  const isMerge = $derived(detail.parents.length > 1);
  const lines = $derived(detail.message.replace(/\n+$/, "").split("\n"));
  const title = $derived(lines[0] ?? "");
  const body = $derived(lines.slice(1).join("\n").replace(/^\n+/, ""));

  /** Message d'origine séparé comme `WorkingChanges` : première ligne, puis le corps sans lignes vides de tête. */
  const original = $derived.by(() => {
    const [first = "", ...rest] = detail.message.replace(/\r\n/g, "\n").split("\n");
    return { summary: first, description: rest.join("\n").replace(/^\n+/, "").trimEnd() };
  });
  /** Saisies ; `null` tant que le champ n'a pas été modifié (il montre alors le message d'origine). */
  let editedSummary: string | null = $state(null);
  let editedDescription: string | null = $state(null);
  const summary = $derived(editedSummary ?? original.summary);
  const description = $derived(editedDescription ?? original.description);
  const changed = $derived(summary !== original.summary || description !== original.description);
  let busy = $state(false);
  let fixing = $state(false);
  let failure: string | null = $state(null);

  /** Pourquoi Amend est désactivé (ligne de raison), ou `null`. Un message identique le désactive sans raison. */
  const reason = $derived(
    blocked
      ? `Identity does not match profile ${blocked.profileName}.`
      : noProfile
        ? "No profile"
        : summary.trim() === ""
          ? "Summary required"
          : null,
  );
  const disabled = $derived(reason !== null || !changed || busy);

  async function amend() {
    if (disabled || !onamend) return;
    busy = true;
    failure = null;
    try {
      await onamend(summary, description);
    } catch (e) {
      failure = (typeof e === "string" ? e : "The amend failed.").split("\n")[0];
    } finally {
      busy = false;
    }
  }

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

  function keydown(event: KeyboardEvent) {
    if (event.metaKey && event.key === "Enter") {
      event.preventDefault();
      void amend();
    }
  }
</script>

<svelte:window {onpointerdown} />

<section class="detail" aria-label="Commit detail" data-variant={isMerge ? "merge" : "commit"}>
  <div class="top">
    <span class="sha">{detail.id}</span>
    <span class="signature" data-signed={detail.signed}>
      {detail.signed ? "Signed" : "Not signed"}
    </span>
    {#if isMerge}<span class="merge">Merge commit</span>{/if}
  </div>
  <div class="actions">
    {#if targets.length > 0}
      <div class="checkout">
        <button
          type="button"
          class="action"
          bind:this={checkoutButton}
          aria-haspopup={targets.length > 1 ? "menu" : undefined}
          aria-expanded={targets.length > 1 ? choosing : undefined}
          onclick={checkout}>Checkout</button
        >
        {#if choosing}
          <!-- svelte-ignore a11y_interactive_supports_focus -->
          <div
            class="chooser"
            role="menu"
            aria-label="Checkout"
            bind:this={chooser}
            onkeydown={onchooserkeydown}
          >
            {#each targets as name, i (name)}
              <button
                type="button"
                role="menuitem"
                class="choice"
                use:focusFirst={i === 0}
                onclick={() => choose(name)}>{name}</button
              >
            {/each}
          </div>
        {/if}
      </div>
    {/if}
    <button
      type="button"
      class="action"
      data-create-branch
      onclick={() => oncreatebranch?.(detail.id)}>Create branch here</button
    >
  </div>
  {#if editable}
    <div class="form">
      <label class="field">
        <span>Summary</span>
        <input
          type="text"
          value={summary}
          oninput={(e) => (editedSummary = e.currentTarget.value)}
          onkeydown={keydown}
        />
      </label>
      <label class="field">
        <span>Description</span>
        <textarea
          rows="4"
          value={description}
          oninput={(e) => (editedDescription = e.currentTarget.value)}
          onkeydown={keydown}></textarea>
      </label>
      <button type="button" class="amend" {disabled} onclick={amend}>
        Amend {detail.id.slice(0, 7)}
        <kbd aria-hidden="true">⌘↵</kbd>
      </button>
      {#if blocked}
        <div class="blocked">
          <p><strong>{reason}</strong></p>
          <button type="button" class="fixlink" disabled={fixing} onclick={fix}
            >Fix repository identity</button
          >
        </div>
      {:else}
        {#if identity}
          <p class="identity">✓ Identity matches profile {identity.profile} · {identity.email}</p>
        {/if}
        {#if reason}<p class="reason">{reason}</p>{/if}
      {/if}
      {#if failure}<p class="failure" role="alert">{failure}</p>{/if}
    </div>
  {:else}
    <h2>{title}</h2>
    {#if body}<p class="body">{body}</p>{/if}
  {/if}
  <p class="meta">
    Author: {detail.author} · {detail.email}<br />
    Date:
    {#if detail.timestamp !== null}
      <time datetime={new Date(detail.timestamp * 1000).toISOString()}>
        {formatAbsolute(detail.timestamp)}
      </time>
      ({formatRelative(detail.timestamp)})
    {:else}
      unknown
    {/if}<br />
    {detail.parents.length > 1 ? "Parents" : "Parent"}:
    {#each detail.parents as parent, i (parent)}
      <span class="sha">{parent.slice(0, 7)}</span>{i < detail.parents.length - 1 ? " " : ""}
    {:else}
      none
    {/each}
  </p>
  <h3>
    {detail.files.length}
    {detail.files.length === 1 ? "file" : "files"} changed
    {#if isMerge}<span class="against">against first parent {detail.parents[0].slice(0, 7)}</span
      >{/if}
  </h3>
  <ul class="files">
    {#each detail.files as file, i (file.path)}
      <li>
        <button type="button" class="file" data-file={file.path} onclick={() => onopenfile?.(i)}>
          <span class="status {file.status}" aria-label={file.status}>{LETTERS[file.status]}</span>
          <span class="path">{file.path}</span>
        </button>
      </li>
    {/each}
  </ul>
</section>

<style>
  .detail {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 10px;
    height: 100%;
    padding: 12px;
    overflow-y: auto;
    background: var(--surface-raised);
    border-left: 1px solid var(--border);
  }

  .top {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: baseline;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }

  .checkout {
    position: relative;
  }

  .action {
    padding: 2px 10px;
    border: 1px solid var(--border-strong);
    border-radius: 5px;
    background: transparent;
    color: var(--ink);
    font: inherit;
    font-size: 12px;
    cursor: pointer;
  }

  .action:hover {
    background: var(--selection);
  }

  .action:focus-visible,
  .choice:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 1px;
  }

  .chooser {
    position: absolute;
    z-index: 5;
    top: calc(100% + 4px);
    left: 0;
    display: flex;
    flex-direction: column;
    min-width: 180px;
    padding: 4px;
    border: 1px solid var(--border-strong);
    border-radius: 6px;
    background: var(--surface-raised);
  }

  .choice {
    padding: 3px 8px;
    border: 0;
    border-radius: 4px;
    background: none;
    color: var(--ink);
    font: inherit;
    font-size: 13px;
    text-align: left;
    cursor: pointer;
  }

  .choice:hover {
    background: var(--selection);
  }

  .sha,
  .path {
    font-family: ui-monospace, "SF Mono", monospace;
    font-size: 12px;
    overflow-wrap: anywhere;
  }

  .signature,
  .merge {
    color: var(--muted);
    font-size: 12px;
  }

  .signature[data-signed="true"]::before {
    content: "✓ ";
  }

  .merge {
    padding: 0 7px;
    border: 1px solid var(--border-strong);
    border-radius: 5px;
    color: var(--ink);
  }

  h2,
  h3,
  p {
    margin: 0;
  }

  h2 {
    font-size: 14px;
    overflow-wrap: anywhere;
  }

  h3 {
    color: var(--muted);
    font-size: 12px;
    font-weight: 400;
  }

  .against {
    margin-left: 6px;
  }

  .body {
    color: var(--muted);
    white-space: pre-wrap;
  }

  .form {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .field span {
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
  .amend:focus-visible,
  .fixlink:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }

  .amend {
    padding: 6px 10px;
    border: 1px solid var(--brand);
    border-radius: 5px;
    background: var(--brand);
    color: var(--on-brand);
    font: inherit;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }

  .amend:disabled {
    border-color: var(--border);
    background: transparent;
    color: var(--muted);
    cursor: default;
  }

  kbd {
    margin-left: 6px;
    font: inherit;
    font-size: 12px;
    opacity: 0.85;
  }

  .identity {
    color: var(--success);
    font-size: 12px;
  }

  .reason {
    color: var(--muted);
    font-size: 12px;
  }

  .failure {
    color: var(--danger);
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
  }

  .fixlink {
    align-self: flex-start;
    padding: 2px 10px;
    border: 1px solid var(--border-strong);
    border-radius: 5px;
    background: transparent;
    color: var(--ink);
    font: inherit;
    font-size: 12px;
    cursor: pointer;
  }

  .fixlink:disabled {
    color: var(--muted);
    cursor: default;
  }

  .meta {
    font-size: 12px;
    line-height: 1.6;
  }

  .files {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .file {
    display: flex;
    gap: 8px;
    align-items: center;
    width: 100%;
    padding: 2px 4px;
    border: 0;
    border-radius: 5px;
    background: none;
    color: var(--ink);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .file:hover {
    background: var(--selection);
  }

  .file:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 1px;
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
