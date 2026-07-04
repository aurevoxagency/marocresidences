import { useCallback, useEffect, useMemo, useState } from "react";
import { MoreVertical, Pencil, Plus, Search, Trash2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  createClient,
  deleteClient,
  fetchClients,
  updateClient,
  type Client,
  type ClientFormData,
  type ClientTypePiece,
} from "@/lib/clients";
import { fetchProspects, type Prospect } from "@/lib/prospects";

type FormState = {
  prospect_id: string;
  civilite: string;
  nom: string;
  prenom: string;
  date_naissance: string;
  nationalite: string;
  type_piece: string;
  numero_piece: string;
  email: string;
  telephone: string;
  adresse: string;
  ville: string;
  pays: string;
  langue_preferee: string;
  allergies_regime: string;
  notes_preferences: string;
  is_vip: boolean;
};

function emptyForm(): FormState {
  return {
    prospect_id: "",
    civilite: "",
    nom: "",
    prenom: "",
    date_naissance: "",
    nationalite: "",
    type_piece: "",
    numero_piece: "",
    email: "",
    telephone: "",
    adresse: "",
    ville: "",
    pays: "",
    langue_preferee: "",
    allergies_regime: "",
    notes_preferences: "",
    is_vip: false,
  };
}

function dateInput(value?: string | null) {
  return value ? String(value).slice(0, 10) : "";
}

function toFormState(client: Client): FormState {
  return {
    prospect_id: client.prospect_id ? String(client.prospect_id) : "",
    civilite: client.civilite || "",
    nom: client.nom || "",
    prenom: client.prenom || "",
    date_naissance: dateInput(client.date_naissance),
    nationalite: client.nationalite || "",
    type_piece: client.type_piece || "",
    numero_piece: client.numero_piece || "",
    email: client.email || "",
    telephone: client.telephone || "",
    adresse: client.adresse || "",
    ville: client.ville || "",
    pays: client.pays || "",
    langue_preferee: client.langue_preferee || "",
    allergies_regime: client.allergies_regime || "",
    notes_preferences: client.notes_preferences || "",
    is_vip: Boolean(client.is_vip),
  };
}

function toPayload(form: FormState): ClientFormData {
  return {
    prospect_id: form.prospect_id ? Number(form.prospect_id) : null,
    civilite: (form.civilite as ClientFormData["civilite"]) || "",
    nom: form.nom.trim(),
    prenom: form.prenom.trim() || undefined,
    date_naissance: form.date_naissance || undefined,
    nationalite: form.nationalite.trim() || undefined,
    type_piece: (form.type_piece as ClientTypePiece | "") || "",
    numero_piece: form.numero_piece.trim() || undefined,
    email: form.email.trim() || undefined,
    telephone: form.telephone.trim() || undefined,
    adresse: form.adresse.trim() || undefined,
    ville: form.ville.trim() || undefined,
    pays: form.pays.trim() || undefined,
    langue_preferee: form.langue_preferee.trim() || undefined,
    allergies_regime: form.allergies_regime.trim() || undefined,
    notes_preferences: form.notes_preferences.trim() || undefined,
    is_vip: form.is_vip,
  };
}

export function ClientsManagement() {
  const [clients, setClients] = useState<Client[]>([]);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState("");
  const [filterVip, setFilterVip] = useState("all");
  const [filterVille, setFilterVille] = useState("all");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [clientsResult, prospectsResult] = await Promise.allSettled([
        fetchClients(),
        fetchProspects(),
      ]);

      if (clientsResult.status === "fulfilled") {
        setClients(clientsResult.value);
      } else {
        setError(
          clientsResult.reason instanceof Error
            ? clientsResult.reason.message
            : "Impossible de charger les clients."
        );
      }

      if (prospectsResult.status === "fulfilled") {
        setProspects(prospectsResult.value);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const villes = useMemo(() => {
    return [...new Set(clients.map((client) => client.ville?.trim()).filter(Boolean) as string[])].sort(
      (a, b) => a.localeCompare(b, "fr")
    );
  }, [clients]);

  const filteredClients = useMemo(() => {
    const query = search.trim().toLowerCase();

    return clients.filter((client) => {
      if (filterVip === "vip" && !client.is_vip) return false;
      if (filterVip === "standard" && client.is_vip) return false;
      if (filterVille !== "all" && (client.ville || "") !== filterVille) return false;
      if (!query) return true;

      const haystack = [
        client.nom,
        client.prenom,
        client.email,
        client.telephone,
        client.ville,
        client.pays,
        client.nationalite,
        client.numero_piece,
        client.prospect_nom,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [clients, search, filterVip, filterVille]);

  const openCreateDialog = () => {
    setEditingId(null);
    setForm(emptyForm());
    setFormError(null);
    setDialogOpen(true);
  };

  const openEditDialog = (client: Client) => {
    setEditingId(client.id);
    setForm(toFormState(client));
    setFormError(null);
    setDialogOpen(true);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFormError(null);

    const payload = toPayload(form);

    if (!payload.nom) {
      setFormError("Le nom est obligatoire.");
      setSaving(false);
      return;
    }

    try {
      if (editingId) {
        await updateClient(editingId, payload);
      } else {
        await createClient(payload);
      }

      setDialogOpen(false);
      await loadData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Impossible d'enregistrer le client.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setDeleting(true);

    try {
      await deleteClient(deleteTarget.id);
      setDeleteTarget(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de supprimer le client.");
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="w-full">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h2 className="hidden text-[22px] font-semibold tracking-tight text-slate-900 lg:block">
            Clients
          </h2>
          <p className="text-[13px] text-slate-500 lg:mt-1">
            Gestion des clients convertis et de leurs préférences.
          </p>
        </div>
        <Button
          type="button"
          onClick={openCreateDialog}
          className="w-full rounded-xl bg-[#3b82f6] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#2563eb] sm:w-auto"
        >
          <Plus className="h-4 w-4" />
          Ajouter un client
        </Button>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-600">
          {error}
        </div>
      )}

      <div className="mt-4 grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 sm:mt-5 sm:rounded-[22px] sm:p-4 sm:grid-cols-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un client..."
            className="pl-9"
          />
        </div>
        <Select value={filterVip} onValueChange={setFilterVip}>
          <SelectTrigger>
            <SelectValue placeholder="VIP" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les clients</SelectItem>
            <SelectItem value="vip">VIP uniquement</SelectItem>
            <SelectItem value="standard">Non VIP</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterVille} onValueChange={setFilterVille}>
          <SelectTrigger>
            <SelectValue placeholder="Ville" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les villes</SelectItem>
            {villes.map((ville) => (
              <SelectItem key={ville} value={ville}>
                {ville}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-4 overflow-hidden rounded-[22px] border border-slate-200 bg-white">
        {loading ? (
          <p className="px-5 py-8 text-[13px] text-slate-500">Chargement des clients...</p>
        ) : clients.length === 0 ? (
          <p className="px-5 py-8 text-[13px] text-slate-500">Aucun client trouvé.</p>
        ) : filteredClients.length === 0 ? (
          <p className="px-5 py-8 text-[13px] text-slate-500">
            Aucun résultat pour cette recherche ou ces filtres.
          </p>
        ) : (
          <Table>
            <TableHeader className="bg-[#fbfcff]">
              <TableRow>
                <TableHead className="text-[12px] font-semibold text-slate-400">Nom</TableHead>
                <TableHead className="text-[12px] font-semibold text-slate-400">Contact</TableHead>
                <TableHead className="text-[12px] font-semibold text-slate-400">Ville</TableHead>
                <TableHead className="text-[12px] font-semibold text-slate-400">VIP</TableHead>
                <TableHead className="text-[12px] font-semibold text-slate-400">
                  Réservations
                </TableHead>
                <TableHead className="text-right text-[12px] font-semibold text-slate-400">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredClients.map((client) => (
                <TableRow key={client.id}>
                  <TableCell className="text-[13px] font-medium text-slate-800">
                    {[client.civilite, client.prenom, client.nom].filter(Boolean).join(" ")}
                  </TableCell>
                  <TableCell className="text-[13px] text-slate-500">
                    <div>{client.email || "—"}</div>
                    <div className="text-[11px] text-slate-400">{client.telephone || "—"}</div>
                  </TableCell>
                  <TableCell className="text-[13px] text-slate-500">
                    {client.ville || "—"}
                  </TableCell>
                  <TableCell>
                    {client.is_vip ? (
                      <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                        VIP
                      </span>
                    ) : (
                      <span className="text-[13px] text-slate-400">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-[13px] text-slate-500">
                    {client.nb_reservations_total}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 rounded-lg border-slate-200"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem
                          className="cursor-pointer gap-2"
                          onClick={() => openEditDialog(client)}
                        >
                          <Pencil className="h-4 w-4" />
                          Modifier
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="cursor-pointer gap-2 text-red-600 focus:bg-red-50 focus:text-red-700"
                          onClick={() => setDeleteTarget(client)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Modifier le client" : "Ajouter un client"}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Civilité</Label>
                <Select
                  value={form.civilite || "none"}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, civilite: value === "none" ? "" : value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Civilité" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    <SelectItem value="M.">M.</SelectItem>
                    <SelectItem value="Mme">Mme</SelectItem>
                    <SelectItem value="Mlle">Mlle</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="client-prenom">Prénom</Label>
                <Input
                  id="client-prenom"
                  value={form.prenom}
                  onChange={(e) => setForm((prev) => ({ ...prev, prenom: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client-nom">Nom *</Label>
                <Input
                  id="client-nom"
                  value={form.nom}
                  onChange={(e) => setForm((prev) => ({ ...prev, nom: e.target.value }))}
                  required
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="client-email">Email</Label>
                <Input
                  id="client-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client-tel">Téléphone</Label>
                <Input
                  id="client-tel"
                  value={form.telephone}
                  onChange={(e) => setForm((prev) => ({ ...prev, telephone: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client-naissance">Date de naissance</Label>
                <Input
                  id="client-naissance"
                  type="date"
                  value={form.date_naissance}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, date_naissance: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client-nationalite">Nationalité</Label>
                <Input
                  id="client-nationalite"
                  value={form.nationalite}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, nationalite: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Type de pièce</Label>
                <Select
                  value={form.type_piece || "none"}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, type_piece: value === "none" ? "" : value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Type de pièce" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    <SelectItem value="CIN">CIN</SelectItem>
                    <SelectItem value="Passeport">Passeport</SelectItem>
                    <SelectItem value="Carte_sejour">Carte de séjour</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="client-piece">N° pièce</Label>
                <Input
                  id="client-piece"
                  value={form.numero_piece}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, numero_piece: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="client-adresse">Adresse</Label>
                <Input
                  id="client-adresse"
                  value={form.adresse}
                  onChange={(e) => setForm((prev) => ({ ...prev, adresse: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client-ville">Ville</Label>
                <Input
                  id="client-ville"
                  value={form.ville}
                  onChange={(e) => setForm((prev) => ({ ...prev, ville: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client-pays">Pays</Label>
                <Input
                  id="client-pays"
                  value={form.pays}
                  onChange={(e) => setForm((prev) => ({ ...prev, pays: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client-langue">Langue préférée</Label>
                <Input
                  id="client-langue"
                  value={form.langue_preferee}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, langue_preferee: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Prospect d&apos;origine</Label>
                <Select
                  value={form.prospect_id || "none"}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, prospect_id: value === "none" ? "" : value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Prospect" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun</SelectItem>
                    {prospects.map((prospect) => (
                      <SelectItem key={prospect.id} value={String(prospect.id)}>
                        {[prospect.prenom, prospect.nom].filter(Boolean).join(" ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="client-allergies">Allergies / régime</Label>
              <Input
                id="client-allergies"
                value={form.allergies_regime}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, allergies_regime: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="client-notes">Notes préférences</Label>
              <Textarea
                id="client-notes"
                value={form.notes_preferences}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, notes_preferences: e.target.value }))
                }
                rows={3}
              />
            </div>

            <label className="flex items-center gap-2 text-[13px] text-slate-700">
              <Checkbox
                checked={form.is_vip}
                onCheckedChange={(checked) =>
                  setForm((prev) => ({ ...prev, is_vip: Boolean(checked) }))
                }
              />
              Client VIP
            </label>

            {formError && <p className="text-[13px] text-red-600">{formError}</p>}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Enregistrement..." : editingId ? "Mettre à jour" : "Créer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce client ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le client{" "}
              <strong>
                {deleteTarget?.prenom} {deleteTarget?.nom}
              </strong>{" "}
              sera définitivement supprimé.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? "Suppression..." : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
