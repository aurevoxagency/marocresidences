export type ChatLanguage = "fr" | "en";

export type ChatKnowledgeEntry = {
  id: string;
  /** Keywords / phrases used for matching (lowercase). */
  keywords: string[];
  answers: Record<ChatLanguage, string>;
};

/**
 * Knowledge base for the Maroc Résidences homepage assistant.
 * Covers booking, search, promo, payments, stays, guests, and support.
 */
export const CHATBOT_KNOWLEDGE: ChatKnowledgeEntry[] = [
  {
    id: "greeting",
    keywords: [
      "bonjour",
      "bonsoir",
      "salut",
      "hello",
      "hi",
      "hey",
      "coucou",
      "salam",
      "assalam",
      "good morning",
      "good evening",
    ],
    answers: {
      fr: "Bonjour ! Je suis l’assistant Maroc Résidences. Je peux vous aider pour la recherche, la réservation, les codes promo, les paiements, les avis ou le support. Que souhaitez-vous savoir ?",
      en: "Hello! I’m the Maroc Résidences assistant. I can help with search, booking, promo codes, payments, reviews, or support. What would you like to know?",
    },
  },
  {
    id: "what_is",
    keywords: [
      "c est quoi",
      "qu est ce que",
      "qui etes vous",
      "about",
      "plateforme",
      "maroc residences",
      "what is",
      "who are you",
    ],
    answers: {
      fr: "Maroc Résidences est une plateforme de riads et maisons d’hôtes vérifiés au Maroc. Vous recherchez, comparez et réservez en ligne ; la maison confirme ensuite votre demande.",
      en: "Maroc Résidences is a platform of verified riads and guesthouses in Morocco. You search, compare and book online; the property then confirms your request.",
    },
  },
  {
    id: "login_required",
    keywords: [
      "connecter",
      "connexion",
      "compte",
      "login",
      "sign in",
      "sign up",
      "register",
      "inscription",
      "creer un compte",
      "sans compte",
      "without account",
      "obligatoire de se connecter",
      "besoin d un compte",
    ],
    answers: {
      fr: "Pour réserver, vous devez créer un compte ou vous connecter. Cela sécurise votre demande et vous permet de suivre votre réservation. La simple recherche de maisons ne nécessite pas de compte.",
      en: "To book, you need to create an account or sign in. This secures your request and lets you track your reservation. Browsing and searching homes does not require an account.",
    },
  },
  {
    id: "booking_flow",
    keywords: [
      "réserver",
      "reserver",
      "reservation",
      "réservation",
      "booking",
      "book",
      "comment réserver",
      "comment reserver",
      "how to book",
      "faire une reservation",
      "etapes",
      "étapes",
      "processus",
    ],
    answers: {
      fr: "Pour réserver : 1) renseignez destination, dates et voyageurs dans la recherche, 2) choisissez une maison puis « Réserver », 3) connectez-vous si besoin, 4) vérifiez chambre, voyageurs et code promo, 5) confirmez. Votre demande est « en attente » jusqu’à validation.",
      en: "To book: 1) enter destination, dates and guests in search, 2) pick a home then “Book”, 3) sign in if needed, 4) check room, guests and promo code, 5) confirm. Your request stays “pending” until validated.",
    },
  },
  {
    id: "search",
    keywords: [
      "rechercher",
      "recherche",
      "search",
      "moteur",
      "trouver une maison",
      "find a home",
      "filtrer",
      "resultats",
      "résultats",
    ],
    answers: {
      fr: "Utilisez le moteur en haut de page : destination (ville ou maison), dates d’arrivée et de départ, adultes, et âges des enfants/bébés si besoin. La recherche ne se lance que si ces champs sont remplis.",
      en: "Use the search bar at the top: destination (city or home), check-in and check-out dates, adults, and children’s/infants’ ages if needed. Search only runs when those fields are filled.",
    },
  },
  {
    id: "availability",
    keywords: [
      "disponib",
      "disponible",
      "availability",
      "libre",
      "complet",
      "full",
      "occupe",
      "occupé",
    ],
    answers: {
      fr: "Les disponibilités dépendent des chambres et des dates choisies. Lancez une recherche avec vos dates : seules les maisons correspondant à votre critère apparaissent. Si rien ne sort, essayez d’autres dates ou une autre ville.",
      en: "Availability depends on rooms and your dates. Run a search with your dates: only matching homes appear. If nothing shows, try other dates or another city.",
    },
  },
  {
    id: "room_types",
    keywords: [
      "chambre",
      "single",
      "double",
      "triple",
      "type de chambre",
      "room type",
      "capacite",
      "capacité",
      "combien de personnes",
    ],
    answers: {
      fr: "Le type de chambre est calculé selon le nombre d’adultes de votre recherche (1 → Single, 2 → Double, 3 → Triple, etc.). Le prix affiché correspond à ce type de chambre pour la saison en cours.",
      en: "Room type follows the number of adults in your search (1 → Single, 2 → Double, 3 → Triple, etc.). The displayed price matches that room type for the current season.",
    },
  },
  {
    id: "promo_code",
    keywords: [
      "promo",
      "code promo",
      "promotion",
      "reduction",
      "réduction",
      "discount",
      "coupon",
      "ete2026",
      "offre",
    ],
    answers: {
      fr: "Sur la page de réservation, saisissez votre code promo puis cliquez sur « Appliquer ». S’il est valide, la réduction s’applique sur le total TTC et les nouveaux prix s’affichent. Un code incorrect affiche « Code promo incorrect ».",
      en: "On the booking page, enter your promo code and click “Apply”. If valid, the discount applies to the TTC total and updated prices appear. An invalid code shows “Incorrect promo code”.",
    },
  },
  {
    id: "prices",
    keywords: [
      "prix",
      "tarif",
      "combien",
      "price",
      "cost",
      "cher",
      "nuit",
      "par nuit",
      "tva",
      "ttc",
      "ht",
    ],
    answers: {
      fr: "Les tarifs dépendent de la maison, de la saison, du type de chambre et des voyageurs (adultes, enfants, bébés, suppléments). Le récapitulatif affiche le détail HT, la TVA et le total TTC. Une réduction code promo s’applique sur le total TTC.",
      en: "Rates depend on the home, season, room type and guests (adults, children, infants, extras). The summary shows HT, VAT and TTC total. A promo discount applies on the TTC total.",
    },
  },
  {
    id: "payment",
    keywords: [
      "paiement",
      "payer",
      "payment",
      "carte",
      "especes",
      "espèces",
      "acompte",
      "solde",
      "virement",
      "paypal",
      "cb",
      "credit card",
    ],
    answers: {
      fr: "Les modalités de paiement (acompte, solde, espèces ou carte) sont confirmées avec la maison d’hôtes après validation de votre réservation. Le statut de paiement apparaît ensuite sur votre fiche.",
      en: "Payment terms (deposit, balance, cash or card) are confirmed with the guesthouse after your reservation is validated. Payment status then appears on your booking record.",
    },
  },
  {
    id: "status_pending",
    keywords: [
      "en attente",
      "pending",
      "statut",
      "status",
      "confirmee",
      "confirmée",
      "confirmation",
      "validee",
      "validée",
      "ma reservation",
      "suivre",
    ],
    answers: {
      fr: "Après envoi, votre réservation est « en attente » jusqu’à confirmation par la maison. Une fois validée, le statut passe à « confirmée ». Gardez votre référence pour le suivi auprès du support ou de l’établissement.",
      en: "After submit, your booking is “pending” until the property confirms it. Once validated, status becomes “confirmed”. Keep your reference to follow up with support or the property.",
    },
  },
  {
    id: "cancel_modify",
    keywords: [
      "annuler",
      "annulation",
      "modifier",
      "modification",
      "cancel",
      "change booking",
      "changer dates",
      "remboursement",
      "refund",
    ],
    answers: {
      fr: "Oui, selon les conditions de la maison. Contactez le support ou l’établissement avec votre référence de réservation pour toute modification, annulation ou remboursement.",
      en: "Yes, depending on the home’s policy. Contact support or the property with your reservation reference for any change, cancellation or refund.",
    },
  },
  {
    id: "currency",
    keywords: [
      "devise",
      "currency",
      "mad",
      "eur",
      "usd",
      "euro",
      "dollar",
      "dirham",
      "conversion",
      "changer devise",
    ],
    answers: {
      fr: "Vous pouvez afficher les tarifs en MAD, EUR ou USD via le sélecteur de devise en haut à droite. Les montants convertis sont indicatifs ; le règlement se fait selon les conditions de la maison.",
      en: "You can display prices in MAD, EUR or USD via the currency selector at the top right. Converted amounts are indicative; settlement follows the property’s terms.",
    },
  },
  {
    id: "babies_children",
    keywords: [
      "bebe",
      "bébé",
      "enfant",
      "enfants",
      "baby",
      "infant",
      "child",
      "children",
      "lit bebe",
      "lit bébé",
      "age",
      "âge",
    ],
    answers: {
      fr: "Dans la recherche, indiquez le nombre d’enfants (2–12 ans) et de bébés (moins de 2 ans) avec leur âge. Sur la page réservation, un lit bébé peut être demandé s’il en reste. Les tarifs enfants dépendent des tranches d’âge de la maison.",
      en: "In search, enter children (ages 2–12) and infants (under 2) with their ages. On the booking page, a baby bed can be requested if stock remains. Child rates follow the property’s age brackets.",
    },
  },
  {
    id: "checkin_checkout",
    keywords: [
      "check in",
      "check-in",
      "check out",
      "check-out",
      "arrivee",
      "arrivée",
      "depart",
      "départ",
      "heure",
      "horaires",
      "a quelle heure",
    ],
    answers: {
      fr: "Les horaires de check-in et check-out sont indiqués sur chaque fiche maison (souvent vers 14:00 à l’arrivée et 12:00 au départ). Vérifiez le détail avant de réserver.",
      en: "Check-in and check-out times are shown on each home’s details (often around 2:00 pm arrival and 12:00 pm departure). Check the listing before booking.",
    },
  },
  {
    id: "documents",
    keywords: [
      "piece identite",
      "pièce identité",
      "passeport",
      "cin",
      "passport",
      "id card",
      "documents",
      "papier",
    ],
    answers: {
      fr: "Lors de la réservation, une pièce d’identité peut être demandée pour les adultes. Présentez aussi vos documents à l’arrivée selon les règles de la maison d’hôtes.",
      en: "During booking, an ID document may be requested for adults. Also bring your ID on arrival as required by the guesthouse.",
    },
  },
  {
    id: "reviews",
    keywords: [
      "avis",
      "review",
      "temoignage",
      "témoignage",
      "commentaire",
      "noter",
      "note",
      "etoiles",
      "étoiles",
      "stars",
      "laisser un avis",
    ],
    answers: {
      fr: "Pour laisser un avis : section « Partagez votre expérience », choisissez la maison, donnez une note et écrivez votre commentaire. Il sera publié après validation par l’équipe.",
      en: "To leave a review: go to “Share your experience”, choose the home, rate it and write your comment. It will appear after team validation.",
    },
  },
  {
    id: "verified",
    keywords: [
      "verifie",
      "vérifié",
      "verified",
      "fiable",
      "confiance",
      "securite",
      "sécurité",
      "arnaque",
      "safe",
    ],
    answers: {
      fr: "Les maisons affichées sont sélectionnées et présentées comme « Maison vérifiée » sur la plateforme. Photos, description et services sont fournis par l’établissement et contrôlés côté équipe.",
      en: "Listed homes are curated and shown as “Verified home” on the platform. Photos, description and amenities come from the property and are reviewed by the team.",
    },
  },
  {
    id: "destinations",
    keywords: [
      "destination",
      "ville",
      "marrakech",
      "fes",
      "fès",
      "essaouira",
      "chefchaouen",
      "merzouga",
      "mhamid",
      "m'hamid",
      "dades",
      "dadès",
      "tanger",
      "riad",
      "ou aller",
      "où aller",
      "where to go",
    ],
    answers: {
      fr: "Les destinations du menu correspondent aux villes des maisons actives. Choisissez une ville dans Destinations ou tapez-la dans la recherche pour voir les maisons disponibles.",
      en: "Menu destinations match cities of active homes. Pick a city in Destinations or type it in search to see available guesthouses.",
    },
  },
  {
    id: "services",
    keywords: [
      "wifi",
      "petit dejeuner",
      "petit-déjeuner",
      "breakfast",
      "parking",
      "piscine",
      "spa",
      "hammam",
      "navette",
      "aeroport",
      "aéroport",
      "services",
      "equipements",
      "équipements",
      "amenities",
    ],
    answers: {
      fr: "Chaque fiche maison liste les services et équipements (Wi‑Fi, petit-déjeuner, navette, spa…). Ouvrez « Détails » ou « Voir » sur une carte pour le détail complet.",
      en: "Each home listing shows services and amenities (Wi‑Fi, breakfast, shuttle, spa…). Open “Details” or “View” on a card for the full list.",
    },
  },
  {
    id: "pets",
    keywords: ["animal", "chien", "chat", "pet", "pets", "animaux"],
    answers: {
      fr: "L’accueil des animaux dépend de chaque maison. Vérifiez les détails de l’établissement ou contactez le support / WhatsApp avant de réserver.",
      en: "Pets depend on each property’s policy. Check the listing details or contact support / WhatsApp before booking.",
    },
  },
  {
    id: "language",
    keywords: [
      "langue",
      "language",
      "francais",
      "français",
      "english",
      "anglais",
      "traduction",
      "arabe",
    ],
    answers: {
      fr: "Le site est disponible en français et en anglais via le sélecteur FR / EN dans la barre de navigation.",
      en: "The site is available in French and English via the FR / EN selector in the navigation bar.",
    },
  },
  {
    id: "group",
    keywords: [
      "groupe",
      "group",
      "famille",
      "family",
      "plusieurs chambres",
      "many rooms",
      "wedding",
      "mariage",
    ],
    answers: {
      fr: "Pour un groupe ou plusieurs chambres, lancez une recherche adaptée au nombre d’adultes, ou contactez-nous sur WhatsApp pour une demande spéciale auprès de la maison.",
      en: "For a group or several rooms, run a search matching your adult count, or contact us on WhatsApp for a special request with the property.",
    },
  },
  {
    id: "whatsapp_support",
    keywords: [
      "whatsapp",
      "wtsp",
      "watsapp",
      "contact",
      "support",
      "aide",
      "help",
      "concierge",
      "telephone",
      "téléphone",
      "phone",
      "instagram",
      "tiktok",
      "joindre",
      "ecrire",
      "écrire",
    ],
    answers: {
      fr: "Pour un échange rapide, utilisez le bouton WhatsApp (icône à droite / en haut). Vous pouvez aussi nous suivre sur Instagram et TikTok. Indiquez idéalement votre référence de réservation.",
      en: "For a quick chat, use the WhatsApp button (icon on the right / top). You can also follow us on Instagram and TikTok. Ideally share your reservation reference.",
    },
  },
  {
    id: "hours_support",
    keywords: [
      "24/7",
      "24 h",
      "horaire support",
      "disponible",
      "quand repondre",
      "response time",
    ],
    answers: {
      fr: "Notre conciergerie accompagne les voyageurs avant et pendant le séjour. Pour une réponse rapide, privilégiez WhatsApp via le bouton dédié sur le site.",
      en: "Our concierge team helps travelers before and during the stay. For a fast reply, prefer WhatsApp via the dedicated button on the site.",
    },
  },
  {
    id: "reference",
    keywords: [
      "reference",
      "référence",
      "numero reservation",
      "numéro réservation",
      "booking number",
      "res-",
    ],
    answers: {
      fr: "Après création, chaque réservation a une référence (ex. RES-20260714-0001). Conservez-la pour le paiement, le check-in et tout contact avec le support ou la maison.",
      en: "After creation, each booking has a reference (e.g. RES-20260714-0001). Keep it for payment, check-in and any contact with support or the property.",
    },
  },
  {
    id: "thanks",
    keywords: [
      "merci",
      "thanks",
      "thank you",
      "super",
      "parfait",
      "ok",
      "daccord",
      "d'accord",
      "cool",
      "genial",
      "génial",
    ],
    answers: {
      fr: "Avec plaisir ! Si vous avez une autre question sur Maroc Résidences, je suis là.",
      en: "You’re welcome! If you have another question about Maroc Résidences, I’m here.",
    },
  },
  {
    id: "bye",
    keywords: ["au revoir", "bye", "goodbye", "a bientot", "à bientôt", "ciao"],
    answers: {
      fr: "À bientôt et bon séjour au Maroc avec Maroc Résidences !",
      en: "See you soon — enjoy your stay in Morocco with Maroc Résidences!",
    },
  },
];

const FALLBACK: Record<ChatLanguage, string> = {
  fr: "Je n’ai pas bien saisi. Essayez par exemple : « comment réserver », « code promo », « lit bébé », « paiement », « avis », « check-in » ou « contact ». Ou écrivez-nous sur WhatsApp.",
  en: "I didn’t quite catch that. Try asking about “how to book”, “promo code”, “baby bed”, “payment”, “reviews”, “check-in”, or “contact”. Or reach us on WhatsApp.",
};

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Score user message against the trained knowledge base. */
export function answerChatbot(message: string, language: ChatLanguage): string {
  const normalized = normalize(message);

  if (!normalized) {
    return language === "fr"
      ? "Écrivez votre question et je vous réponds."
      : "Type your question and I’ll answer.";
  }

  let best: { id: string; score: number } | null = null;

  for (const entry of CHATBOT_KNOWLEDGE) {
    let score = 0;

    for (const keyword of entry.keywords) {
      const key = normalize(keyword);
      if (!key) continue;

      if (normalized === key) {
        score += 6;
      } else if (normalized.includes(key)) {
        score += key.length > 4 ? 3 : 2;
      } else {
        const parts = key.split(" ").filter(Boolean);
        const hit = parts.filter((p) => normalized.includes(p)).length;
        if (parts.length > 1 && hit === parts.length) {
          score += 2;
        }
      }
    }

    if (score > 0 && (!best || score > best.score)) {
      best = { id: entry.id, score };
    }
  }

  if (!best || best.score < 2) {
    return FALLBACK[language];
  }

  const entry = CHATBOT_KNOWLEDGE.find((item) => item.id === best.id);
  return entry?.answers[language] ?? FALLBACK[language];
}

export const CHATBOT_SUGGESTIONS: Record<ChatLanguage, string[]> = {
  fr: [
    "Comment réserver ?",
    "Code promo",
    "Lit bébé",
    "Paiement",
    "Check-in / Check-out",
    "Laisser un avis",
    "Contact WhatsApp",
  ],
  en: [
    "How to book?",
    "Promo code",
    "Baby bed",
    "Payment",
    "Check-in / Check-out",
    "Leave a review",
    "WhatsApp contact",
  ],
};
