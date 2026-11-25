/**
 * Saisie en ligne du nom d'une branche : à créer (le commit où elle se crée et le geste qui l'a ouverte) ou à
 * renommer (`rename` : son nom actuel ; le champ prend la place de son étiquette dans le graphe ou de sa ligne dans
 * `BranchSidebar`, selon le geste).
 */
export type BranchInput =
  | {
      /** Identifiant complet du commit : le sommet de la courante (Branch) ou le commit visé (« Create branch here »). */
      commit: string;
      /** Geste d'origine : l'endroit où le focus revient à la fermeture. */
      source: "toolbar" | "row" | "detail";
      rename?: undefined;
    }
  | {
      /** Nom actuel de la branche locale à renommer. */
      rename: string;
      /** Où le champ s'ouvre ; sans elle, là où le menu de la branche a été ouvert en dernier (graphe par défaut). */
      source?: "graph" | "sidebar";
      commit?: undefined;
    };

/**
 * Champ de saisie en ligne d'un nom (état « saisie en ligne » de `RefLabel`) : réutilisé par Rename et Create tag.
 */
export type InlineInput = {
  /** Nom accessible du champ (« Branch name »). */
  label: string;
  /** Texte de départ du champ (Rename : le nom actuel) ; vide par défaut. */
  initial?: string;
  /** Message d'une ligne affiché sous le champ, ou `null`. */
  message: string | null;
  /** Le texte tapé change. */
  oninput: (value: string) => void;
  /**
   * Second champ, optionnel, sous le nom (message d'un tag annoté) : son nom accessible. Sans lui, un seul champ.
   */
  note?: { label: string };
  /** Entrée, sans message affiché : le texte tapé, et avec un second champ (`note`) son texte (vide si rien). */
  onsubmit: (value: string, note?: string) => void;
  /** Échap : la saisie se ferme. */
  oncancel: () => void;
};

/** Verdict de Git sur un nom de branche (commande `check_branch_name`). */
export type BranchNameVerdict = "valid" | "exists" | "invalid";

/** Verdict de Git sur un nom de tag (commande `check_tag_name`). */
export type TagNameVerdict = BranchNameVerdict;

/** Message sous le champ pour ce nom de tag et ce verdict, ou `null` (nom accepté). */
export function tagNameMessage(name: string, verdict: TagNameVerdict): string | null {
  if (verdict === "exists") return `Tag ${name} already exists.`;
  if (verdict === "invalid") return "Invalid tag name.";
  return null;
}

/** Message sous le champ pour ce nom et ce verdict, ou `null` (nom accepté). */
export function branchNameMessage(name: string, verdict: BranchNameVerdict): string | null {
  if (verdict === "exists") return `Branch ${name} already exists.`;
  if (verdict === "invalid") return "Invalid branch name.";
  return null;
}
