import { useState, useRef } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Loader2, FileText, Send, AlertCircle, UploadCloud, X, File as FileIcon, Printer, CheckCircle2 } from 'lucide-react';
import html2pdf from 'html2pdf.js';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const SYSTEM_INSTRUCTION = `Ets un Analista de Premsa Polític i Cap de Gabinet expert.
El destinatari del teu informe és el President de Catalunya. El President ja coneix els fets bàsics de l'actualitat.
El teu objectiu no és resumir notícies, sinó extreure els matisos, els marcs narratius (frames) de cada diari i donar molta importància al pols territorial.

Requisit d'idioma: Has d'analitzar i generar la resposta EXACTAMENT en el mateix idioma en què estigui escrit el recull de notícies (català o castellà).
L'informe no ha de tenir salutacions, ha de ser directe, analític i institucional.

MOLT IMPORTANT: L'informe ha de ser extens, profund i molt polit. Desenvolupa bé cada punt. Utilitza format Markdown ric: llistes amb vinyetes (bullets) per fer-ho molt visual i fàcil de llegir, i negretes per destacar conceptes clau, mitjans o noms propis.

L'informe s'ha de retornar en format JSON seguint l'esquema proporcionat, amb les següents seccions:

1. RESUM DE PORTADES: Fes un resum de les portades dels diaris per avaluar la rellevància de les notícies. Dedica una vinyeta (bullet) a cada mitjà resumint les notícies que cobreix a la seva portada. (Format Markdown)

2. MAPA DE RELATS I ENFOCAMENTS MEDIÀTICS: Identifica els 3-4 temes principals del dia de forma extensa. Omet el resum dels fets i passa directament a contrastar com ho tracta cada mitjà. Fes servir llistes amb vinyetes (bullets) destacant els matisos, la intencionalitat política, l'enfocament (crític, favorable, alarmista, econòmic, etc.) i les diferències de relat entre les principals capçaleres. (Format Markdown)

3. PREMSA COMARCAL: Aquesta secció és prioritària i ha de ser extensa. Extreu de manera específica i detallada què està publicant la premsa regional i comarcal present al clipping. Identifica preocupacions locals, projectes específics del territori o com les grans polítiques nacionals aterren a les comarques. Indica sempre el nom del mitjà local i utilitza vinyetes per separar cada territori o mitjà. (Format Markdown)

4. RADAR D'OPINIÓ I EDITORIALS CLAU: Selecciona els 3 o 4 articles d'opinió o editorials amb major impacte polític o institucional. Estructura per a cadascun de forma visual:
* **[Nom del Mitjà] - [Autor o Editorial]**
  * **Tesi estratègica:** [anàlisi detallada de la intenció de fons]
  * **Cita reveladora:** "[frase literal entre cometes que condensi el missatge al Govern]"
(Format Markdown)

5. MENCIONS A ALBERT DALMAU: Indica explícitament si el nom d'Albert Dalmau o el càrrec de "Conseller de la Presidència" ha sigut esmentat en el recull, i en quin context.`;

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    resumPortades: { type: Type.STRING, description: "Text en Markdown per a la secció RESUM DE PORTADES" },
    mapaRelats: { type: Type.STRING, description: "Text en Markdown per a la secció MAPA DE RELATS" },
    premsaComarcalText: { type: Type.STRING, description: "Text en Markdown per a la secció PREMSA COMARCAL" },
    radarOpinio: { type: Type.STRING, description: "Text en Markdown per a la secció RADAR D'OPINIÓ" },
    mencionsDalmau: {
      type: Type.OBJECT,
      description: "Informació sobre si s'esmenta a Albert Dalmau o al Conseller de la Presidència",
      properties: {
        esmentat: { type: Type.BOOLEAN, description: "Cert si s'esmenta, fals si no" },
        context: { type: Type.STRING, description: "Si s'esmenta, explica detalladament el context. Si no, deixa-ho buit o posa 'No s'ha esmentat'." }
      },
      required: ["esmentat", "context"]
    }
  },
  required: ["resumPortades", "mapaRelats", "premsaComarcalText", "radarOpinio", "mencionsDalmau"]
};

interface ReportData {
  resumPortades: string;
  mapaRelats: string;
  premsaComarcalText: string;
  radarOpinio: string;
  mencionsDalmau: { esmentat: boolean; context: string };
}

export default function App() {
  const [clipping, setClipping] = useState('');
  const [pdfFiles, setPdfFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [report, setReport] = useState<ReportData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result.split(',')[1]);
        } else {
          reject(new Error('Failed to read file'));
        }
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter(
      f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
    );
    if (files.length > 0) {
      setPdfFiles(prev => [...prev, ...files]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files).filter(
        f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
      );
      setPdfFiles(prev => [...prev, ...files]);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (index: number) => {
    setPdfFiles(prev => prev.filter((_, i) => i !== index));
  };

  const generateReport = async () => {
    if (!clipping.trim() && pdfFiles.length === 0) {
      setError('Si us plau, introdueix text o adjunta un arxiu PDF.');
      return;
    }

    setIsLoading(true);
    setError('');
    setReport(null);

    try {
      const parts: any[] = [];
      
      if (clipping.trim()) {
        parts.push({ text: clipping });
      }

      for (const file of pdfFiles) {
        try {
          const base64Data = await fileToBase64(file);
          parts.push({
            inlineData: {
              data: base64Data,
              mimeType: 'application/pdf'
            }
          });
        } catch (err) {
          throw new Error(`No s'ha pogut processar l'arxiu: ${file.name}`);
        }
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: { parts },
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          temperature: 0.4,
          responseMimeType: 'application/json',
          responseSchema: responseSchema,
        },
      });

      if (response.text) {
        try {
          const parsedReport = JSON.parse(response.text) as ReportData;
          setReport(parsedReport);
        } catch (e) {
          setError('S\'ha rebut una resposta invàlida del model.');
        }
      } else {
        setError('No s\'ha pogut generar l\'informe.');
      }
    } catch (err: any) {
      console.error('Error generating report:', err);
      setError(err.message || 'Hi ha hagut un error en comunicar-se amb l\'API de Gemini. Si els arxius són molt grans, prova de reduir-ne la mida.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadPDF = () => {
    const element = document.getElementById('report-content');
    if (!element) return;
    
    // Create a clone to modify styles for PDF without affecting the UI
    const clone = element.cloneNode(true) as HTMLElement;
    
    // Make print-only elements visible in the clone
    const printHeaders = clone.querySelectorAll('.print\\:block');
    printHeaders.forEach(el => {
      (el as HTMLElement).classList.remove('hidden');
      (el as HTMLElement).classList.remove('print:block');
      (el as HTMLElement).style.display = 'block';
    });
    
    const opt = {
      margin:       15,
      filename:     'informe-premsa-politica.pdf',
      image:        { type: 'jpeg' as const, quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, windowWidth: 800 },
      jsPDF:        { unit: 'mm' as const, format: 'a4', orientation: 'portrait' as const },
      pagebreak:    { mode: ['css', 'legacy'], avoid: ['h2', 'h3', 'p', 'li', 'blockquote', '.print\\:break-inside-avoid'] }
    };
    
    html2pdf().set(opt).from(clone).save();
  };

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans selection:bg-stone-200 print:bg-white">
      <header className="bg-white border-b border-stone-200 sticky top-0 z-10 print:hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-stone-900 text-white p-2 rounded-lg">
              <FileText size={20} />
            </div>
            <div>
              <h1 className="font-semibold text-lg leading-tight">Gabinete de Análisis</h1>
              <p className="text-xs text-stone-500 font-medium tracking-wide uppercase">Presidència de la Generalitat</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 print:p-0 print:max-w-none">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 print:block">
          
          {/* Input Section */}
          <div className="lg:col-span-4 flex flex-col gap-4 print:hidden">
            <div className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden flex flex-col h-[calc(100vh-8rem)]">
              <div className="p-4 border-b border-stone-100 bg-stone-50/50">
                <h2 className="font-medium text-sm text-stone-700 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-stone-400"></span>
                  Entrada de Dades (Clipping)
                </h2>
              </div>
              
              <div className="flex-1 p-4 flex flex-col">
                <textarea
                  value={clipping}
                  onChange={(e) => setClipping(e.target.value)}
                  placeholder="Enganxa aquí el text del recull de notícies..."
                  className="flex-1 w-full resize-none outline-none text-sm leading-relaxed text-stone-700 placeholder:text-stone-400 bg-transparent"
                  spellCheck={false}
                />
              </div>

              {/* Drag & Drop PDF Section */}
              <div 
                className={`p-4 border-t border-stone-100 transition-colors ${isDragging ? 'bg-stone-100 border-stone-300' : 'bg-stone-50/50'}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <div className="flex flex-col gap-3">
                  {pdfFiles.length > 0 && (
                    <div className="flex flex-col gap-2 mb-1 max-h-32 overflow-y-auto pr-1">
                      {pdfFiles.map((file, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-white p-2 rounded-lg border border-stone-200 text-sm shadow-sm">
                          <div className="flex items-center gap-2 overflow-hidden">
                            <FileIcon size={16} className="text-red-500 shrink-0" />
                            <span className="truncate text-stone-700 font-medium">{file.name}</span>
                            <span className="text-stone-400 text-xs shrink-0">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                          </div>
                          <button onClick={() => removeFile(idx)} className="text-stone-400 hover:text-red-500 p-1 rounded-md hover:bg-red-50 transition-colors">
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <label className="flex flex-col items-center justify-center gap-2 w-full border-2 border-dashed border-stone-300 rounded-xl p-4 cursor-pointer hover:bg-stone-50 hover:border-stone-400 transition-colors group">
                    <div className="bg-stone-100 p-2 rounded-full group-hover:bg-stone-200 transition-colors">
                      <UploadCloud size={20} className="text-stone-500" />
                    </div>
                    <div className="text-center">
                      <span className="text-sm text-stone-700 font-medium block">Adjuntar arxius PDF</span>
                      <span className="text-xs text-stone-500 block mt-0.5">Arrossega'ls aquí o fes clic</span>
                    </div>
                    <input 
                      type="file" 
                      multiple 
                      accept=".pdf,application/pdf" 
                      className="hidden" 
                      onChange={handleFileSelect} 
                      ref={fileInputRef}
                    />
                  </label>
                </div>
              </div>

              <div className="p-4 border-t border-stone-100 bg-white">
                <button
                  onClick={generateReport}
                  disabled={isLoading || (!clipping.trim() && pdfFiles.length === 0)}
                  className="w-full flex items-center justify-center gap-2 bg-stone-900 hover:bg-stone-800 text-white py-2.5 px-4 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  {isLoading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Processant anàlisi...
                    </>
                  ) : (
                    <>
                      <Send size={16} />
                      Generar Informe Executiu
                    </>
                  )}
                </button>
                {error && (
                  <div className="mt-3 flex items-start gap-2 text-red-600 text-xs bg-red-50 p-3 rounded-md border border-red-100">
                    <AlertCircle size={14} className="shrink-0 mt-0.5" />
                    <p>{error}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Output Section */}
          <div className="lg:col-span-8 print:w-full print:block">
            <div className="bg-white rounded-xl shadow-sm border border-stone-200 min-h-[calc(100vh-8rem)] flex flex-col print:border-none print:shadow-none print:min-h-0">
              <div className="p-4 border-b border-stone-100 bg-stone-50/50 flex items-center justify-between print:hidden">
                <div className="flex items-center gap-3">
                  <h2 className="font-medium text-sm text-stone-700 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    Informe d'Intel·ligència
                  </h2>
                  {report && (
                    <span className="text-xs font-medium text-stone-500 bg-stone-100 px-2 py-1 rounded-md">
                      Confidencial
                    </span>
                  )}
                </div>
                {report && (
                  <button
                    onClick={handleDownloadPDF}
                    className="flex items-center gap-2 bg-white border border-stone-200 hover:bg-stone-50 text-stone-700 py-1.5 px-3 rounded-md text-xs font-medium transition-colors shadow-sm"
                  >
                    <Printer size={14} />
                    Descarregar PDF
                  </button>
                )}
              </div>
              
              <div className="p-6 lg:p-10 flex-1 overflow-y-auto print:p-0 print:overflow-visible">
                {!report && !isLoading ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-stone-400 space-y-4 print:hidden">
                    <div className="w-16 h-16 rounded-full bg-stone-50 flex items-center justify-center border border-stone-100">
                      <FileText size={24} className="text-stone-300" />
                    </div>
                    <div className="max-w-xs">
                      <p className="text-sm">L'informe apareixerà aquí un cop processat el clipping de premsa.</p>
                    </div>
                  </div>
                ) : isLoading ? (
                  <div className="h-full flex flex-col items-center justify-center text-stone-400 space-y-4 print:hidden">
                    <Loader2 size={32} className="animate-spin text-stone-300" />
                    <p className="text-sm animate-pulse">Analitzant marcs narratius i pols territorial...</p>
                  </div>
                ) : report ? (
                  <div className="print:p-0" id="report-content">
                    {/* Print-only Header */}
                    <div className="hidden print:block mb-8 border-b-2 border-stone-900 pb-4">
                      <h1 className="text-2xl font-bold text-stone-900">Informe d'Intel·ligència Executiva</h1>
                      <p className="text-stone-500 font-medium tracking-wide uppercase text-sm mt-1">Presidència de la Generalitat</p>
                    </div>

                    <div className="prose prose-stone prose-sm sm:prose-base max-w-none
                      prose-headings:font-semibold prose-headings:tracking-tight
                      prose-p:text-stone-700 prose-p:leading-relaxed
                      prose-li:text-stone-700
                      prose-strong:text-stone-900 prose-strong:font-semibold
                      prose-blockquote:border-l-4 prose-blockquote:border-stone-300 prose-blockquote:bg-stone-50 prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:text-stone-700 prose-blockquote:font-serif prose-blockquote:italic
                      marker:text-stone-400">
                      
                      <h2 className="text-stone-900 border-b border-stone-200 pb-2 mb-4 font-semibold tracking-tight uppercase text-sm">Resum de Portades</h2>
                      <Markdown remarkPlugins={[remarkGfm]}>{report.resumPortades}</Markdown>

                      <h2 className="text-stone-900 border-b border-stone-200 pb-2 mt-10 mb-4 font-semibold tracking-tight uppercase text-sm">Mapa de Relats i Enfocaments Mediàtics</h2>
                      <Markdown remarkPlugins={[remarkGfm]}>{report.mapaRelats}</Markdown>

                      <h2 className="text-stone-900 border-b border-stone-200 pb-2 mt-10 mb-4 font-semibold tracking-tight uppercase text-sm">Premsa Comarcal</h2>
                      <Markdown remarkPlugins={[remarkGfm]}>{report.premsaComarcalText}</Markdown>

                      <h2 className="text-stone-900 border-b border-stone-200 pb-2 mt-10 mb-4 font-semibold tracking-tight uppercase text-sm">Radar d'Opinió i Editorials Clau</h2>
                      <Markdown remarkPlugins={[remarkGfm]}>{report.radarOpinio}</Markdown>
                    </div>

                    {/* Dalmau Mention */}
                    <div className={`mt-10 p-5 rounded-xl border print:break-inside-avoid flex items-start gap-4 ${report.mencionsDalmau.esmentat ? 'bg-amber-50 border-amber-200' : 'bg-stone-50 border-stone-200'}`}>
                      <div className={`p-2 rounded-full shrink-0 ${report.mencionsDalmau.esmentat ? 'bg-amber-100 text-amber-700' : 'bg-stone-200 text-stone-500'}`}>
                        {report.mencionsDalmau.esmentat ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
                      </div>
                      <div>
                        <h3 className={`font-semibold text-sm ${report.mencionsDalmau.esmentat ? 'text-amber-900' : 'text-stone-700'}`}>
                          Monitorització: Albert Dalmau / Conseller de la Presidència
                        </h3>
                        <p className={`text-sm mt-1 leading-relaxed ${report.mencionsDalmau.esmentat ? 'text-amber-800' : 'text-stone-600'}`}>
                          {report.mencionsDalmau.context}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
