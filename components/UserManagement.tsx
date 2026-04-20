
import React, { useState, useEffect } from 'react';
import { Shield, Trash2, User as UserIcon, ShieldAlert, Users } from 'lucide-react';
import { User } from '../types';
import { apiService } from '../services/apiService';
import ConfirmationModal from './ConfirmationModal';

interface UserManagementProps {
  currentUser: User;
  onNotify: (message: string, type: 'success' | 'error') => void;
}

const UserManagement: React.FC<UserManagementProps> = ({ currentUser, onNotify }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    const allUsers = await apiService.getAllUsers();
    setUsers(allUsers);
  };

  const handleToggleAdmin = async (user: User) => {
    if (user.id === currentUser.id) {
      onNotify('Você não pode alterar suas próprias permissões.', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const updatedUser = { ...user, isAdmin: !user.isAdmin };
      await apiService.saveUser(updatedUser);
      await loadUsers();
      onNotify(`Permissões de ${user.username} atualizadas.`, 'success');
    } catch (error) {
      onNotify('Erro ao atualizar permissões.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;

    try {
      await apiService.deleteUser(userToDelete);
      await loadUsers();
      onNotify('Perfil de usuário removido do banco.', 'success');
      setUserToDelete(null);
    } catch (error) {
      onNotify('Erro ao remover usuário.', 'error');
    }
  };

  const handleDeleteUser = (id: string) => {
    if (id === currentUser.id) {
      onNotify('Você não pode excluir seu próprio usuário.', 'error');
      return;
    }

    setUserToDelete(id);
  };

  return (
    <div className="p-8 space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-dracula-purple/10 text-dracula-purple rounded-xl">
              <Users size={24} />
            </div>
            <h3 className="text-2xl font-bold">Gestão de Usuários</h3>
          </div>
          <p className="text-sm text-slate-500 dark:text-dracula-comment">
            Usuários são criados automaticamente ao fazer login com Google pela primeira vez.
          </p>
        </div>

        <div className="grid gap-4">
          {users.map(user => (
            <div key={user.id} className="flex items-center justify-between p-6 bg-white dark:bg-dracula-darker border border-slate-100 dark:border-dracula-current rounded-[2rem] group hover:shadow-xl transition-all">
              <div className="flex items-center gap-6">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${user.isAdmin ? 'bg-dracula-purple/10 text-dracula-purple' : 'bg-slate-100 dark:bg-white/5 text-slate-400'}`}>
                  <UserIcon size={28} />
                </div>
                <div>
                  <p className="font-bold text-xl text-slate-800 dark:text-white">{user.username}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest ${user.isAdmin ? 'bg-dracula-purple text-white' : 'bg-slate-200 dark:bg-white/10 text-slate-500 dark:text-dracula-comment'}`}>
                      {user.isAdmin ? 'Administrador' : 'Operador'}
                    </span>
                    {user.id === currentUser.id && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest bg-emerald-500 text-white">
                        Você
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggleAdmin(user)}
                  disabled={isLoading || user.id === currentUser.id}
                  className={`p-3 rounded-xl transition-all flex items-center gap-2 font-bold text-sm ${
                    user.isAdmin 
                    ? 'text-amber-600 bg-amber-50 hover:bg-amber-100 dark:bg-amber-500/10 dark:hover:bg-amber-500/20' 
                    : 'text-dracula-purple bg-dracula-purple/5 hover:bg-dracula-purple/10'
                  } disabled:opacity-50`}
                  title={user.isAdmin ? "Remover Admin" : "Tornar Admin"}
                >
                  {user.isAdmin ? <ShieldAlert size={18} /> : <Shield size={18} />}
                  {user.isAdmin ? "Remover Admin" : "Tornar Admin"}
                </button>

                {user.id !== currentUser.id && (
                  <button
                    onClick={() => handleDeleteUser(user.id)}
                    className="p-3 text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-all"
                    title="Remover Perfil"
                  >
                    <Trash2 size={20} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {userToDelete && (
        <ConfirmationModal 
          title="Excluir Usuário" 
          message="Tem certeza que deseja remover este usuário permanentemente? Esta ação não pode ser desfeita."
          onConfirm={confirmDeleteUser}
          onCancel={() => setUserToDelete(null)}
          isDanger
          confirmLabel="Excluir"
          confirmationKeyword="Excluir"
        />
      )}
    </div>
  );
};

export default UserManagement;
