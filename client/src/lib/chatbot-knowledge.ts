export type ChatLanguage = "fr" | "en";

export type ChatKnowledgeEntry = {
  id: string;
  /** Keywords / phrases used for matching (lowercase). */
  keywords: string[];
  answers: Record<ChatLanguage, string>;
};

/**
 * Knowledge base for the Maroc Résidences homepage assistant.
 * Tuned on FAQ, booking flow, currency, reviews, and support intents.
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
    ],
    answers: {
      fr: "Bonjour ! Je suis l’assistant Maroc Résidences. Je peux vous aider pour la réservation, les paiements, les avis ou le support. Que souhaitez-vous savoir ?",
      en: "Hello! I’m the Maroc Résidences assistant. I can help with booking, payments, reviews, or support. What would you like to know?",
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
      "register",
      "inscription",
      "sans compte",
      "without account",
    ],
    answers: {
      fr: "Pour réserver une maison d’hôtes, vous devez créer un compte ou vous connecter. Cela sécurise votre demande et vous permet de suivre votre réservation.",
      en: "To book a guesthouse, you need to create an account or sign in. This secures your request and lets you track your reservation.",
    },
  },
  {
    id: "booking_flow",
    keywords: [
      "réserver",
      "reservation",
      "réservation",
      "booking",
      "book",
      "comment réserver",
      "how to book",
      "chambre",
      "disponib",
    ],
    answers: {
      fr: "Pour réserver : 1) recherchez une destination ou une maison, 2) cliquez sur Réserver, 3) connectez-vous si besoin, 4) choisissez les dates, la chambre et les voyageurs. Votre demande est enregistrée « en attente » jusqu’à confirmation.",
      en: "To book: 1) search a destination or home, 2) click Book, 3) sign in if needed, 4) choose dates, room and guests. Your request is saved as “pending” until confirmation.",
    },
  },
  {
    id: "payment",
    keywords: [
      "paiement",
      "payer",
      "payment",
      "carte",
      "espèces",
      "acompte",
      "solde",
      "price",
      "prix",
      "tarif",
    ],
    answers: {
      fr: "Les modalités de paiement (acompte, solde, espèces ou carte) sont confirmées avec la maison d’hôtes après validation de votre réservation.",
      en: "Payment terms (deposit, balance, cash or card) are confirmed with the guesthouse after your reservation is validated.",
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
      "change",
      "remboursement",
      "refund",
    ],
    answers: {
      fr: "Oui, selon les conditions de la maison. Contactez le support ou l’établissement avec votre référence de réservation pour toute modification ou annulation.",
      en: "Yes, depending on the home’s policy. Contact support or the property with your reservation reference for any change or cancellation.",
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
    ],
    answers: {
      fr: "Vous pouvez afficher les tarifs en MAD, EUR ou USD via le sélecteur de devise en haut à droite. Les montants convertis sont indicatifs.",
      en: "You can display prices in MAD, EUR or USD via the currency selector at the top right. Converted amounts are indicative.",
    },
  },
  {
    id: "reviews",
    keywords: [
      "avis",
      "review",
      "témoignage",
      "commentaire",
      "noter",
      "note",
      "étoiles",
      "stars",
    ],
    answers: {
      fr: "Pour laisser un avis : allez dans la section « Partagez votre expérience », choisissez la maison, donnez une note et écrivez votre commentaire. Il sera publié après validation.",
      en: "To leave a review: go to “Share your experience”, choose the home, rate it and write your comment. It will appear after validation.",
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
      "riad",
      "où",
      "where",
    ],
    answers: {
      fr: "Parcourez la section Destinations ou utilisez la barre de recherche du hero pour trouver une ville ou une maison d’hôtes. Les maisons affichées sont vérifiées sur la plateforme.",
      en: "Browse the Destinations section or use the hero search bar to find a city or guesthouse. Listed homes are verified on the platform.",
    },
  },
  {
    id: "language",
    keywords: ["langue", "language", "français", "english", "anglais", "traduction"],
    answers: {
      fr: "Vous pouvez passer le site en français ou en anglais via le sélecteur FR / EN dans la barre de navigation.",
      en: "You can switch the site between French and English via the FR / EN selector in the navigation bar.",
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
      "téléphone",
      "phone",
    ],
    answers: {
      fr: "Pour un échange rapide, utilisez le bouton WhatsApp en haut à droite de la page. Vous pouvez aussi nous suivre sur Instagram et TikTok.",
      en: "For a quick chat, use the WhatsApp button at the top right. You can also follow us on Instagram and TikTok.",
    },
  },
  {
    id: "thanks",
    keywords: ["merci", "thanks", "thank you", "super", "parfait", "ok"],
    answers: {
      fr: "Avec plaisir ! Si vous avez une autre question sur Maroc Résidences, je suis là.",
      en: "You’re welcome! If you have another question about Maroc Résidences, I’m here.",
    },
  },
];

const FALLBACK: Record<ChatLanguage, string> = {
  fr: "Je n’ai pas bien saisi. Essayez par exemple : « comment réserver », « paiement », « avis », « devise » ou « contact ». Ou écrivez-nous sur WhatsApp via le bouton en haut à droite.",
  en: "I didn’t quite catch that. Try asking about “how to book”, “payment”, “reviews”, “currency”, or “contact”. Or reach us on WhatsApp via the top-right button.",
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
  fr: ["Comment réserver ?", "Paiement", "Laisser un avis", "Contact"],
  en: ["How to book?", "Payment", "Leave a review", "Contact"],
};
