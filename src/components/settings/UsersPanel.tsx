import React, { useState } from 'react';
import { UserPlus, Pencil, Trash2, ShieldCheck, X, Circle } from 'lucide-react';
import { usePharmacy } from '../../context/PharmacyContext';
import { User, UserRole } from '../../types/pharmacy';

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  staff: 'Staff',
  cashier: 'Cashier',
};

type FormState = { name: string; username: string; password: string; role: UserRole };
const emptyForm: FormState = { name: '', username: '', password: '', role: 'staff' };

export const UsersPanel: React.FC = () => {
  const { users, addUser, updateUser, deleteUser, currentUser, activeSessions, settings, addNotification } = usePharmacy();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);

  const isAdmin = currentUser?.role === 'admin';

  const openAddForm = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormError(null);
    setIsFormOpen(true);
  };

  const openEditForm = (user: User) => {
    setEditingId(user.id);
    setForm({ name: user.name, username: user.username, password: '', role: user.role });
    setFormError(null);
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    setFormError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = form.name.trim();
    const username = form.username.trim().toLowerCase();
    if (!name || !username) {
      setFormError('Name and username are required.');
      return;
    }
    if (!editingId && !form.password) {
      setFormError('Password is required for a new account.');
      return;
    }
    const usernameTaken = users.some(u => u.username.toLowerCase() === username && u.id !== editingId);
    if (usernameTaken) {
      setFormError('That username is already taken.');
      return;
    }

    if (editingId) {
      const updates: Partial<User> = { name, username, role: form.role };
      if (form.password) updates.password = form.password;
      updateUser(editingId, updates);
      addNotification('User Updated', `Updated account for ${name}.`, 'system', 'success');
    } else {
      addUser({ name, username, password: form.password, role: form.role });
    }
    closeForm();
  };

  const handleDelete = (user: User) => {
    if (user.id === currentUser?.id) {
      addNotification('Not Allowed', "You can't delete the account you're currently signed in as.", 'system', 'error');
      return;
    }
    if (user.role === 'admin' && users.filter(u => u.role === 'admin').length <= 1) {
      addNotification('Not Allowed', 'At least one admin account must remain.', 'system', 'error');
      return;
    }
    if (!window.confirm(`Delete the account "${user.name}"? This cannot be undone.`)) return;
    deleteUser(user.id);
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="p-5 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Staff Accounts</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Accounts created here (or synced from the Main PC) can sign in to the app.
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={openAddForm}
            className="flex items-center gap-1.5 px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <UserPlus className="h-4 w-4" /> Add User
          </button>
        )}
      </div>

      {!isAdmin && (
        <div className="p-4 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-100 dark:border-amber-900/40">
          Only administrators can add, edit, or remove staff accounts.
        </div>
      )}

      {isFormOpen && (
        <form onSubmit={handleSubmit} className="p-5 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              {editingId ? 'Edit User' : 'New User'}
            </h3>
            <button type="button" onClick={closeForm} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
              <X className="h-4 w-4" />
            </button>
          </div>
          {formError && (
            <div className="rounded border border-rose-200 bg-rose-50 p-2 text-xs text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
              {formError}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Full Name</label>
              <input value={form.name} onChange={(e) => setForm(s => ({ ...s, name: e.target.value }))}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md text-sm outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Username</label>
              <input value={form.username} onChange={(e) => setForm(s => ({ ...s, username: e.target.value }))}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md text-sm outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                {editingId ? 'New Password (leave blank to keep current)' : 'Password'}
              </label>
              <input type="password" value={form.password} onChange={(e) => setForm(s => ({ ...s, password: e.target.value }))}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md text-sm outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Role</label>
              <select value={form.role} onChange={(e) => setForm(s => ({ ...s, role: e.target.value as UserRole }))}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md text-sm outline-none focus:ring-2 focus:ring-teal-500">
                <option value="admin">Admin</option>
                <option value="staff">Staff</option>
                <option value="cashier">Cashier</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={closeForm}
              className="px-4 py-2 text-sm font-medium rounded border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 text-sm font-bold rounded bg-teal-700 text-white hover:bg-teal-800">
              {editingId ? 'Save Changes' : 'Create User'}
            </button>
          </div>
        </form>
      )}

      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {users.map(user => {
          const isYou = user.id === currentUser?.id;
          const isActiveElsewhere = !!activeSessions[user.id] && activeSessions[user.id] !== settings.deviceInstanceId;
          return (
            <div key={user.id} className="flex items-center justify-between px-5 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-9 w-9 rounded-full bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 flex items-center justify-center font-bold text-xs shrink-0">
                  {user.name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-slate-800 dark:text-slate-100 truncate">{user.name}</span>
                    {user.role === 'admin' && <ShieldCheck className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400 shrink-0" />}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    @{user.username} • {ROLE_LABELS[user.role]}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {isYou && (
                  <span className="text-[10px] font-bold uppercase tracking-wide text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-900/30 px-2 py-0.5 rounded-full">You</span>
                )}
                {!isYou && isActiveElsewhere && (
                  <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full">
                    <Circle className="h-2 w-2 fill-current" /> Active elsewhere
                  </span>
                )}
                {isAdmin && (
                  <>
                    <button onClick={() => openEditForm(user)} className="p-1.5 text-slate-400 hover:text-teal-600 dark:hover:text-teal-400">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleDelete(user)} className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
        {users.length === 0 && (
          <div className="px-5 py-6 text-center text-sm text-slate-400">No staff accounts yet.</div>
        )}
      </div>
    </div>
  );
};
