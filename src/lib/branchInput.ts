/** Saisie en ligne du nom d'une branche à créer : le commit où elle se crée et le geste qui l'a ouverte. */
export type BranchInput = {
  /** Identifiant complet du commit : le sommet de la courante (Branch) ou le commit visé (« Create branch here »). */
  commit: string;
  /** Geste d'origine : l'endroit où le focus revient à la fermeture. */
  source: "toolbar" | "row" | "detail";
};

/**
 * Champ de saisie en ligne d'un nom (état « saisie en ligne » de `RefLabel`) : réutilisé par Rename et Create tag.
 */
export type InlineInput = {
  /** Nom accessible du champ (« Branch name »). */
  label: string;
  /** Message d'une ligne affiché sous le champ, ou `null`. */
  message: string | null;
  /** Le texte tapé change. */
  oninput: (value: string) => void;
  /** Entrée, sans message affiché : le texte tapé. */
  onsubmit: (value: string) => void;
  /** Échap : la saisie se ferme. */
  oncancel: () => void;
};

/** Verdict de Git sur un nom de branche (commande `check_branch_name`). */
export type BranchNameVerdict = "valid" | "exists" | "invalid";

/** Message sous le champ pour ce nom et ce verdict, ou `null` (nom accepté). */
export function branchNameMessage(name: string, verdict: BranchNameVerdict): string | null {
  if (verdict === "exists") return `Branch ${name} already exists.`;
  if (verdict === "invalid") return "Invalid branch name.";
  return null;
}
