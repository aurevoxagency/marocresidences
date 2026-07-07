import { jsPDF } from "jspdf";

import { resolvePhotoUrl, type MaisonDetail, type MaisonListItem } from "@/lib/maisons";
import type { Reservation, ReservationSource, ReservationStatut, ReservationStatutPaiement } from "@/lib/reservations";

const STATUT_LABELS: Record<ReservationStatut, string> = {
  en_attente: "En attente",
  confirmee: "Confirmée",
  annulee: "Annulée",
  terminee: "Terminée",
  no_show: "No-show",
};

const PAIEMENT_LABELS: Record<ReservationStatutPaiement, string> = {
  non_paye: "Non payé",
  acompte_paye: "Acompte payé",
  paye_totalement: "Payé totalement",
  rembourse: "Remboursé",
};

const SOURCE_LABELS: Record<ReservationSource, string> = {
  site_web: "Site web",
  booking: "Booking",
  airbnb: "Airbnb",
  agence: "Agence",
  telephone: "Téléphone",
  walk_in: "Walk-in",
  autre: "Autre",
};

const COLORS = {
  olive: [74, 85, 55] as const,
  oliveDark: [52, 62, 40] as const,
  terracotta: [196, 114, 74] as const,
  ink: [58, 52, 42] as const,
  muted: [118, 108, 94] as const,
  border: [218, 208, 192] as const,
  cream: [252, 248, 242] as const,
  sand: [244, 236, 224] as const,
  white: [255, 255, 255] as const,
};

const MARGIN = 16;
const CONTENT_WIDTH = 210 - MARGIN * 2;

type Rgb = readonly [number, number, number];

function setFill(doc: jsPDF, color: Rgb) {
  doc.setFillColor(color[0], color[1], color[2]);
}

function setDraw(doc: jsPDF, color: Rgb) {
  doc.setDrawColor(color[0], color[1], color[2]);
}

function setText(doc: jsPDF, color: Rgb) {
  doc.setTextColor(color[0], color[1], color[2]);
}

function formatDateDisplay(value?: string | null) {
  if (!value) {
    return "—";
  }

  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return String(value).slice(0, 10);
  }

  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatDateTime(value: Date) {
  const pad = (part: number) => String(part).padStart(2, "0");

  return `${pad(value.getDate())}/${pad(value.getMonth() + 1)}/${value.getFullYear()} à ${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

/** jsPDF/Helvetica cannot render fr-FR narrow no-break spaces — format manually. */
function formatMoney(value?: number | string | null) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "—";
  }

  const sign = number < 0 ? "-" : "";
  const absolute = Math.abs(number);
  const [integerPart, decimalPart = "00"] = absolute.toFixed(2).split(".");
  const grouped = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");

  return `${sign}${grouped},${decimalPart} MAD`;
}

function getMaisonHeroPhoto(maison: MaisonDetail | MaisonListItem) {
  if ("photos" in maison && maison.photos.length > 0) {
    const principale = maison.photos.find((photo) => photo.est_principale);

    return principale?.url || maison.photos[0]?.url || maison.photo_principale || "";
  }

  return maison.photo_principale || "";
}

async function loadImageAsDataUrl(url: string) {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      return null;
    }

    const blob = await response.blob();

    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();

      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function ensureSpace(doc: jsPDF, y: number, needed: number) {
  const pageHeight = doc.internal.pageSize.getHeight();

  if (y + needed > pageHeight - 18) {
    doc.addPage();
    drawPageFooter(doc);
    return 22;
  }

  return y;
}

function drawPageFooter(doc: jsPDF) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageCount = doc.getNumberOfPages();
  const currentPage = doc.getCurrentPageInfo().pageNumber;

  setDraw(doc, COLORS.border);
  doc.setLineWidth(0.2);
  doc.line(MARGIN, pageHeight - 14, pageWidth - MARGIN, pageHeight - 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  setText(doc, COLORS.muted);
  doc.text("Maroc Résidences · Fiche de réservation", MARGIN, pageHeight - 8);
  doc.text(`Page ${currentPage} / ${pageCount}`, pageWidth - MARGIN, pageHeight - 8, {
    align: "right",
  });
}

function drawSectionHeader(doc: jsPDF, title: string, y: number) {
  setFill(doc, COLORS.olive);
  doc.rect(MARGIN, y, 2.5, 6, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  setText(doc, COLORS.oliveDark);
  doc.text(title.toUpperCase(), MARGIN + 5, y + 4.5);

  return y + 10;
}

function drawFieldRow(
  doc: jsPDF,
  label: string,
  value: string,
  x: number,
  y: number,
  width: number
) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  setText(doc, COLORS.muted);
  doc.text(label.toUpperCase(), x, y);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  setText(doc, COLORS.ink);
  const lines = doc.splitTextToSize(value || "—", width);
  doc.text(lines, x, y + 4.5);

  return 4.5 + lines.length * 4.2;
}

function drawInfoCard(
  doc: jsPDF,
  rows: Array<[string, string]>,
  startY: number,
  columns = 2
) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const innerWidth = pageWidth - MARGIN * 2;
  const gap = 6;
  const colWidth = (innerWidth - gap * (columns - 1)) / columns;
  const rowHeight = 14;
  const rowsPerColumn = Math.ceil(rows.length / columns);
  const cardHeight = rowsPerColumn * rowHeight + 8;

  let y = ensureSpace(doc, startY, cardHeight + 4);

  setFill(doc, COLORS.white);
  setDraw(doc, COLORS.border);
  doc.setLineWidth(0.3);
  doc.roundedRect(MARGIN, y, innerWidth, cardHeight, 2.5, 2.5, "FD");

  let rowY = y + 7;

  rows.forEach(([label, value], index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = MARGIN + 6 + column * (colWidth + gap);
    const fieldY = rowY + row * rowHeight;

    drawFieldRow(doc, label, value, x, fieldY, colWidth - 4);
  });

  return y + cardHeight + 8;
}

function drawStatusBadge(
  doc: jsPDF,
  label: string,
  x: number,
  y: number,
  accent: Rgb
) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  const textWidth = doc.getTextWidth(label);
  const paddingX = 3;
  const badgeWidth = textWidth + paddingX * 2;
  const badgeHeight = 6;

  setFill(doc, accent);
  doc.roundedRect(x, y - 4.5, badgeWidth, badgeHeight, 1.5, 1.5, "F");

  setText(doc, COLORS.white);
  doc.text(label, x + paddingX, y);

  return badgeWidth + 3;
}

function drawPricingTable(
  doc: jsPDF,
  lines: Array<{ label: string; amount: string; muted?: boolean }>,
  totals: Array<{ label: string; amount: string; highlight?: boolean }>,
  startY: number
) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const tableWidth = pageWidth - MARGIN * 2;
  const labelX = MARGIN + 6;
  const amountX = pageWidth - MARGIN - 6;
  const lineCount = lines.length + totals.length + 1;
  const tableHeight = 10 + lines.length * 7 + 4 + totals.length * 7 + 6;

  let y = ensureSpace(doc, startY, tableHeight);

  setFill(doc, COLORS.cream);
  setDraw(doc, COLORS.border);
  doc.setLineWidth(0.3);
  doc.roundedRect(MARGIN, y, tableWidth, tableHeight, 2.5, 2.5, "FD");

  let rowY = y + 8;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  setText(doc, COLORS.oliveDark);
  doc.text("DÉTAIL", labelX, rowY);
  doc.text("MONTANT", amountX, rowY, { align: "right" });

  rowY += 3;
  setDraw(doc, COLORS.border);
  doc.setLineWidth(0.2);
  doc.line(MARGIN + 4, rowY, pageWidth - MARGIN - 4, rowY);
  rowY += 5;

  for (const line of lines) {
    doc.setFont("helvetica", line.muted ? "normal" : "bold");
    doc.setFontSize(9);
    setText(doc, line.muted ? COLORS.muted : COLORS.ink);
    doc.text(line.label, labelX, rowY);
    doc.text(line.amount, amountX, rowY, { align: "right" });
    rowY += 7;
  }

  rowY += 1;
  setDraw(doc, COLORS.border);
  doc.line(MARGIN + 4, rowY, pageWidth - MARGIN - 4, rowY);
  rowY += 5;

  for (const total of totals) {
    if (total.highlight) {
      setFill(doc, COLORS.oliveDark);
      doc.roundedRect(MARGIN + 3, rowY - 4.5, tableWidth - 6, 8, 1.5, 1.5, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      setText(doc, COLORS.white);
    } else {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      setText(doc, COLORS.ink);
    }

    doc.text(total.label, labelX + (total.highlight ? 2 : 0), rowY);
    doc.text(total.amount, amountX - (total.highlight ? 2 : 0), rowY, { align: "right" });
    rowY += total.highlight ? 9 : 7;
  }

  return y + tableHeight + 8;
}

function drawNotesBlock(doc: jsPDF, title: string, content: string, startY: number) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const textWidth = pageWidth - MARGIN * 2 - 12;
  const lines = doc.splitTextToSize(content, textWidth);
  const blockHeight = lines.length * 4.5 + 14;

  let y = ensureSpace(doc, startY, blockHeight + 12);
  y = drawSectionHeader(doc, title, y);

  setFill(doc, COLORS.sand);
  setDraw(doc, COLORS.border);
  doc.setLineWidth(0.3);
  doc.roundedRect(MARGIN, y, pageWidth - MARGIN * 2, blockHeight, 2.5, 2.5, "FD");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  setText(doc, COLORS.ink);
  doc.text(lines, MARGIN + 6, y + 8);

  return y + blockHeight + 8;
}

export async function downloadReservationSheetPdf(
  reservation: Reservation,
  maison: MaisonDetail | MaisonListItem | null
) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const maisonNom = maison?.nom || reservation.maison_nom || "—";
  const localisation =
    [maison?.ville, maison?.quartier].filter(Boolean).join(" · ") || "Maroc";
  const photoUrl = maison ? resolvePhotoUrl(getMaisonHeroPhoto(maison)) : "";
  const imageData = photoUrl ? await loadImageAsDataUrl(photoUrl) : null;

  const headerHeight = 38;

  setFill(doc, COLORS.oliveDark);
  doc.rect(0, 0, pageWidth, headerHeight, "F");

  setFill(doc, COLORS.terracotta);
  doc.rect(0, headerHeight - 1.2, pageWidth, 1.2, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  setText(doc, COLORS.sand);
  doc.text("MAROC RÉSIDENCES", MARGIN, 12);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  setText(doc, COLORS.white);
  doc.text("Fiche de réservation", MARGIN, 22);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  setText(doc, COLORS.sand);
  doc.text(`Référence ${reservation.reference}`, MARGIN, 30);
  doc.text(`Généré le ${formatDateTime(new Date())}`, MARGIN, 35);

  const statutLabel = STATUT_LABELS[reservation.statut_reservation];
  const paiementLabel = PAIEMENT_LABELS[reservation.statut_paiement];

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);

  const paiementBadgeWidth = doc.getTextWidth(paiementLabel) + 6;
  const statutBadgeWidth = doc.getTextWidth(statutLabel) + 6;
  const badgeRight = pageWidth - MARGIN;

  drawStatusBadge(doc, statutLabel, badgeRight - statutBadgeWidth, 22, COLORS.olive);
  drawStatusBadge(doc, paiementLabel, badgeRight - paiementBadgeWidth, 30, COLORS.terracotta);

  let y = headerHeight + 10;

  const photoWidth = 52;
  const photoHeight = 34;
  const textX = imageData ? MARGIN + photoWidth + 8 : MARGIN;
  const textWidth = pageWidth - textX - MARGIN;

  if (imageData) {
    const format = imageData.includes("image/png") ? "PNG" : "JPEG";

    setDraw(doc, COLORS.border);
    doc.setLineWidth(0.4);
    doc.roundedRect(MARGIN, y, photoWidth, photoHeight, 2.5, 2.5, "S");
    doc.addImage(imageData, format, MARGIN + 0.5, y + 0.5, photoWidth - 1, photoHeight - 1);
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  setText(doc, COLORS.muted);
  doc.text("MAISON D'HÔTES", textX, y + 4);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  setText(doc, COLORS.ink);
  const maisonLines = doc.splitTextToSize(maisonNom, textWidth);
  doc.text(maisonLines, textX, y + 11);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  setText(doc, COLORS.muted);
  doc.text(localisation, textX, y + 11 + maisonLines.length * 5.5);

  if (maison?.adresse) {
    const addressLines = doc.splitTextToSize(maison.adresse, textWidth);
    doc.text(addressLines, textX, y + 18 + maisonLines.length * 5.5);
  }

  y += photoHeight + 10;

  y = drawSectionHeader(doc, "Informations du séjour", y);
  y = drawInfoCard(doc, [
    ["Client", reservation.client_nom || "—"],
    ["Email", reservation.client_email || "—"],
    ["Chambre", reservation.chambre_nom || "—"],
    ["Source", SOURCE_LABELS[reservation.source]],
    ["Créée le", formatDateDisplay(reservation.date_creation)],
    ["Arrivée", formatDateDisplay(reservation.date_arrivee)],
    ["Départ", formatDateDisplay(reservation.date_depart)],
    ["Nombre de nuits", String(reservation.nb_nuits)],
  ], y);

  y = drawSectionHeader(doc, "Voyageurs", y);
  y = drawInfoCard(doc, [
    ["Adultes", String(reservation.nb_adultes)],
    ["Enfants", String(reservation.nbrs_enfants)],
    ["Bébés", String(reservation.nbrs_bebe)],
    [
      "Âge enfant",
      reservation.nbrs_enfants > 0 && reservation.age_enfant
        ? `${reservation.age_enfant} ans`
        : "—",
    ],
  ], y, 4);

  y = drawSectionHeader(doc, "Tarification", y);
  y = drawPricingTable(
    doc,
    [
      { label: "Prix chambre", amount: formatMoney(reservation.prix_chambre_total) },
      { label: "Prix bébé", amount: formatMoney(reservation.prix_bebe_total) },
      { label: "Prix enfants", amount: formatMoney(reservation.prix_enfants_total) },
      {
        label: reservation.promotion_nom ? `Promotion · ${reservation.promotion_nom}` : "Promotion",
        amount:
          Number(reservation.montant_reduction) > 0
            ? formatMoney(-Math.abs(Number(reservation.montant_reduction)))
            : reservation.promotion_nom
              ? "Appliquée"
              : "Aucune",
        muted: !reservation.promotion_nom,
      },
      {
        label: reservation.supplement_nom ? `Supplément · ${reservation.supplement_nom}` : "Supplément",
        amount: reservation.supplement_nom ? "Inclus" : "Aucun",
        muted: !reservation.supplement_nom,
      },
    ],
    [
      { label: "Total HT", amount: formatMoney(reservation.prix_total_ht) },
      {
        label: `TVA (${Number(reservation.taux_tva_applique) || 0} %)`,
        amount: formatMoney(reservation.montant_tva),
      },
      { label: "Total TTC", amount: formatMoney(reservation.prix_total_ttc), highlight: true },
      { label: "Montant payé", amount: formatMoney(reservation.montant_paye) },
    ],
    y
  );

  if (maison) {
    y = drawSectionHeader(doc, "Coordonnées de la maison", y);
    y = drawInfoCard(doc, [
      ["Adresse", maison.adresse || "—"],
      [
        "Localisation",
        [maison.code_postal, maison.ville, maison.pays].filter(Boolean).join(" · ") || "—",
      ],
      ["Téléphone", maison.telephone || "—"],
      ["Email", maison.email || "—"],
      ["Check-in", maison.heure_checkin || "—"],
      ["Check-out", maison.heure_checkout || "—"],
    ], y);

    if (maison.description) {
      y = drawNotesBlock(doc, "À propos de la maison", maison.description, y);
    }
  }

  if (reservation.notes) {
    y = drawNotesBlock(doc, "Notes de réservation", reservation.notes, y);
  }

  drawPageFooter(doc);

  doc.save(`fiche-${reservation.reference}.pdf`);
}
