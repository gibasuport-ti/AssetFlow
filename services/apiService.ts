
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  where,
  onSnapshot,
  Timestamp
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { AssetExchange, User, MockEmail } from '../types';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

class FirebaseApiService {
  private exchangesPath = 'exchanges';
  private usersPath = 'users';
  private emailsPath = 'emails';
  private apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';

  // Exchanges
  async getAll(): Promise<AssetExchange[]> {
    try {
      const q = query(collection(db, this.exchangesPath), orderBy('timestamp', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as AssetExchange));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, this.exchangesPath);
      return [];
    }
  }

  subscribeExchanges(callback: (exchanges: AssetExchange[]) => void) {
    const q = query(collection(db, this.exchangesPath), orderBy('timestamp', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const exchanges = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as AssetExchange));
      callback(exchanges);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, this.exchangesPath);
    });
  }

  async save(exchange: AssetExchange): Promise<void> {
    try {
      const docRef = doc(db, this.exchangesPath, exchange.id);
      const data = {
        ...exchange,
        createdBy: auth.currentUser?.uid || 'system'
      };
      await setDoc(docRef, data);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `${this.exchangesPath}/${exchange.id}`);
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, this.exchangesPath, id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${this.exchangesPath}/${id}`);
    }
  }

  // Users
  async getAllUsers(): Promise<User[]> {
    try {
      const snapshot = await getDocs(collection(db, this.usersPath));
      return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as User));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, this.usersPath);
      return [];
    }
  }

  async saveUser(user: User): Promise<void> {
    try {
      const docRef = doc(db, this.usersPath, user.id);
      await setDoc(docRef, user);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `${this.usersPath}/${user.id}`);
    }
  }

  async deleteUser(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, this.usersPath, id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${this.usersPath}/${id}`);
    }
  }

  async getUserById(id: string): Promise<User | null> {
    try {
      const docSnap = await getDoc(doc(db, this.usersPath, id));
      if (docSnap.exists()) {
        return { ...docSnap.data(), id: docSnap.id } as User;
      }
      return null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `${this.usersPath}/${id}`);
      return null;
    }
  }

  // Emails
  async getAllEmails(): Promise<MockEmail[]> {
    try {
      const snapshot = await getDocs(collection(db, this.emailsPath));
      return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as MockEmail));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, this.emailsPath);
      return [];
    }
  }

  subscribeEmails(callback: (emails: MockEmail[]) => void) {
    const q = query(collection(db, this.emailsPath), orderBy('sentAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const emails = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as MockEmail));
      callback(emails);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, this.emailsPath);
    });
  }

  async saveEmail(email: MockEmail): Promise<void> {
    try {
      const docRef = doc(db, this.emailsPath, email.id);
      await setDoc(docRef, email);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `${this.emailsPath}/${email.id}`);
    }
  }

  // DocuSign
  async createDocuSignEnvelope(exchange: AssetExchange, pdfBase64: string): Promise<{ envelopeId: string, url: string }> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/docusign/create-envelope`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exchange, pdfBase64 })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao criar envelope DocuSign');
      }
      
      return await response.json();
    } catch (error) {
      console.error('DocuSign API Error:', error);
      throw error;
    }
  }
  // AI Insights
  async analyzeInventory(inventoryData: AssetExchange[]): Promise<string> {
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error('Usuário não autenticado');

      const response = await fetch(`${this.apiBaseUrl}/api/ai/analyze-inventory`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ inventoryData })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro na análise da IA');
      }
      
      const data = await response.json();
      return data.analysis;
    } catch (error) {
      console.error('AI Service Error:', error);
      throw error;
    }
  }
}

export const apiService = new FirebaseApiService();
