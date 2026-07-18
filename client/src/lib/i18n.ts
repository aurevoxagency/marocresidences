export type AppLanguage = "fr" | "en";

export const LANGUAGE_OPTIONS: Array<{ code: AppLanguage; label: string }> = [
  { code: "fr", label: "FR" },
  { code: "en", label: "EN" },
];

const STORAGE_KEY = "marocresidences.language";

export function isAppLanguage(value: unknown): value is AppLanguage {
  return value === "fr" || value === "en";
}

export function getStoredLanguage(): AppLanguage {
  if (typeof window === "undefined") {
    return "fr";
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  return isAppLanguage(raw) ? raw : "fr";
}

export function storeLanguage(language: AppLanguage) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, language);
}

const fr = {
  nav: {
    destinations: "Destinations",
    maisons: "Maisons",
    experiences: "Expériences",
    avis: "Avis",
    faq: "FAQ",
    aide: "Aide",
    login: "Se connecter",
    logout: "Se déconnecter",
    currency: "Devise",
    language: "Langue",
  },
  hero: {
    titleLine1: "L'art de séjourner",
    titleLine2: "au Maroc.",
    subtitle:
      "Des riads et maisons d'hôtes vérifiés, choisis un à un pour vous offrir une hospitalité qui ne s'oublie pas.",
    heroAlt: "Riad marocain au coucher du soleil",
  },
  search: {
    destination: "Destination",
    destinationPlaceholder: "Ville, quartier, riad…",
    dates: "Dates",
    datesPlaceholder: "Arrivée — Départ",
    travelers: "Voyageurs",
    adults: "Adultes",
    adultsHint: "13 ans et plus",
    children: "Enfants",
    childrenHint: "2 à 12 ans",
    babies: "Bébés",
    babiesHint: "Moins de 2 ans",
    childAge: "Âge de l'enfant",
    babyAge: "Âge du bébé",
    underOne: "Moins d'1 an",
    oneYear: "1 an",
    years: (n: number) => `${n} an${n > 1 ? "s" : ""}`,
    validate: "Valider",
    search: "Rechercher",
    errorDestination: "Indiquez une destination.",
    errorDates: "Choisissez vos dates d’arrivée et de départ.",
    errorTravelers: "Indiquez au moins un adulte.",
    errorAges: "Indiquez l’âge de chaque enfant et bébé.",
    chooseAge: "Choisir l’âge",
    adult: (n: number) => `${n} adulte${n > 1 ? "s" : ""}`,
    child: (n: number) => `${n} enfant${n > 1 ? "s" : ""}`,
    baby: (n: number) => `${n} bébé${n > 1 ? "s" : ""}`,
  },
  results: {
    eyebrow: "Résultats de recherche",
    titleDestination: (city: string) => `Maisons à ${city}`,
    titleDefault: "Maisons d'hôtes disponibles",
    loading: "Recherche en cours…",
    loadingSubtitle: "Nous sélectionnons les maisons d'hôtes qui correspondent à votre séjour.",
    loadingStages: [
      "Analyse de votre destination",
      "Vérification des disponibilités",
      "Sélection des meilleurs riads",
      "Presque prêt…",
    ],
    empty: "Aucune maison ne correspond à votre recherche.",
    capacityOk: "Capacité OK",
    verified: "Maison vérifiée",
    pricingFrom: "À partir de",
    perNightAdult: "/ nuit / adulte",
    perNightRoom: (type: string) => `/ nuit · ${type}`,
    roomType: (n: number) => {
      const labels: Record<number, string> = {
        1: "Single",
        2: "Double",
        3: "Triple",
        4: "Quadruple",
        5: "Quintuple",
      };
      return labels[n] || `Capacité ${n}`;
    },
    details: "Détails",
    book: "Réserver",
    selection: (n: number) => `Sélection #${n}`,
    new: "Nouveau",
    defaultDescription:
      "Maison d'hôtes sélectionnée pour son accueil, son cadre et son authenticité marocaine.",
    rooms: "Chambres",
    capacity: "Capacité",
    childAges: "âges enfants",
    babyAges: "âges bébés",
    fromTo: (a: string, b: string) => `du ${a} au ${b}`,
  },
  destinations: {
    eyebrow: "Destinations populaires",
    title: "Là où le Maroc vous appelle.",
    explore: "Explorer toutes les destinations",
    empty: "Aucune maison d’hôtes disponible pour le moment.",
    guestHouse: "Maison d’hôtes",
    guestHouses: "Maisons d’hôtes",
    count: (n: number) =>
      n > 1 ? `${n} maisons d’hôtes` : `${n} maison d’hôtes`,
  },
  houses: {
    eyebrow: "Maisons d'hôtes recommandées",
    title: "Un art de vivre, choisi avec soin.",
    seeAll: "Voir toutes les maisons",
    empty: "Aucune maison d’hôtes disponible pour le moment.",
    perNightAdult: "/ nuit / adulte",
    onRequest: (currency: string) => `Tarif sur demande · ${currency}`,
    view: "Voir",
    seeAvailabilities: "Voir les disponibilités",
  },
  advantages: {
    eyebrow: "Pourquoi Maroc Residences",
    title: "La confiance, comme un art d'accueil.",
    items: [
      {
        title: "Réservation sécurisée",
        desc: "Paiement chiffré, garantie voyageur et remboursement intégral en cas d'annulation éligible.",
      },
      {
        title: "Maisons vérifiées",
        desc: "Chaque riad est visité par notre équipe locale. Photos réelles, standards contrôlés.",
      },
      {
        title: "Support 24 / 7",
        desc: "Une conciergerie francophone et arabophone disponible à toute heure, avant et pendant le séjour.",
      },
    ],
  },
  howItWorks: {
    eyebrow: "Comment ça marche",
    title: "Réservez votre séjour en trois étapes.",
    subtitle: "Un parcours simple, clair et sécurisé — de la recherche à la confirmation.",
    steps: [
      {
        title: "Choisissez votre destination",
        desc: "Indiquez la ville, vos dates et le nombre de voyageurs. Nous affichons les maisons d’hôtes disponibles.",
      },
      {
        title: "Sélectionnez votre maison",
        desc: "Comparez photos, horaires, services et tarifs. Ouvrez la fiche pour voir tous les détails.",
      },
      {
        title: "Confirmez votre réservation",
        desc: "Choisissez le paiement en ligne ou à l’arrivée. Votre demande est envoyée, puis confirmée par l’équipe.",
      },
    ],
    cta: "Lancer ma recherche",
  },
  practical: {
    eyebrow: "Infos pratiques",
    title: "Tout ce qu’il faut pour arriver serein.",
    subtitle: "Les points essentiels avant, pendant et après votre séjour.",
    items: [
      {
        title: "Paiement flexible",
        desc: "Payez en ligne ou à l’arrivée selon l’option choisie lors de la réservation.",
      },
      {
        title: "Check-in & check-out",
        desc: "Les horaires sont indiqués sur chaque fiche. Arrivez un peu plus tôt ? Prévenez la maison.",
      },
      {
        title: "Annulation claire",
        desc: "Les conditions dépendent de la maison. Conservez votre référence pour toute modification.",
      },
      {
        title: "Assistance dédiée",
        desc: "Notre équipe vous accompagne avant et pendant le séjour, en français ou en anglais.",
      },
    ],
    faqLink: "Voir la FAQ",
  },
  testimonials: {
    eyebrow: "Ils ont voyagé avec nous",
    title: "Des séjours qui laissent une trace.",
    guestFallback: "Voyageur",
    empty: "Les avis publiés apparaîtront ici bientôt.",
  },
  avis: {
    eyebrow: "Votre avis compte",
    title: "Partagez votre expérience.",
    subtitle:
      "Après un séjour, laissez un commentaire pour aider d’autres voyageurs à choisir leur prochaine maison d’hôtes.",
    name: "Nom",
    namePlaceholder: "Votre nom",
    email: "Email",
    maison: "Maison d’hôtes",
    maisonPlaceholder: "Choisir une maison",
    rating: "Note",
    titleOptional: "Titre (optionnel)",
    titlePlaceholder: "Ex. Un séjour inoubliable",
    comment: "Votre avis",
    commentPlaceholder:
      "Parlez-nous de l’accueil, de la maison, de votre expérience…",
    submit: "Publier mon avis",
    submitting: "Envoi…",
    errorRequired:
      "Veuillez renseigner votre nom, email, la maison et votre avis.",
    errorLength: "Votre avis doit contenir au moins 20 caractères.",
    thanksTitle: "Merci pour votre avis",
    thanksBody:
      "Votre retour a bien été envoyé. Il apparaîtra après validation par l’équipe.",
    another: "Laisser un autre avis",
  },
  faq: {
    eyebrow: "Questions fréquentes",
    title: "Tout ce qu’il faut savoir.",
    subtitle:
      "Les réponses aux questions les plus posées avant de réserver votre séjour.",
    items: [
      {
        question: "Puis-je réserver sans me connecter ?",
        answer:
          "Non. Pour réserver une maison d’hôtes, vous devez d’abord créer un compte ou vous connecter. Cela permet de sécuriser votre demande et de suivre votre réservation.",
      },
      {
        question: "Comment fonctionne une réservation ?",
        answer:
          "Recherchez une maison, cliquez sur Réserver, connectez-vous si besoin, choisissez votre chambre et renseignez les voyageurs. Votre demande est ensuite enregistrée avec le statut « en attente » jusqu’à confirmation.",
      },
      {
        question: "Quels moyens de paiement acceptez-vous ?",
        answer:
          "Les modalités de paiement (acompte, solde, espèces ou carte) sont confirmées avec la maison d’hôtes après validation de votre réservation.",
      },
      {
        question: "Puis-je modifier ou annuler ma réservation ?",
        answer:
          "Oui, selon les conditions de la maison. Contactez le support ou l’établissement concerné avec votre référence de réservation pour toute modification ou annulation.",
      },
      {
        question: "Les prix changent-ils selon la devise ?",
        answer:
          "Oui. Vous pouvez afficher les tarifs en MAD, EUR ou USD via le sélecteur de devise dans la barre de navigation. Le montant affiché est une conversion indicative.",
      },
      {
        question: "Comment laisser un avis après mon séjour ?",
        answer:
          "Rendez-vous dans la section Avis, choisissez la maison, donnez une note et partagez votre expérience. Vos retours aident les prochains voyageurs.",
      },
    ],
  },
  cta: {
    title: "Votre prochain riad n'attend plus que vous.",
    subtitle: "Réservez en trois clics et laissez-vous accueillir comme un invité d'honneur.",
    button: "Commencer ma recherche",
    concierge: "Parler à un concierge",
  },
  footer: {
    tagline: "L'hospitalité marocaine, réinventée pour les voyageurs exigeants.",
    explorer: "Explorer",
    hosts: "Hôtes",
    about: "À propos",
    explorerItems: ["Destinations", "Maisons d'hôtes", "Expériences", "Cadeaux"],
    hostsItems: ["Publier un riad", "Ressources", "Charte qualité"],
    aboutItems: ["Notre histoire", "Presse", "Contact", "Aide"],
    rights: "Tous droits réservés.",
    privacy: "Confidentialité",
    terms: "CGU",
    cookies: "Cookies",
  },
  authBooking:
    "Pour réserver cette maison, créez un compte ou connectez-vous d’abord.",
};

const en = {
  nav: {
    destinations: "Destinations",
    maisons: "Homes",
    experiences: "Experiences",
    avis: "Reviews",
    faq: "FAQ",
    aide: "Help",
    login: "Sign in",
    logout: "Sign out",
    currency: "Currency",
    language: "Language",
  },
  hero: {
    titleLine1: "The art of staying",
    titleLine2: "in Morocco.",
    subtitle:
      "Verified riads and guesthouses, hand-picked to offer hospitality you will never forget.",
    heroAlt: "Moroccan riad at sunset",
  },
  search: {
    destination: "Destination",
    destinationPlaceholder: "City, neighborhood, riad…",
    dates: "Dates",
    datesPlaceholder: "Check-in — Check-out",
    travelers: "Guests",
    adults: "Adults",
    adultsHint: "Ages 13+",
    children: "Children",
    childrenHint: "Ages 2–12",
    babies: "Infants",
    babiesHint: "Under 2",
    childAge: "Child's age",
    babyAge: "Infant's age",
    underOne: "Under 1 year",
    oneYear: "1 year",
    years: (n: number) => `${n} year${n > 1 ? "s" : ""}`,
    validate: "Done",
    search: "Search",
    errorDestination: "Enter a destination.",
    errorDates: "Choose your check-in and check-out dates.",
    errorTravelers: "Add at least one adult.",
    errorAges: "Select the age of each child and infant.",
    chooseAge: "Select age",
    adult: (n: number) => `${n} adult${n > 1 ? "s" : ""}`,
    child: (n: number) => `${n} child${n > 1 ? "ren" : ""}`,
    baby: (n: number) => `${n} infant${n > 1 ? "s" : ""}`,
  },
  results: {
    eyebrow: "Search results",
    titleDestination: (city: string) => `Homes in ${city}`,
    titleDefault: "Available guesthouses",
    loading: "Searching…",
    loadingSubtitle: "We're selecting the guesthouses that match your stay.",
    loadingStages: [
      "Analyzing your destination",
      "Checking availability",
      "Curating the finest riads",
      "Almost ready…",
    ],
    empty: "No homes match your search.",
    capacityOk: "Capacity OK",
    verified: "Verified home",
    pricingFrom: "From",
    perNightAdult: "/ night / adult",
    perNightRoom: (type: string) => `/ night · ${type}`,
    roomType: (n: number) => {
      const labels: Record<number, string> = {
        1: "Single",
        2: "Double",
        3: "Triple",
        4: "Quadruple",
        5: "Quintuple",
      };
      return labels[n] || `Capacity ${n}`;
    },
    details: "Details",
    book: "Book",
    selection: (n: number) => `Pick #${n}`,
    new: "New",
    defaultDescription:
      "A guesthouse chosen for its welcome, setting, and Moroccan authenticity.",
    rooms: "Rooms",
    capacity: "Capacity",
    childAges: "children ages",
    babyAges: "infant ages",
    fromTo: (a: string, b: string) => `from ${a} to ${b}`,
  },
  destinations: {
    eyebrow: "Popular destinations",
    title: "Where Morocco calls you.",
    explore: "Explore all destinations",
    empty: "No guesthouses available right now.",
    guestHouse: "Guesthouse",
    guestHouses: "Guesthouses",
    count: (n: number) =>
      n > 1 ? `${n} guesthouses` : `${n} guesthouse`,
  },
  houses: {
    eyebrow: "Recommended guesthouses",
    title: "A way of living, carefully chosen.",
    seeAll: "See all homes",
    empty: "No guesthouses available right now.",
    perNightAdult: "/ night / adult",
    onRequest: (currency: string) => `Price on request · ${currency}`,
    view: "View",
    seeAvailabilities: "See availability",
  },
  advantages: {
    eyebrow: "Why Maroc Residences",
    title: "Trust, as an art of hospitality.",
    items: [
      {
        title: "Secure booking",
        desc: "Encrypted payment, traveler protection, and full refund when cancellation is eligible.",
      },
      {
        title: "Verified homes",
        desc: "Every riad is visited by our local team. Real photos, controlled standards.",
      },
      {
        title: "24 / 7 support",
        desc: "French and Arabic-speaking concierge available any time, before and during your stay.",
      },
    ],
  },
  howItWorks: {
    eyebrow: "How it works",
    title: "Book your stay in three steps.",
    subtitle: "A simple, clear and secure path — from search to confirmation.",
    steps: [
      {
        title: "Choose your destination",
        desc: "Enter the city, your dates and travelers. We show available guesthouses.",
      },
      {
        title: "Pick your home",
        desc: "Compare photos, schedules, amenities and rates. Open the details page for the full picture.",
      },
      {
        title: "Confirm your booking",
        desc: "Pay online or on arrival. Your request is sent, then confirmed by the team.",
      },
    ],
    cta: "Start my search",
  },
  practical: {
    eyebrow: "Practical info",
    title: "Everything you need for a smooth arrival.",
    subtitle: "The essentials before, during and after your stay.",
    items: [
      {
        title: "Flexible payment",
        desc: "Pay online or on arrival, depending on the option you choose when booking.",
      },
      {
        title: "Check-in & check-out",
        desc: "Times are listed on each home page. Arriving early? Just let the host know.",
      },
      {
        title: "Clear cancellation",
        desc: "Policies depend on each home. Keep your booking reference for any change.",
      },
      {
        title: "Dedicated support",
        desc: "Our team assists you before and during your stay, in French or English.",
      },
    ],
    faqLink: "See the FAQ",
  },
  testimonials: {
    eyebrow: "They traveled with us",
    title: "Stays that leave a mark.",
    guestFallback: "Traveler",
    empty: "Published reviews will appear here soon.",
  },
  avis: {
    eyebrow: "Your review matters",
    title: "Share your experience.",
    subtitle:
      "After your stay, leave a comment to help other travelers choose their next guesthouse.",
    name: "Name",
    namePlaceholder: "Your name",
    email: "Email",
    maison: "Guesthouse",
    maisonPlaceholder: "Choose a home",
    rating: "Rating",
    titleOptional: "Title (optional)",
    titlePlaceholder: "e.g. An unforgettable stay",
    comment: "Your review",
    commentPlaceholder:
      "Tell us about the welcome, the home, your experience…",
    submit: "Publish my review",
    submitting: "Sending…",
    errorRequired: "Please enter your name, email, the home, and your review.",
    errorLength: "Your review must contain at least 20 characters.",
    thanksTitle: "Thank you for your review",
    thanksBody:
      "Your feedback has been sent. It will appear after our team validates it.",
    another: "Leave another review",
  },
  faq: {
    eyebrow: "Frequently asked questions",
    title: "Everything you need to know.",
    subtitle: "Answers to the most common questions before booking your stay.",
    items: [
      {
        question: "Can I book without signing in?",
        answer:
          "No. To book a guesthouse, you must first create an account or sign in. This secures your request and lets you track your reservation.",
      },
      {
        question: "How does booking work?",
        answer:
          "Search for a home, click Book, sign in if needed, choose your room, and enter guest details. Your request is then saved as “pending” until confirmation.",
      },
      {
        question: "What payment methods do you accept?",
        answer:
          "Payment terms (deposit, balance, cash, or card) are confirmed with the guesthouse after your reservation is validated.",
      },
      {
        question: "Can I change or cancel my reservation?",
        answer:
          "Yes, depending on the home’s policy. Contact support or the property with your reservation reference for any change or cancellation.",
      },
      {
        question: "Do prices change with currency?",
        answer:
          "Yes. You can display rates in MAD, EUR, or USD via the currency selector in the navbar. Shown amounts are indicative conversions.",
      },
      {
        question: "How do I leave a review after my stay?",
        answer:
          "Go to the Reviews section, choose the home, give a rating, and share your experience. Your feedback helps future travelers.",
      },
    ],
  },
  cta: {
    title: "Your next riad is waiting for you.",
    subtitle: "Book in three clicks and be welcomed like a guest of honour.",
    button: "Start my search",
    concierge: "Talk to a concierge",
  },
  footer: {
    tagline: "Moroccan hospitality, reinvented for discerning travelers.",
    explorer: "Explore",
    hosts: "Hosts",
    about: "About",
    explorerItems: ["Destinations", "Guesthouses", "Experiences", "Gifts"],
    hostsItems: ["List a riad", "Resources", "Quality charter"],
    aboutItems: ["Our story", "Press", "Contact", "Help"],
    rights: "All rights reserved.",
    privacy: "Privacy",
    terms: "Terms",
    cookies: "Cookies",
  },
  authBooking: "To book this home, create an account or sign in first.",
};

export type HomeTranslations = typeof fr;

export const homeTranslations: Record<AppLanguage, HomeTranslations> = {
  fr,
  en,
};
