<script lang="ts">
  import Plus from "@lucide/svelte/icons/plus";
  import X from "@lucide/svelte/icons/x";
  import type { RuleView } from "../bindings";

  let { rules = $bindable() }: { rules: RuleView[] } = $props();

  const labels = { path: "Path", remoteOwner: "Remote owner" } as const;
  const placeholders = { path: "~/Dev/Pro/**", remoteOwner: "github.com/pro-company/*" } as const;

  let added: HTMLUListElement | undefined = $state();

  /** Ajoute une règle vide et met le focus sur son motif, à saisir. */
  async function add(kind: RuleView["kind"]) {
    rules.push({ kind, pattern: "" });
    await Promise.resolve();
    const inputs = added?.querySelectorAll<HTMLInputElement>("input");
    inputs?.[inputs.length - 1]?.focus();
  }

  function remove(index: number) {
    rules.splice(index, 1);
  }
</script>

<section class="rules" aria-labelledby="rules-title">
  <h3 id="rules-title">
    Matching rules
    <span class="hint">— a repository uses the first profile with a matching rule</span>
  </h3>
  <ul aria-label="Matching rules" bind:this={added}>
    {#each rules as rule, index (index)}
      <li class="band">
        <span class="kind">{labels[rule.kind]}</span>
        <input
          type="text"
          class="mono"
          aria-label="Rule pattern"
          placeholder={placeholders[rule.kind]}
          bind:value={rule.pattern}
        />
        <button
          type="button"
          class="remove"
          aria-label={`Remove ${labels[rule.kind]} rule ${rule.pattern}`.trim()}
          onclick={() => remove(index)}
        >
          <X size={16} strokeWidth={1.8} />
        </button>
      </li>
    {/each}
  </ul>
  <div class="add">
    <button type="button" onclick={() => add("path")}>
      <Plus size={16} strokeWidth={1.8} />Path rule
    </button>
    <button type="button" onclick={() => add("remoteOwner")}>
      <Plus size={16} strokeWidth={1.8} />Remote owner rule
    </button>
  </div>
  <p class="hint">
    Matched repositories get this identity, key and signing written in their local .git/config.
  </p>
</section>

<style>
  .rules {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-top: 8px;
    border-top: 1px solid var(--border);
  }

  h3 {
    margin: 0;
    font-size: 13px;
    font-weight: 600;
  }

  h3 .hint {
    font-weight: 400;
  }

  .hint {
    margin: 0;
    color: var(--muted);
    font-size: 12px;
  }

  ul {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .band {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .kind {
    flex: none;
    width: 96px;
    color: var(--muted);
    font-size: 12px;
  }

  input {
    flex: 1;
    min-width: 0;
    padding: 6px 8px;
    border: 1px solid var(--border-strong);
    border-radius: 4px;
    background: var(--surface);
    color: var(--ink);
    font: inherit;
  }

  .mono {
    font-family: ui-monospace, "SF Mono", monospace;
  }

  button {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border: 1px solid var(--border-strong);
    border-radius: 4px;
    background: var(--surface);
    color: var(--ink);
    font: inherit;
    cursor: pointer;
  }

  .remove {
    padding: 4px;
  }

  .add {
    display: flex;
    gap: 8px;
  }

  button:focus-visible,
  input:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 1px;
  }
</style>
