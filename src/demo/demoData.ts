import { addDays, format, startOfDay, subDays } from 'date-fns';
import type {
  CompletedItem, Item, Label, Project, Section, Snapshot, TodoistUser,
} from '@/domain/types';
import { emptySnapshot } from '@/domain/types';

/**
 * A made-up account, so the product can be shown or tried without connecting
 * anyone's real Todoist. Nothing here is ever written back: the demo snapshot
 * lives in memory and the store refuses to send commands while it is loaded.
 */

/** Deterministic per session, so a demo can be talked through without it shifting. */
function makeRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

const TASKS = [
  ['Répondre à Amélie sur la sélection print', 'Relire le fil et proposer **deux options** avant vendredi.'],
  ['Relire le brief de la refonte', 'Vérifier que la cible et le périmètre correspondent à ce qui a été validé.'],
  ['Préparer la revue hebdomadaire', '- Relever les blocages\n- Ranger la boîte de réception\n- Fixer les trois priorités'],
  ['Envoyer la facture de septembre', ''],
  ['Choisir la police du site', 'Comparer deux familles sur un écran réel, pas seulement dans Figma.'],
  ['Arroser les plantes', ''],
  ['Sortir les poubelles', ''],
  ['Sauvegarder les photos du week-end', 'Copier sur le disque externe puis vérifier un fichier au hasard.'],
  ['Appeler le garage', ''],
  ['Mettre à jour le portfolio', 'Ajouter les deux derniers projets et raccourcir les textes.'],
  ['Lire le rapport annuel', ''],
  ['Réserver le vol de novembre', 'Comparer les horaires du matin, éviter la correspondance courte.'],
  ['Trier la boîte mail', ''],
  ['Préparer la démo client', 'Une page par sujet, pas de jargon, finir par les prochaines étapes.'],
  ['Automatiser la relance de factures', ''],
  ['Réponse du syndic sur les travaux', ''],
  ['Corriger le formulaire de contact', 'Le champ téléphone accepte encore du texte.'],
  ['Écrire la note de cadrage', 'Contexte, décision attendue, options, recommandation.'],
  ['Ranger le bureau', ''],
  ['Préparer le déjeuner de samedi', ''],
  ['Revoir les estimations du sprint', ''],
  ['Publier l’article sur les habitudes', 'Relire à voix haute avant de publier.'],
  ['Changer les draps', ''],
  ['Vérifier les sauvegardes du serveur', ''],
  ['Planifier les congés de décembre', ''],
] as const;

const COMPLETED_TITLES = [
  'Relire la proposition', 'Envoyer le devis', 'Appeler la banque', 'Ranger le dressing',
  'Mettre à jour le CV', 'Publier la newsletter', 'Payer la taxe foncière',
  'Réparer le vélo', 'Trier les photos', 'Préparer la réunion', 'Faire les courses',
  'Répondre aux candidatures', 'Nettoyer la base de données', 'Relancer le client',
  'Écrire le compte-rendu', 'Réserver le restaurant', 'Commander les cartes de visite',
];

export function buildDemoSnapshot(seed = 20260914): Snapshot {
  const random = makeRandom(seed);
  const today = startOfDay(new Date());
  const iso = (d: Date) => format(d, 'yyyy-MM-dd');
  const pick = <T,>(list: readonly T[]): T => list[Math.floor(random() * list.length)];

  const projects: Record<string, Project> = {};
  const addProject = (
    id: string, name: string, color: string, order: number,
    extra: Partial<Project> = {},
  ) => {
    projects[id] = {
      id, name, color, parent_id: null, child_order: order,
      is_archived: false, is_deleted: false, is_favorite: false,
      workspace_id: null, ...extra,
    };
  };

  addProject('inbox', 'Boîte de réception', 'charcoal', 0, { inbox_project: true });
  addProject('perso', 'Personnel', 'orange', 1, { is_favorite: true });
  addProject('maison', 'Maison', 'green', 2, { description: 'Entretien, courses et petites réparations.' });
  addProject('site', 'www.exemple.fr', 'blue', 3, {
    is_favorite: true,
    description: 'Refonte du portfolio.\n\n- Nouvelle grille\n- Textes raccourcis\n- Blog migré',
  });
  addProject('clients', 'Clients', 'grey', 4, { is_folder: true });
  addProject('client-a', 'Atelier Berger', 'grape', 5, { parent_id: 'clients' });
  addProject('client-b', 'Studio Nord', 'teal', 6, { parent_id: 'clients' });

  const sections: Record<string, Section> = {
    's-todo': {
      id: 's-todo', project_id: 'site', name: 'À faire', section_order: 0,
      is_archived: false, is_deleted: false,
      description: 'Tout ce qui est prêt à démarrer.',
    },
    's-doing': {
      id: 's-doing', project_id: 'site', name: 'En cours', section_order: 1,
      is_archived: false, is_deleted: false,
      description: 'Deux tâches maximum ici, sinon plus rien n’avance.',
    },
    's-review': {
      id: 's-review', project_id: 'site', name: 'À relire', section_order: 2,
      is_archived: false, is_deleted: false,
    },
  };

  const labels: Record<string, Label> = {
    l1: { id: 'l1', name: 'quick', color: 'sky_blue', item_order: 1, is_deleted: false, is_favorite: true },
    l2: { id: 'l2', name: 'week', color: 'olive_green', item_order: 2, is_deleted: false, is_favorite: false },
    l3: { id: 'l3', name: 'automation', color: 'grape', item_order: 3, is_deleted: false, is_favorite: true },
    l4: { id: 'l4', name: 'waiting', color: 'charcoal', item_order: 4, is_deleted: false, is_favorite: true },
    l5: { id: 'l5', name: 'rappel', color: 'magenta', item_order: 5, is_deleted: false, is_favorite: false },
  };

  const projectIds = ['inbox', 'perso', 'maison', 'site', 'client-a', 'client-b'];
  const items: Record<string, Item> = {};
  let counter = 0;

  const addItem = (partial: Partial<Item> & { content: string }): Item => {
    counter += 1;
    const item: Item = {
      id: `demo-${counter}`,
      user_id: 'demo-user',
      project_id: 'inbox',
      section_id: null,
      parent_id: null,
      description: '',
      priority: 1,
      due: null,
      deadline: null,
      duration: null,
      labels: [],
      child_order: counter,
      day_order: -1,
      collapsed: false,
      checked: false,
      is_deleted: false,
      added_at: subDays(today, Math.floor(random() * 60)).toISOString(),
      completed_at: null,
      updated_at: today.toISOString(),
      responsible_uid: null,
      ...partial,
      content: partial.content,
    };
    items[item.id] = item;
    return item;
  };

  const due = (date: Date, time?: string, recurring?: string) => ({
    date: time ? `${iso(date)}T${time}` : iso(date),
    timezone: null,
    string: recurring ?? iso(date),
    lang: 'fr',
    is_recurring: !!recurring,
  });

  // A spread that exercises every rule: overdue, quick, timed, week, backlog.
  const plan: Array<Partial<Item>> = [
    { due: due(subDays(today, 4)), priority: 4, labels: ['est-40'] },
    { due: due(subDays(today, 1)), priority: 3, labels: ['est-25'] },
    { due: due(today), priority: 2, labels: ['quick', 'est-10'] },
    { due: due(today), priority: 1, labels: ['est-3'], project_id: 'maison' },
    { due: due(today, undefined, 'tous les lundis'), priority: 1, labels: ['est-5'], project_id: 'maison' },
    { due: due(today, '14:00:00'), priority: 3, labels: ['est-60'] },
    { due: due(today, '09:30:00'), priority: 2, labels: ['est-30'], project_id: 'client-a' },
    { labels: ['week', 'est-90'], priority: 4, project_id: 'site', section_id: 's-doing' },
    { labels: ['week', 'est-45'], priority: 3, project_id: 'site', section_id: 's-doing' },
    { labels: ['week'], priority: 2, project_id: 'site', section_id: 's-todo' },
    { due: due(addDays(today, 1)), priority: 3, labels: ['est-20'] },
    { due: due(addDays(today, 2)), priority: 4, labels: ['est-120'], deadline: { date: iso(addDays(today, 6)), lang: 'fr' } },
    { due: due(addDays(today, 3)), priority: 1, labels: ['est-15'], project_id: 'client-b' },
    { due: due(addDays(today, 5)), priority: 2, project_id: 'site', section_id: 's-review' },
    { due: due(addDays(today, 9)), priority: 1, labels: ['est-45'], project_id: 'perso' },
    { labels: ['automation'], priority: 2, project_id: 'perso' },
    { labels: ['waiting'], priority: 1, project_id: 'maison' },
    { priority: 1, project_id: 'perso' },
    { priority: 1, labels: ['est-25'], project_id: 'maison' },
    { priority: 2, project_id: 'site', section_id: 's-todo', labels: ['est-60'] },
    { priority: 1, project_id: 'client-a' },
    { priority: 3, project_id: 'client-b', labels: ['est-180'] },
    { priority: 1 },
    { priority: 1, labels: ['est-30'], project_id: 'perso' },
    { priority: 1, project_id: 'maison' },
  ];

  plan.forEach((shape, index) => {
    const [content, description] = TASKS[index % TASKS.length];
    addItem({
      content,
      description,
      project_id: shape.project_id ?? pick(projectIds),
      ...shape,
    } as Partial<Item> & { content: string });
  });

  // One parent with subtasks, so hierarchy and rolled-up estimates are visible.
  const parent = addItem({
    content: 'Refonte de la page d’accueil',
    description: 'Trois blocs, une seule idée par bloc.',
    project_id: 'site',
    section_id: 's-doing',
    priority: 4,
    labels: ['week'],
  });
  addItem({ content: 'Écrire les textes', parent_id: parent.id, project_id: 'site', labels: ['est-45'] });
  addItem({ content: 'Choisir les images', parent_id: parent.id, project_id: 'site', labels: ['est-30'] });
  addItem({ content: 'Intégrer la maquette', parent_id: parent.id, project_id: 'site', labels: ['est-120'] });

  // A couple of deliberate contradictions, so the conflicts centre has content.
  addItem({
    content: 'Préparer le point mensuel',
    project_id: 'perso',
    priority: 3,
    due: due(addDays(today, 2)),
    labels: ['week', 'est-45'],
  });
  addItem({
    content: 'Classer les reçus',
    project_id: 'perso',
    priority: 1,
    labels: ['quick', 'est-25'],
  });

  const user: TodoistUser = {
    id: 'demo-user',
    email: 'demo@exemple.fr',
    full_name: 'Alex Martin',
    inbox_project_id: 'inbox',
    tz_info: { timezone: 'Europe/Paris', hours: 2, minutes: 0, is_dst: 1 },
    start_day: 1,
    is_premium: true,
    karma: 23480,
    image_id: null,
  };

  return {
    ...emptySnapshot(),
    items,
    projects,
    sections,
    labels,
    user,
    syncToken: 'demo',
    syncedAt: Date.now(),
  };
}

/** A year of plausible history, so Insights has something to chart. */
export function buildDemoCompleted(seed = 20260914): CompletedItem[] {
  const random = makeRandom(seed + 7);
  const today = startOfDay(new Date());
  const projectIds = ['inbox', 'perso', 'maison', 'site', 'client-a', 'client-b'];
  const out: CompletedItem[] = [];
  let id = 0;

  for (let daysAgo = 0; daysAgo < 365; daysAgo += 1) {
    const date = subDays(today, daysAgo);
    const weekday = date.getDay();
    // Fewer completions at weekends, and a gentle decline further back.
    const base = weekday === 0 || weekday === 6 ? 1.5 : 5;
    const count = Math.max(0, Math.round(base * (0.5 + random()) * (daysAgo > 120 ? 0.6 : 1)));

    for (let i = 0; i < count; i += 1) {
      id += 1;
      const hour = 8 + Math.floor(random() * 11);
      const at = new Date(date);
      at.setHours(hour, Math.floor(random() * 60), 0, 0);
      const minutes = [5, 10, 15, 25, 30, 45, 60, 90][Math.floor(random() * 8)];
      out.push({
        id: `done-${id}`,
        user_id: 'demo-user',
        project_id: projectIds[Math.floor(random() * projectIds.length)],
        section_id: null,
        content: COMPLETED_TITLES[Math.floor(random() * COMPLETED_TITLES.length)],
        completed_at: at.toISOString(),
        priority: (1 + Math.floor(random() * 4)) as 1 | 2 | 3 | 4,
        labels: random() > 0.35 ? [`est-${minutes}`] : [],
      });
    }
  }

  return out;
}
