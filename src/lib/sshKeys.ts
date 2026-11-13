import { commands, type ConnectionTestView, type SshKeyView } from "./bindings";

/** Ce que `ProfileForm` demande au cœur pour la clé SSH d'un profil. Les erreurs sont des rejets portant un message. */
export type SshApi = {
  /** Sélecteur de fichier natif ouvert dans `~/.ssh` ; `null` si annulé. */
  choose: () => Promise<string | null>;
  inspect: (path: string) => Promise<SshKeyView>;
  /** Passphrase d'une clé protégée sans `.pub`, saisie une fois ; elle va au trousseau et n'en revient pas. */
  unlock: (path: string, passphrase: string) => Promise<SshKeyView>;
  /** Fichier proposé par Generate ed25519… pour le profil nommé. */
  propose: (name: string) => Promise<string>;
  generate: (name: string, passphrase: string) => Promise<SshKeyView>;
  copyPublicKey: (path: string) => Promise<void>;
  /** `ssh -T git@github.com` avec la seule clé du profil (10 s au plus) ; le texte est à afficher tel quel. */
  testConnection: (path: string) => Promise<ConnectionTestView>;
};

async function unwrap<T>(
  result: { status: "ok"; data: T } | { status: "error"; error: string },
): Promise<T> {
  if (result.status === "ok") return result.data;
  throw result.error;
}

/**
 * Affichage seulement : le dossier personnel macOS (`/Users/<nom>`) devient `~`, sauf `/Users/Shared`
 * qui n'est le dossier personnel de personne. Le chemin enregistré ne change pas.
 */
export function tildify(path: string): string {
  return path.replace(/^\/Users\/(?!Shared(?:\/|$))[^/]+(?=\/|$)/, "~");
}

/** Appels réels (Tauri, ou le pont de test en `pnpm dev:web`). */
export const sshApi: SshApi = {
  choose: () => commands.chooseSshKey(),
  inspect: async (path) => unwrap(await commands.inspectSshKey(path)),
  unlock: async (path, passphrase) => unwrap(await commands.unlockSshKey(path, passphrase)),
  propose: (name) => commands.proposeSshKey(name),
  generate: async (name, passphrase) => unwrap(await commands.generateSshKey(name, passphrase)),
  copyPublicKey: async (path) => {
    await unwrap(await commands.copyPublicKey(path));
  },
  testConnection: async (path) => unwrap(await commands.testSshConnection(path)),
};
