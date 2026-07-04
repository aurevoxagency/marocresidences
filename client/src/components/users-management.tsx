import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, Pencil, Plus, Search, Trash2 } from "lucide-react";

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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import type { AuthUser } from "@/lib/auth";
import { getRoleLabel, ROLE_IDS } from "@/lib/roles";
import {
  createUser,
  deleteUser,
  fetchUsers,
  updateUser,
  type UserFormData,
} from "@/lib/users";

type UserFormState = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  password: string;
  role_id: string;
};

const emptyForm: UserFormState = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  password: "",
  role_id: String(ROLE_IDS.CLIENT),
};

function toFormState(user?: AuthUser | null): UserFormState {
  if (!user) {
    return emptyForm;
  }

  return {
    first_name: user.first_name,
    last_name: user.last_name,
    email: user.email,
    phone: user.phone || "",
    password: "",
    role_id: String(user.role_id || ROLE_IDS.CLIENT),
  };
}

function formatDate(value: string | null) {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleDateString("fr-FR");
}

export function UsersManagement({ currentUserId }: { currentUserId: number }) {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AuthUser | null>(null);
  const [form, setForm] = useState<UserFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AuthUser | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<string>("all");

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await fetchUsers();
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger les utilisateurs.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return users.filter((user) => {
      if (filterRole !== "all" && String(user.role_id) !== filterRole) {
        return false;
      }

      if (!query) {
        return true;
      }

      const haystack = [
        user.first_name,
        user.last_name,
        user.email,
        user.phone,
        getRoleLabel(user.role_id),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [users, search, filterRole]);

  const openCreateDialog = () => {
    setEditingUser(null);
    setForm(emptyForm);
    setFormError(null);
    setShowPassword(false);
    setDialogOpen(true);
  };

  const openEditDialog = (user: AuthUser) => {
    setEditingUser(user);
    setForm(toFormState(user));
    setFormError(null);
    setShowPassword(false);
    setDialogOpen(true);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFormError(null);

    const payload: UserFormData = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim() || undefined,
      role_id: Number(form.role_id),
      terms_accepted: true,
    };

    if (!payload.first_name || !payload.last_name || !payload.email) {
      setFormError("Prénom, nom et email sont obligatoires.");
      setSaving(false);
      return;
    }

    if (!editingUser && !form.password) {
      setFormError("Le mot de passe est obligatoire pour un nouvel utilisateur.");
      setSaving(false);
      return;
    }

    if (form.password) {
      payload.password = form.password;
    }

    try {
      if (editingUser) {
        await updateUser(editingUser.id, payload);
      } else {
        await createUser(payload);
      }

      setDialogOpen(false);
      await loadUsers();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Impossible d'enregistrer l'utilisateur.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) {
      return;
    }

    setDeleting(true);

    try {
      await deleteUser(deleteTarget.id);
      setDeleteTarget(null);
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de supprimer l'utilisateur.");
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
            Gestion des utilisateurs
          </h2>
          <p className="text-[13px] text-slate-500 lg:mt-1">
            Créer, modifier et supprimer les comptes utilisateurs.
          </p>
        </div>
        <Button
          type="button"
          onClick={openCreateDialog}
          className="w-full rounded-xl bg-[#3b82f6] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#2563eb] sm:w-auto"
        >
          <Plus className="h-4 w-4" />
          Ajouter un utilisateur
        </Button>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-600">
          {error}
        </div>
      )}

      <div className="mt-4 grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 sm:mt-5 sm:rounded-[22px] sm:p-4 sm:grid-cols-[1fr_220px]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un utilisateur..."
            className="pl-9"
          />
        </div>
        <Select value={filterRole} onValueChange={setFilterRole}>
          <SelectTrigger>
            <SelectValue placeholder="Rôle" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les rôles</SelectItem>
            <SelectItem value={String(ROLE_IDS.SUPER_ADMIN)}>Super admin</SelectItem>
            <SelectItem value={String(ROLE_IDS.ADMIN)}>Admin</SelectItem>
            <SelectItem value={String(ROLE_IDS.CLIENT)}>Client</SelectItem>
            <SelectItem value={String(ROLE_IDS.RECEPTIONNISTE)}>Réceptionniste</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mt-4 overflow-hidden rounded-[22px] border border-slate-200 bg-white">
        {loading ? (
          <p className="px-5 py-8 text-[13px] text-slate-500">Chargement des utilisateurs...</p>
        ) : users.length === 0 ? (
          <p className="px-5 py-8 text-[13px] text-slate-500">Aucun utilisateur trouvé.</p>
        ) : filteredUsers.length === 0 ? (
          <p className="px-5 py-8 text-[13px] text-slate-500">
            Aucun résultat pour cette recherche ou ce filtre.
          </p>
        ) : (
          <Table>
            <TableHeader className="bg-[#fbfcff]">
              <TableRow>
                <TableHead className="text-[12px] font-semibold text-slate-400">Nom</TableHead>
                <TableHead className="text-[12px] font-semibold text-slate-400">Email</TableHead>
                <TableHead className="text-[12px] font-semibold text-slate-400">Téléphone</TableHead>
                <TableHead className="text-[12px] font-semibold text-slate-400">Rôle</TableHead>
                <TableHead className="text-[12px] font-semibold text-slate-400">Créé le</TableHead>
                <TableHead className="text-right text-[12px] font-semibold text-slate-400">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="text-[13px] font-medium text-slate-800">
                    {user.first_name} {user.last_name}
                  </TableCell>
                  <TableCell className="text-[13px] text-slate-500">{user.email}</TableCell>
                  <TableCell className="text-[13px] text-slate-500">
                    {user.phone || "—"}
                  </TableCell>
                  <TableCell className="text-[13px] text-slate-500">
                    {getRoleLabel(user.role_id)}
                  </TableCell>
                  <TableCell className="text-[13px] text-slate-500">
                    {formatDate(user.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 rounded-lg border-slate-200"
                        onClick={() => openEditDialog(user)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Modifier
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 rounded-lg border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                        disabled={user.id === currentUserId}
                        onClick={() => setDeleteTarget(user)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Supprimer
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>
              {editingUser ? "Modifier l'utilisateur" : "Ajouter un utilisateur"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="first_name">Prénom</Label>
                <Input
                  id="first_name"
                  value={form.first_name}
                  onChange={(e) => setForm((prev) => ({ ...prev, first_name: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Nom</Label>
                <Input
                  id="last_name"
                  value={form.last_name}
                  onChange={(e) => setForm((prev) => ({ ...prev, last_name: e.target.value }))}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Téléphone</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">
                Mot de passe {editingUser ? "(laisser vide pour ne pas changer)" : ""}
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                  required={!editingUser}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
                  aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Rôle</Label>
              <Select
                value={form.role_id}
                onValueChange={(value) => setForm((prev) => ({ ...prev, role_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un rôle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={String(ROLE_IDS.SUPER_ADMIN)}>Super admin</SelectItem>
                  <SelectItem value={String(ROLE_IDS.ADMIN)}>Admin</SelectItem>
                  <SelectItem value={String(ROLE_IDS.CLIENT)}>Client</SelectItem>
                  <SelectItem value={String(ROLE_IDS.RECEPTIONNISTE)}>Réceptionniste</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formError && (
              <p className="text-[13px] text-red-600">{formError}</p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={saving}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Enregistrement..." : editingUser ? "Mettre à jour" : "Créer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cet utilisateur ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. L&apos;utilisateur{" "}
              <strong>
                {deleteTarget?.first_name} {deleteTarget?.last_name}
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
