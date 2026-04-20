import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import axios from 'axios';
import docusign from 'docusign-esign';
import fs from 'fs-extra';
import admin from 'firebase-admin';
import { GoogleGenAI } from '@google/genai';

// Initialize Firebase Admin
if (!admin.apps.length) {
  const firebaseConfigPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(firebaseConfigPath)) {
    const firebaseConfig = fs.readJsonSync(firebaseConfigPath);
    admin.initializeApp({
      projectId: firebaseConfig.projectId
    });
  } else {
    admin.initializeApp({
      projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'assetflow-gestao-de-ativos'
    });
  }
}
const db = admin.firestore();

// AI Initialization (Lazy)
let genAI: any = null;
const getGenAI = () => {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('GEMINI_API_KEY not found in environment');
      return null;
    }
    // O SDK pode esperar um objeto { apiKey } ou string dependendo da versão
    genAI = new GoogleGenAI(apiKey as any);
  }
  return genAI;
};

dotenv.config();

// Suporte para __dirname em ESM e CJS
const getDirname = () => {
  try {
    return path.dirname(fileURLToPath(import.meta.url));
  } catch (e) {
    return __dirname;
  }
};
const __dirname_val = getDirname();

console.log('--- INICIANDO SERVIDOR ASSETFLOW ---');

async function startServer() {
  try {
    console.log('Configurando Express...');
    const app = express();
    const PORT = 3000;

    app.use(express.json({ limit: '50mb' }));
    app.use(cookieParser());

    // Middleware de Autenticação para Rotas da API
    const authenticate = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Não autorizado. Token de acesso ausente.' });
      }

      const idToken = authHeader.split('Bearer ')[1];
      try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        (req as any).user = decodedToken;
        next();
      } catch (error) {
        console.error('Erro ao verificar token ID:', error);
        res.status(401).json({ error: 'Não autorizado. Token inválido.' });
      }
    };

    // --- DocuSign Integration ---
    const dsConfig = {
      clientId: process.env.DOCUSIGN_CLIENT_ID,
      userId: process.env.DOCUSIGN_USER_ID,
      accountId: process.env.DOCUSIGN_ACCOUNT_ID,
      privateKey: process.env.DOCUSIGN_PRIVATE_KEY,
      basePath: process.env.DOCUSIGN_BASE_PATH || 'https://demo.docusign.net/restapi',
      localSavePath: process.env.DOCUSIGN_LOCAL_SAVE_PATH || './signed_documents',
      companyEmail: process.env.DOCUSIGN_COMPANY_EMAIL || 'ti@cirion.com',
      companyName: process.env.DOCUSIGN_COMPANY_NAME || 'Gestão de TI'
    };

    app.get('/api/docusign/config-status', (req, res) => {
      const guidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      
      const privateKeyRaw = dsConfig.privateKey || '';
      const hasBegin = privateKeyRaw.includes('-----BEGIN');
      const hasEnd = privateKeyRaw.includes('-----END');
      const hasNewLines = privateKeyRaw.includes('\n');
      const hasLiteralNewLines = privateKeyRaw.includes('\\n');

      const status = {
        DOCUSIGN_CLIENT_ID: {
          set: !!dsConfig.clientId,
          valid: dsConfig.clientId ? guidRegex.test(dsConfig.clientId) : false,
          message: !dsConfig.clientId ? 'Não configurado' : (!guidRegex.test(dsConfig.clientId) ? 'Formato inválido (deve ser um GUID)' : 'Configurado corretamente')
        },
        DOCUSIGN_USER_ID: {
          set: !!dsConfig.userId,
          valid: dsConfig.userId ? guidRegex.test(dsConfig.userId) : false,
          message: !dsConfig.userId ? 'Não configurado' : (!guidRegex.test(dsConfig.userId) ? 'Formato inválido (deve ser um GUID - API User ID)' : 'Configurado corretamente')
        },
        DOCUSIGN_ACCOUNT_ID: {
          set: !!dsConfig.accountId,
          valid: !!dsConfig.accountId,
          message: !dsConfig.accountId ? 'Não configurado' : 'Configurado'
        },
        DOCUSIGN_PRIVATE_KEY: {
          set: !!dsConfig.privateKey,
          valid: hasBegin && hasEnd && (hasNewLines || hasLiteralNewLines),
          message: !dsConfig.privateKey ? 'Não configurado' : 
                   (!hasBegin ? 'Faltando cabeçalho (-----BEGIN RSA PRIVATE KEY-----)' : 
                   (!hasEnd ? 'Faltando rodapé (-----END RSA PRIVATE KEY-----)' : 
                   (!hasNewLines && !hasLiteralNewLines ? 'Chave em linha única (faltando quebras de linha)' : 'Configurado corretamente')))
        },
        DOCUSIGN_BASE_PATH: {
          value: dsConfig.basePath,
          environment: dsConfig.basePath.includes('demo') ? 'DEMO (Sandbox)' : 'PRODUÇÃO'
        }
      };

      const allValid = status.DOCUSIGN_CLIENT_ID.valid && 
                       status.DOCUSIGN_USER_ID.valid && 
                       status.DOCUSIGN_ACCOUNT_ID.valid && 
                       status.DOCUSIGN_PRIVATE_KEY.set;

      res.json({ allValid, status });
    });

    // API Routes
    app.get('/api/health', (req, res) => {
      console.log('Health check solicitado');
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // AI Insights Route
    app.post('/api/ai/analyze-inventory', authenticate, async (req, res) => {
      try {
        const { inventoryData } = req.body;
        const ai = getGenAI();
        if (!ai) return res.status(503).json({ error: 'Serviço de IA não configurado.' });

        const model = ai.getGenerativeModel({ model: 'gemini-2.0-flash' });
        const prompt = `Analise os seguintes dados de inventário de ativos de TI e forneça 3 recomendações rápidas de otimização ou segurança: \n\n ${JSON.stringify(inventoryData)}`;
        
        const result = await model.generateContent(prompt);
        const response = await result.response;
        res.json({ analysis: response.text() });
      } catch (error) {
        console.error('Erro na análise da IA:', error);
        res.status(500).json({ error: 'Erro ao processar análise inteligente.' });
      }
    });

    // DocuSign Envelope Route (Protected)
    app.post('/api/docusign/create-envelope', authenticate, async (req, res) => {
      // Skeleton for DocuSign implementation
      // Security: authenticate middleware ensures only logged-in Firebase users reach here
      res.status(501).json({ error: 'Integração DocuSign Server-Side em desenvolvimento.' });
    });

    // Identifica se é produção
    const isProd = process.env.NODE_ENV === 'production' || !fs.existsSync(path.join(__dirname_val, 'server.ts'));
    console.log(`Modo de execução: ${isProd ? 'PRODUÇÃO' : 'DESENVOLVIMENTO'}`);

    if (!isProd) {
      console.log('Iniciando Vite em modo middleware...');
      try {
        // Import dinâmico para evitar erro em produção onde o Vite não existe
        const { createServer: createViteServer } = await import('vite');
        const vite = await createViteServer({
          server: { 
            middlewareMode: true,
            hmr: false
          },
          appType: 'spa',
        });
        app.use(vite.middlewares);
        
        app.get('*all', async (req, res, next) => {
          if (req.originalUrl.startsWith('/api') || req.originalUrl.startsWith('/auth')) {
            return next();
          }
          try {
            let template = fs.readFileSync(path.resolve(__dirname_val, 'index.html'), 'utf-8');
            template = await vite.transformIndexHtml(req.originalUrl, template);
            res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
          } catch (e) {
            next(e);
          }
        });
      } catch (viteError) {
        console.error('ERRO AO INICIAR VITE:', viteError);
      }
    } else {
      console.log('Servindo arquivos estáticos...');
      // Se estivermos rodando o server.cjs dentro da pasta dist, a pasta dist é a atual.
      // Caso contrário, a pasta dist está um nível abaixo.
      const distPath = __dirname_val.endsWith('dist') ? __dirname_val : path.join(__dirname_val, 'dist');
      console.log(`Caminho dos arquivos estáticos: ${distPath}`);
      
      app.use(express.static(distPath));
      app.get('*all', (req, res) => {
        const indexPath = path.join(distPath, 'index.html');
        if (fs.existsSync(indexPath)) {
          res.sendFile(indexPath);
        } else {
          res.status(404).send(`Erro: index.html não encontrado em ${indexPath}`);
        }
      });
    }

    app.listen(PORT, '127.0.0.1', () => {
      console.log(`✅ Servidor pronto e ouvindo em http://127.0.0.1:${PORT}`);
    });
  } catch (err) {
    console.error('ERRO FATAL NO STARTUP:', err);
  }
}

console.log('Chamando startServer()...');
startServer();
