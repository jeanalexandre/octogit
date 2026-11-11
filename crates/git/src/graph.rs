//! Placement des commits en lanes : colonne et couleur de chaque commit, et tronçons de lignes
//! à tracer dans la hauteur de sa ligne. Pur calcul, sans accès au dépôt.

use crate::CommitInfo;

/// Nombre de couleurs de lanes (`lane-1`…`lane-6` des tokens), utilisées cycliquement.
pub const LANE_COLORS: usize = 6;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EdgeKind {
    /// La lane `from` traverse la ligne de haut en bas (`to == from`).
    Through,
    /// De la lane `from`, en haut de la ligne, vers le nœud (lane `to`).
    In,
    /// Du nœud (lane `from`) vers la lane `to`, en bas de la ligne.
    Out,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Edge {
    pub kind: EdgeKind,
    pub from: usize,
    pub to: usize,
    /// Indice de couleur, de 0 à `LANE_COLORS - 1`.
    pub color: usize,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GraphRow {
    /// Colonne du nœud.
    pub lane: usize,
    /// Couleur du nœud et de la ligne.
    pub color: usize,
    pub edges: Vec<Edge>,
}

/// Une lane active : le commit qu'elle attend (prochain commit de la lane) et sa couleur.
#[derive(Clone)]
struct Lane<'a> {
    waiting_for: &'a str,
    color: usize,
}

/// Une couleur différente de celles des lanes actives les plus proches de `lane` (à gauche et à
/// droite), en tournant sur les couleurs pour varier d'une branche à l'autre.
fn pick_color(lanes: &[Option<Lane>], lane: usize, counter: &mut usize) -> usize {
    let left = lanes[..lane.min(lanes.len())]
        .iter()
        .rev()
        .find_map(|l| l.as_ref().map(|l| l.color));
    let right = lanes
        .get(lane + 1..)
        .and_then(|rest| rest.iter().find_map(|l| l.as_ref().map(|l| l.color)));
    loop {
        let color = *counter % LANE_COLORS;
        *counter += 1;
        if Some(color) != left && Some(color) != right {
            return color;
        }
    }
}

/// Première lane libre, sinon une nouvelle à droite.
fn free_lane(lanes: &mut Vec<Option<Lane>>) -> usize {
    match lanes.iter().position(Option::is_none) {
        Some(i) => i,
        None => {
            lanes.push(None);
            lanes.len() - 1
        }
    }
}

/// Une ligne de graphe par commit, dans l'ordre reçu (le plus récent d'abord).
pub fn layout(commits: &[CommitInfo]) -> Vec<GraphRow> {
    let mut lanes: Vec<Option<Lane>> = Vec::new();
    let mut counter = 0;
    let mut rows = Vec::with_capacity(commits.len());
    for commit in commits {
        let id = commit.id.as_str();
        let waiting: Vec<usize> = lanes
            .iter()
            .enumerate()
            .filter(|(_, l)| l.as_ref().is_some_and(|l| l.waiting_for == id))
            .map(|(i, _)| i)
            .collect();
        let (lane, color) = match waiting.first() {
            Some(&i) => (i, lanes[i].as_ref().map_or(0, |l| l.color)),
            None => {
                let i = free_lane(&mut lanes);
                (i, pick_color(&lanes, i, &mut counter))
            }
        };
        let mut edges = Vec::new();
        for (i, l) in lanes.iter().enumerate() {
            let Some(l) = l else { continue };
            if waiting.contains(&i) {
                edges.push(Edge {
                    kind: EdgeKind::In,
                    from: i,
                    to: lane,
                    color: l.color,
                });
            } else {
                edges.push(Edge {
                    kind: EdgeKind::Through,
                    from: i,
                    to: i,
                    color: l.color,
                });
            }
        }
        for &i in &waiting {
            lanes[i] = None;
        }
        for (n, parent) in commit.parents.iter().enumerate() {
            let existing = lanes
                .iter()
                .position(|l| l.as_ref().is_some_and(|l| l.waiting_for == parent));
            let (target, edge_color) = match existing {
                // Second parent déjà attendu ailleurs : coude sur la ligne du merge, de la couleur de la lane d'arrivée.
                Some(i) if n > 0 => (i, lanes[i].as_ref().map_or(color, |l| l.color)),
                // Premier parent déjà attendu ailleurs : la lane reste ouverte jusqu'au parent,
                // qui la rejoint par une arête `In` sur sa propre ligne (coude de création).
                _ => {
                    let i = if n == 0 { lane } else { free_lane(&mut lanes) };
                    let lane_color = if n == 0 {
                        color
                    } else {
                        pick_color(&lanes, i, &mut counter)
                    };
                    lanes[i] = Some(Lane {
                        waiting_for: parent,
                        color: lane_color,
                    });
                    (i, lane_color)
                }
            };
            edges.push(Edge {
                kind: EdgeKind::Out,
                from: lane,
                to: target,
                color: edge_color,
            });
        }
        while lanes.last().is_some_and(Option::is_none) {
            lanes.pop();
        }
        rows.push(GraphRow { lane, color, edges });
    }
    rows
}
