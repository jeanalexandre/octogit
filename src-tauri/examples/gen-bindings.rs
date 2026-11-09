//! Génère `src/lib/bindings.ts` depuis le contrat Rust (`pnpm gen:bindings`).

use specta_typescript::Typescript;

fn main() {
    let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../src/lib/bindings.ts");
    octogit_app::builder()
        .export(Typescript::default(), path)
        .expect("failed to export TypeScript bindings");
}
