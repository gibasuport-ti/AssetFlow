
import React, { useState } from 'react';
import { HardDrive, Lock, User as UserIcon, Loader2, AlertCircle, ExternalLink, Maximize, LogIn } from 'lucide-react';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../firebase';
import { apiService } from '../services/apiService';
import { User } from '../types';

interface LoginScreenProps {}

const LoginScreen: React.FC<LoginScreenProps> = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const fbUser = result.user;

      if (fbUser) {
        // Check if user exists in Firestore, if not create a basic profile
        let userProfile = await apiService.getUserById(fbUser.uid);
        
        if (!userProfile) {
          userProfile = {
            id: fbUser.uid,
            username: fbUser.displayName || fbUser.email?.split('@')[0] || 'User',
            email: fbUser.email || '',
            isAdmin: fbUser.email === 'gibasuporte@gmail.com', // Default admin for the owner
          };
          await apiService.saveUser(userProfile);
        }
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/unauthorized-domain') {
        setError('Este domínio não está autorizado no Firebase. Por favor, adicione o domínio da aplicação na lista de domínios autorizados no Console do Firebase (Authentication > Settings > Authorized domains).');
      } else if (err.code === 'auth/popup-blocked') {
        setError('O pop-up de login foi bloqueado pelo navegador. Por favor, permita pop-ups para este site.');
      } else {
        setError('Erro ao tentar realizar login com Google: ' + (err.message || 'Erro desconhecido'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-dracula-bg p-4">
      <div className="w-full max-w-md animate-in fade-in zoom-in duration-500">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-dracula-purple/20 rounded-3xl flex items-center justify-center text-dracula-purple mx-auto mb-4 shadow-xl shadow-dracula-purple/10">
            <HardDrive size={40} />
          </div>
          <h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white mb-2">AssetFlow</h1>
          <p className="text-slate-500 dark:text-dracula-comment font-medium">Sistema Inteligente de Gestão de Ativos</p>
        </div>

        <div className="bg-white dark:bg-dracula-darker p-8 rounded-[2.5rem] shadow-2xl border border-slate-100 dark:border-dracula-current">
          <div className="space-y-6">
            <p className="text-center text-slate-600 dark:text-dracula-comment mb-4">
              Acesse o sistema utilizando sua conta Google corporativa.
            </p>

            {error && (
              <div className="flex items-center gap-2 text-rose-500 text-sm font-bold bg-rose-50 dark:bg-rose-500/10 p-4 rounded-xl animate-in shake duration-300">
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}

            <button
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="w-full py-4 bg-white dark:bg-dracula-bg text-slate-700 dark:text-white border-2 border-slate-200 dark:border-dracula-current rounded-2xl font-bold text-lg shadow-lg hover:bg-slate-50 dark:hover:bg-dracula-current transition-all flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="animate-spin" size={24} />
              ) : (
                <>
                  <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-6 h-6" />
                  Entrar com Google
                </>
              )}
            </button>
          </div>
        </div>

        <p className="text-center mt-8 text-xs text-slate-400 dark:text-dracula-comment uppercase tracking-[0.2em] font-bold">
          Acesso Restrito à Equipe de TI
        </p>
      </div>
    </div>
  );
};

export default LoginScreen;
