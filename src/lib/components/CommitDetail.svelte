<script lang="ts">
  import type { ChangeStatusView, CommitDetailView } from "../bindings";
  import { formatAbsolute, formatRelative } from "../relativeTime";

  let { detail }: { detail: CommitDetailView } = $props();

  const LETTERS: Record<ChangeStatusView, string> = { modified: "M", added: "A", deleted: "D" };
  const isMerge = $derived(detail.parents.length > 1);
  const lines = $derived(detail.message.replace(/\n+$/, "").split("\n"));
  const title = $derived(lines[0] ?? "");
  const body = $derived(lines.slice(1).join("\n").replace(/^\n+/, ""));
</script>

<section class="detail" aria-label="Commit detail" data-variant={isMerge ? "merge" : "commit"}>
  <div class="top">
    <span class="sha">{detail.id}</span>
    <span class="signature" data-signed={detail.signed}>
      {detail.signed ? "Signed" : "Not signed"}
    </span>
    {#if isMerge}<span class="merge">Merge commit</span>{/if}
  </div>
  <h2>{title}</h2>
  {#if body}<p class="body">{body}</p>{/if}
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
    {#each detail.files as file (file.path)}
      <li>
        <span class="status {file.status}" aria-label={file.status}>{LETTERS[file.status]}</span>
        <span class="path">{file.path}</span>
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

  .files li {
    display: flex;
    gap: 8px;
    align-items: center;
    padding: 2px 4px;
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
