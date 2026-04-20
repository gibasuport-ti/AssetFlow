
import React, { useState, useRef } from 'react';
import { AssetExchange, LogoPreference } from '../types';
import { FileDown, Trash2, Search, FileSpreadsheet, Pencil, Mail, Laptop, Smartphone, Cpu, Clock, Lock, FileCheck, Upload, Fingerprint, Filter, Download, Loader2, Send, FileText, ExternalLink } from 'lucide-react';
import { generateAssetPDF, getPDFFileName } from '../services/pdfService';
import { exportToExcel, importFromExcel } from '../services/excelService';

interface InventoryTableProps {
  exchanges: AssetExchange[];
  onDelete: (id: string) => void;
  onEdit: (exchange: AssetExchange) => void;
  onNotify: (message: string, type: 'success' | 'error') => void;
  onSignStart: (exchange: AssetExchange) => void;
  onStatusChange: (id: string, status: 'draft' | 'pending_receiver' | 'completed') => void;
  onCompleteRequest: (id: string) => void;
  onBulkImport: (data: AssetExchange[]) => void;
  logoPref: LogoPreference;
}

const InventoryTable: React.FC<InventoryTableProps> = ({ exchanges, onDelete, onEdit, onNotify, onSignStart, onStatusChange, onCompleteRequest, onBulkImport, logoPref }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadForManualSend = async (ex: AssetExchange) => {
    if (!ex.assinatura_ti) {
      onNotify("Você precisa assinar o termo antes de enviar!", "error");
      onEdit(ex); // Abre o editor para o TI assinar
      return;
    }

    setIsSendingEmail(ex.id);
    try {
      const pdf = generateAssetPDF(ex, logoPref);
      if (!pdf) throw new Error("Falha ao gerar PDF");
      
      const fileName = getPDFFileName(ex);
      pdf.save(fileName);
      onNotify("PDF baixado! Agora você pode enviá-lo manualmente pelo seu Outlook.", "success");
    } catch (error: any) {
      onNotify(error.message || "Erro ao gerar PDF", "error");
    } finally {
      setIsSendingEmail(null);
    }
  };

  const handleDocuSignClick = () => {
    window.open("https://apps.docusign.com/send/home", "_blank");
  };

  const filtered = exchanges.filter(e => 
    e.colaborador_nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
    e.entregue_serial.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.devolvido_serial.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await importFromExcel(file);
      onBulkImport(data);
      onNotify("Base sincronizada!", "success");
    } catch (err) {
      onNotify("Erro no Excel.", "error");
    }
  };

  const getIcon = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes('note')) return <Laptop size={14} />;
    if (t.includes('smart')) return <Smartphone size={14} />;
    return <Cpu size={14} />;
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-dracula-darker transition-colors duration-200">
      
      {/* Search and Action Bar - Mobile Optimized */}
      <div className="p-4 md:p-6 border-b dark:border-dracula-current flex flex-col gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            placeholder="Buscar..."
            className="w-full pl-10 pr-4 py-3 rounded-2xl border bg-slate-50 dark:bg-dracula-bg dark:text-dracula-fg text-sm outline-none focus:ring-2 ring-dracula-purple/30"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".xlsx, .xls" className="hidden" />
          <button onClick={handleImportClick} className="flex items-center gap-2 bg-slate-100 dark:bg-dracula-bg px-4 py-2.5 rounded-xl font-bold text-xs whitespace-nowrap"><Upload size={14}/> Importar</button>
          <button onClick={() => exportToExcel(exchanges)} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-xl font-bold text-xs whitespace-nowrap"><FileSpreadsheet size={14}/> Excel</button>
          <button onClick={handleDocuSignClick} className="flex items-center gap-2 bg-dracula-pink/10 text-dracula-pink px-4 py-2.5 rounded-xl font-bold text-xs whitespace-nowrap border border-dracula-pink/20"><ExternalLink size={14}/> Abrir DocuSign</button>
          <button className="flex items-center gap-2 bg-slate-100 dark:bg-dracula-bg px-4 py-2.5 rounded-xl font-bold text-xs whitespace-nowrap"><Filter size={14}/> Filtros</button>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto relative">
        <table className="w-full text-left min-w-[800px]">
          <thead className="bg-slate-50 dark:bg-dracula-darker sticky top-0 z-10 border-b dark:border-dracula-current">
            <tr>
              <th className="px-6 py-4 text-[10px] font-bold uppercase text-slate-400">Colaborador</th>
              <th className="px-6 py-4 text-[10px] font-bold uppercase text-slate-400">Entregue</th>
              <th className="px-6 py-4 text-[10px] font-bold uppercase text-slate-400">Devolvido</th>
              <th className="px-6 py-4 text-[10px] font-bold uppercase text-slate-400 text-center">Status</th>
              <th className="px-6 py-4 text-[10px] font-bold uppercase text-slate-400 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y dark:divide-dracula-current">
            {filtered.map(ex => (
              <tr key={ex.id} className="hover:bg-slate-50/50 dark:hover:bg-dracula-bg/50 transition-colors">
                <td className="px-6 py-4">
                  <div className="font-bold text-sm">{ex.colaborador_nome}</div>
                  <div className="text-[10px] text-slate-400 truncate max-w-[120px]">{ex.colaborador_email}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] font-bold text-emerald-600 flex items-center gap-1">{getIcon(ex.entregue_tipo)} {ex.entregue_tipo}</span>
                    <div className="px-2 py-0.5 bg-blue-50 dark:bg-dracula-cyan/10 border border-blue-100 dark:border-dracula-cyan/20 rounded-md inline-block">
                      <span className="text-[9px] font-mono font-bold text-blue-700 dark:text-dracula-cyan">{ex.entregue_serial}</span>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] font-bold text-rose-600 flex items-center gap-1">{getIcon(ex.devolvido_tipo)} {ex.devolvido_tipo}</span>
                    <div className="px-2 py-0.5 bg-rose-50 dark:bg-dracula-red/10 border border-rose-100 dark:border-dracula-red/20 rounded-md inline-block">
                      <span className="text-[9px] font-mono font-bold text-rose-700 dark:text-dracula-red">{ex.devolvido_serial}</span>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-center">
                  <StatusBadge status={ex.status} docusignStatus={ex.docusign_status} onClick={() => {
                    const doc = generateAssetPDF(ex, logoPref);
                    if (doc) {
                      const blobUrl = doc.output('bloburl');
                      window.open(blobUrl, '_blank');
                    }
                  }} />
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-1">
                    {ex.status === 'completed' && (
                      <button 
                        onClick={() => {
                          const doc = generateAssetPDF(ex, logoPref);
                          if (doc) doc.save(getPDFFileName(ex));
                        }} 
                        className="p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg transition-colors"
                        title="Baixar Termo Assinado"
                      >
                        <Download size={16}/>
                      </button>
                    )}
                    {ex.status === 'draft' && (
                      <>
                        <button 
                          onClick={() => handleDownloadForManualSend(ex)} 
                          disabled={isSendingEmail === ex.id}
                          className="p-2 text-dracula-pink hover:bg-dracula-pink/10 rounded-lg transition-colors"
                          title="DocuSign Manual (Baixar PDF)"
                        >
                          {isSendingEmail === ex.id ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16}/>}
                        </button>
                        <button onClick={() => onSignStart(ex)} className="p-2 text-blue-600" title="Assinar como Colaborador"><Mail size={16}/></button>
                      </>
                    )}
                    {ex.status !== 'completed' && (
                      <button 
                        onClick={() => onCompleteRequest(ex.id)}
                        className="p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg transition-colors"
                        title="Concluir Manualmente"
                      >
                        <FileCheck size={16} />
                      </button>
                    )}
                    <button onClick={() => onEdit(ex)} className="p-2 text-slate-400"><Pencil size={16}/></button>
                    <button onClick={() => onDelete(ex.id)} className="p-2 text-rose-500"><Trash2 size={16}/></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const StatusBadge = ({ status, docusignStatus, onClick }: any) => {
  if (status === 'completed') return (
    <button 
      onClick={onClick} 
      className="text-[9px] font-bold bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-full border border-emerald-200 hover:bg-emerald-200 transition-colors flex items-center gap-1 mx-auto"
      title="Clique para baixar o documento assinado"
    >
      <FileCheck size={12} /> ASSINADO
    </button>
  );

  if (docusignStatus === 'pending') return (
    <span className="text-[9px] font-bold bg-amber-100 text-amber-700 px-3 py-1.5 rounded-full border border-amber-200 flex items-center gap-1 justify-center">
      <Clock size={12} /> AGUARDANDO ASSINATURA
    </span>
  );

  if (docusignStatus === 'declined' || docusignStatus === 'voided') return (
    <span className="text-[9px] font-bold bg-rose-100 text-rose-700 px-3 py-1.5 rounded-full border border-rose-200 flex items-center gap-1 justify-center">
      <Lock size={12} /> RECUSADO/CANCELADO
    </span>
  );

  if (status === 'pending_receiver') return <span className="text-[9px] font-bold bg-blue-100 text-blue-700 px-3 py-1.5 rounded-full border border-blue-200">PENDENTE</span>;
  return <span className="text-[9px] font-bold bg-slate-100 text-slate-500 px-3 py-1.5 rounded-full border border-slate-200">RASCUNHO</span>;
};

export default InventoryTable;
