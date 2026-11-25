/**
 * Erreur d'un geste refusé ou échoué côté Git (S-53) : « message d'une ligne, saut de ligne, sortie brute de Git ».
 * Une erreur sans saut de ligne (refus nommé, timeout, « Git could not run. ») n'a pas de sortie brute : pas de
 * « Details ».
 */
export type GitErrorText = {
  /** La ligne affichée. */
  message: string;
  /** La sortie brute de Git, telle quelle ; vide quand Git n'a rien produit. */
  details: string;
};

export function splitGitError(text: string): GitErrorText {
  const at = text.indexOf("\n");
  if (at === -1) return { message: text, details: "" };
  return { message: text.slice(0, at), details: text.slice(at + 1).trim() };
}
