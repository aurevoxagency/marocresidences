import {
  calculateNights,
  type Reservation,
} from "@/lib/reservations";

export type ReservationDocumentLineType = "chambre" | "enfant" | "bebe" | "supplement";

export type ReservationDocumentLine = {
  type_item: ReservationDocumentLineType;
  chambre_id: number | null;
  tranche_age_id: number | null;
  supplement_id: number | null;
  description: string;
  quantite: number;
  prix_unitaire: number;
};

function dateOnly(value?: string | null) {
  return value ? String(value).slice(0, 10) : "";
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function buildDocumentLinesFromReservation(
  reservation: Reservation
): ReservationDocumentLine[] {
  const lines: ReservationDocumentLine[] = [];
  const nights = Math.max(
    1,
    Number(reservation.nb_nuits) ||
      calculateNights(dateOnly(reservation.date_arrivee), dateOnly(reservation.date_depart)) ||
      1
  );
  const chambreId = reservation.chambre_id || null;
  const chambreLabel = reservation.chambre_nom || `Chambre #${reservation.chambre_id}`;
  const adults = Math.max(0, Number(reservation.nb_adultes) || 0);
  const enfants = Math.max(0, Number(reservation.nbrs_enfants) || 0);
  const bebes = Math.max(0, Number(reservation.nbrs_bebe) || 0);
  const prixChambre = Number(reservation.prix_chambre_total) || 0;
  const prixEnfants = Number(reservation.prix_enfants_total) || 0;
  const prixBebe = Number(reservation.prix_bebe_total) || 0;
  const taxeSejour = Number(reservation.taxe_sejour_montant) || 0;

  if (prixChambre > 0 || chambreId) {
    lines.push({
      type_item: "chambre",
      chambre_id: chambreId,
      tranche_age_id: null,
      supplement_id: null,
      description: `Hébergement — ${chambreLabel} (${nights} nuit${nights > 1 ? "s" : ""}${
        adults ? ` · ${adults} adulte${adults > 1 ? "s" : ""}` : ""
      })`,
      quantite: nights,
      prix_unitaire: roundMoney(prixChambre / nights),
    });
  }

  if (prixEnfants > 0) {
    lines.push({
      type_item: "enfant",
      chambre_id: chambreId,
      tranche_age_id: null,
      supplement_id: null,
      description: `Enfants${enfants > 0 ? ` (${enfants})` : ""} · ${nights} nuit${
        nights > 1 ? "s" : ""
      }`,
      quantite: 1,
      prix_unitaire: roundMoney(prixEnfants),
    });
  }

  if (prixBebe > 0) {
    lines.push({
      type_item: "bebe",
      chambre_id: chambreId,
      tranche_age_id: null,
      supplement_id: null,
      description: `Bébés${bebes > 0 ? ` (${bebes})` : ""} · ${nights} nuit${
        nights > 1 ? "s" : ""
      }`,
      quantite: 1,
      prix_unitaire: roundMoney(prixBebe),
    });
  }

  for (const occupant of reservation.occupants || []) {
    if (!occupant.supplement_id) {
      continue;
    }

    const base = Number(occupant.prix_unitaire) || 0;
    const total = Number(occupant.prix_total) || 0;
    const supplementAmount = roundMoney(Math.max(0, total - base));

    if (supplementAmount <= 0) {
      continue;
    }

    const occupantLabel =
      [occupant.prenom, occupant.nom].filter(Boolean).join(" ") ||
      (occupant.type_occupant === "adulte"
        ? "Adulte"
        : occupant.type_occupant === "enfant"
          ? "Enfant"
          : "Bébé");

    lines.push({
      type_item: "supplement",
      chambre_id: chambreId,
      tranche_age_id: occupant.tranche_age_id ?? null,
      supplement_id: Number(occupant.supplement_id) || null,
      description: `${occupant.supplement_nom || "Supplément"} · ${occupantLabel}`,
      quantite: 1,
      prix_unitaire: supplementAmount,
    });
  }

  if (taxeSejour > 0) {
    lines.push({
      type_item: "supplement",
      chambre_id: chambreId,
      tranche_age_id: null,
      supplement_id: null,
      description: "Taxe de séjour",
      quantite: 1,
      prix_unitaire: roundMoney(taxeSejour),
    });
  }

  return lines;
}

export function buildNotesFromReservation(reservation: Reservation, currentNotes = "") {
  const parts: string[] = [];

  if (reservation.notes?.trim()) {
    parts.push(reservation.notes.trim());
  }

  if (reservation.code_promo?.trim()) {
    parts.push(`Code promo : ${reservation.code_promo.trim()}`);
  }

  if (
    reservation.type_reduction &&
    Number(reservation.valeur_reduction) > 0
  ) {
    parts.push(
      reservation.type_reduction === "%"
        ? `Réduction : ${reservation.valeur_reduction} %`
        : `Réduction : ${Number(reservation.valeur_reduction).toLocaleString("fr-FR")} MAD`
    );
  }

  if (Number(reservation.lit_bebe) === 1 || reservation.lit_bebe === true) {
    parts.push("Lit bébé demandé");
  }

  if (parts.length === 0) {
    return currentNotes;
  }

  const imported = parts.join(" · ");
  if (!currentNotes.trim()) {
    return imported;
  }

  return currentNotes.includes(imported) ? currentNotes : `${currentNotes.trim()}\n${imported}`;
}
