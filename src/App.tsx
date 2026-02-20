import React, { useState, useCallback } from 'react';
import { 
  FileUp, 
  Link as LinkIcon, 
  Type as TypeIcon, 
  Clipboard, 
  Check, 
  Loader2, 
  AlertCircle,
  ArrowRight,
  Info,
  Trash2,
  Download,
  FileText
} from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'motion/react';
import * as mammoth from 'mammoth';
import * as pdfjs from 'pdfjs-dist';
import { jsPDF } from 'jspdf';
import { convertToPressbooks, ConversionResult } from './services/geminiService';

// Set PDF.js worker using the local worker from the package
// @ts-ignore
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker;
import Markdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [input, setInput] = useState('');
  const [url, setUrl] = useState('');
  const [result, setResult] = useState<ConversionResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'text' | 'file' | 'url'>('text');

  const extractTextFromPDF = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      fullText += pageText + '\n';
    }
    return fullText;
  };

  const extractTextFromDocx = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.convertToHtml({ arrayBuffer });
    return result.value;
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);

    try {
      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        const text = await extractTextFromPDF(file);
        setInput(text);
      } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.name.endsWith('.docx')) {
        const text = await extractTextFromDocx(file);
        setInput(text);
      } else {
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target?.result as string;
          setInput(content);
        };
        reader.readAsText(file);
      }
      setActiveTab('text');
    } catch (err: any) {
      console.error("File extraction error:", err);
      setError(`Failed to extract text from file: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: {
      'text/plain': ['.txt'],
      'text/html': ['.html', '.htm'],
      'text/markdown': ['.md'],
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
    multiple: false
  });

  const handleFetchUrl = async () => {
    if (!url) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/fetch-url?url=${encodeURIComponent(url)}`);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch URL');
      }
      const content = await response.text();
      setInput(content);
      setActiveTab('text');
      setUrl('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConvert = async () => {
    if (!input.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await convertToPressbooks(input);
      setResult(res);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const clearAll = () => {
    setInput('');
    setResult(null);
    setError(null);
    setUrl('');
  };

  const downloadMarkdown = () => {
    if (!result) return;
    const blob = new Blob([result.convertedContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pressbook-chapter.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadPDF = () => {
    if (!result) return;
    const doc = new jsPDF();
    const margin = 10;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const maxLineWidth = pageWidth - margin * 2;
    
    const lines = doc.splitTextToSize(result.convertedContent, maxLineWidth);
    let cursorY = margin;

    lines.forEach((line: string) => {
      if (cursorY > pageHeight - margin) {
        doc.addPage();
        cursorY = margin;
      }
      doc.text(line, margin, cursorY);
      cursorY += 7; // Line height
    });

    doc.save('pressbook-chapter.pdf');
  };

  return (
    <div className="min-h-screen bg-[#F5F5F4] text-[#1C1917] font-sans selection:bg-emerald-100">
      {/* Header */}
      <header className="border-b border-stone-200 bg-white/80 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white font-bold">
              ∑
            </div>
            <h1 className="text-lg font-semibold tracking-tight">Pressbooks Math Converter</h1>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={clearAll}
              className="text-sm font-medium text-stone-500 hover:text-stone-900 transition-colors flex items-center gap-2"
            >
              <Trash2 size={16} />
              Clear
            </button>
            <a 
              href="https://pressbooks.directory/" 
              target="_blank" 
              rel="noreferrer"
              className="text-sm font-medium text-stone-500 hover:text-stone-900 transition-colors flex items-center gap-1"
            >
              Pressbooks Docs
              <ArrowRight size={14} />
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-[calc(100vh-10rem)]">
          
          {/* Left Column: Input */}
          <div className="flex flex-col gap-4 h-full">
            <div className="bg-white rounded-2xl shadow-sm border border-stone-200 flex flex-col overflow-hidden h-full">
              <div className="flex border-b border-stone-100">
                <button 
                  onClick={() => setActiveTab('text')}
                  className={cn(
                    "flex-1 py-3 text-sm font-medium transition-all flex items-center justify-center gap-2",
                    activeTab === 'text' ? "bg-stone-50 text-emerald-700 border-b-2 border-emerald-600" : "text-stone-500 hover:bg-stone-50"
                  )}
                >
                  <TypeIcon size={16} />
                  Paste Text
                </button>
                <button 
                  onClick={() => setActiveTab('file')}
                  className={cn(
                    "flex-1 py-3 text-sm font-medium transition-all flex items-center justify-center gap-2",
                    activeTab === 'file' ? "bg-stone-50 text-emerald-700 border-b-2 border-emerald-600" : "text-stone-500 hover:bg-stone-50"
                  )}
                >
                  <FileUp size={16} />
                  Upload File
                </button>
                <button 
                  onClick={() => setActiveTab('url')}
                  className={cn(
                    "flex-1 py-3 text-sm font-medium transition-all flex items-center justify-center gap-2",
                    activeTab === 'url' ? "bg-stone-50 text-emerald-700 border-b-2 border-emerald-600" : "text-stone-500 hover:bg-stone-50"
                  )}
                >
                  <LinkIcon size={16} />
                  Import URL
                </button>
              </div>

              <div className="flex-1 p-4 overflow-hidden">
                <AnimatePresence mode="wait">
                  {activeTab === 'text' && (
                    <motion.textarea
                      key="text"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Paste your LaTeX, HTML, or Markdown content here..."
                      className="w-full h-full resize-none bg-transparent border-none focus:ring-0 text-sm font-mono leading-relaxed placeholder:text-stone-300"
                    />
                  )}

                  {activeTab === 'file' && (
                    <motion.div
                      key="file"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="w-full h-full"
                    >
                      <div
                        {...getRootProps()}
                        className={cn(
                          "w-full h-full border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-4 transition-all cursor-pointer",
                          isDragActive ? "border-emerald-500 bg-emerald-50" : "border-stone-200 hover:border-stone-300 hover:bg-stone-50"
                        )}
                      >
                        <input {...getInputProps()} />
                        <div className="w-12 h-12 bg-stone-100 rounded-full flex items-center justify-center text-stone-400">
                          <FileUp size={24} />
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-medium text-stone-700">
                            {isDragActive ? "Drop the file here" : "Drag & drop a file here"}
                          </p>
                          <p className="text-xs text-stone-400 mt-1">
                            Supports .txt, .html, .md, .pdf, .docx
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {activeTab === 'url' && (
                    <motion.div
                      key="url"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="w-full h-full flex flex-col items-center justify-center gap-6 max-w-md mx-auto"
                    >
                      <div className="w-full space-y-2">
                        <label className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
                          Google Doc or Web URL
                        </label>
                        <div className="flex gap-2">
                          <input 
                            type="url"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="https://docs.google.com/..."
                            className="flex-1 bg-stone-50 border border-stone-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                          />
                          <button 
                            onClick={handleFetchUrl}
                            disabled={isLoading || !url}
                            className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                          >
                            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <LinkIcon size={16} />}
                            Fetch
                          </button>
                        </div>
                      </div>
                      <div className="bg-stone-50 p-4 rounded-xl border border-stone-100 flex gap-3">
                        <Info size={20} className="text-stone-400 shrink-0 mt-0.5" />
                        <p className="text-xs text-stone-500 leading-relaxed">
                          For Google Docs, ensure the document is set to <strong>"Anyone with the link can view"</strong> or export it to HTML and upload the file instead.
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="p-4 bg-stone-50 border-t border-stone-100 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-stone-400">
                  <Info size={14} />
                  <span>{input.length.toLocaleString()} characters</span>
                </div>
                <button 
                  onClick={handleConvert}
                  disabled={isLoading || !input.trim()}
                  className="bg-emerald-600 text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-600/20 flex items-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Converting...
                    </>
                  ) : (
                    <>
                      Convert to Pressbooks
                      <ArrowRight size={18} />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Output */}
          <div className="flex flex-col gap-4 h-full">
            <div className="bg-white rounded-2xl shadow-sm border border-stone-200 flex flex-col overflow-hidden h-full">
              <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
                <span className="text-sm font-semibold text-stone-600">Converted Output</span>
                <div className="flex items-center gap-2">
                  {result && (
                    <>
                      <button 
                        onClick={downloadMarkdown}
                        className="text-xs font-medium px-3 py-1.5 rounded-lg bg-white border border-stone-200 text-stone-600 hover:bg-stone-50 transition-all flex items-center gap-2"
                        title="Download Markdown"
                      >
                        <FileText size={14} />
                        .MD
                      </button>
                      <button 
                        onClick={downloadPDF}
                        className="text-xs font-medium px-3 py-1.5 rounded-lg bg-white border border-stone-200 text-stone-600 hover:bg-stone-50 transition-all flex items-center gap-2"
                        title="Download PDF"
                      >
                        <Download size={14} />
                        .PDF
                      </button>
                      <button 
                        onClick={() => copyToClipboard(result.convertedContent)}
                        className={cn(
                          "text-xs font-medium px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all",
                          copied ? "bg-emerald-100 text-emerald-700" : "bg-white border border-stone-200 text-stone-600 hover:bg-stone-50"
                        )}
                      >
                        {copied ? <Check size={14} /> : <Clipboard size={14} />}
                        {copied ? "Copied!" : "Copy"}
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="flex-1 flex flex-col overflow-hidden">
                {error ? (
                  <div className="p-8 flex flex-col items-center justify-center text-center gap-4 h-full">
                    <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center text-red-500">
                      <AlertCircle size={24} />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-stone-900">Conversion Failed</h3>
                      <p className="text-xs text-stone-500 mt-1 max-w-xs">{error}</p>
                    </div>
                    <button 
                      onClick={handleConvert}
                      className="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
                    >
                      Try Again
                    </button>
                  </div>
                ) : result ? (
                  <div className="flex flex-col h-full overflow-hidden">
                    <div className="flex-1 p-4 overflow-y-auto">
                      <pre className="text-sm font-mono whitespace-pre-wrap leading-relaxed text-stone-800">
                        {result.convertedContent}
                      </pre>
                    </div>
                    <div className="h-48 border-t border-stone-100 bg-stone-50/50 p-4 overflow-y-auto">
                      {result.errors && result.errors.length > 0 && (
                        <div className="mb-6 space-y-3">
                          <div className="flex items-center gap-2">
                            <AlertCircle size={14} className="text-red-500" />
                            <span className="text-xs font-bold text-red-500 uppercase tracking-widest">Formatting Errors</span>
                          </div>
                          {result.errors.map((err, idx) => (
                            <div key={idx} className="bg-red-50 border border-red-100 rounded-lg p-3 space-y-2">
                              <div className="flex flex-col gap-1">
                                <span className="text-[10px] font-bold text-red-400 uppercase">Problematic Snippet</span>
                                <code className="text-xs font-mono bg-white px-2 py-1 rounded border border-red-100 block overflow-x-auto">
                                  {err.snippet}
                                </code>
                              </div>
                              <div className="flex flex-col gap-1">
                                <span className="text-[10px] font-bold text-red-400 uppercase">Issue</span>
                                <p className="text-xs text-red-700">{err.message}</p>
                              </div>
                              <div className="flex flex-col gap-1">
                                <span className="text-[10px] font-bold text-emerald-600 uppercase">Suggestion</span>
                                <p className="text-xs text-emerald-700 font-medium">{err.suggestion}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      <div className="flex items-center gap-2 mb-3">
                        <Info size={14} className="text-emerald-600" />
                        <span className="text-xs font-bold text-stone-400 uppercase tracking-widest">Conversion Summary</span>
                      </div>
                      <div className="prose prose-sm prose-stone max-w-none">
                        <div className="text-xs text-stone-600 leading-relaxed">
                          <Markdown>
                            {result.summary}
                          </Markdown>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-8 flex flex-col items-center justify-center text-center gap-4 h-full text-stone-300">
                    <div className="w-16 h-16 border-2 border-dashed border-stone-100 rounded-2xl flex items-center justify-center">
                      <Check size={32} />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Ready for conversion</p>
                      <p className="text-xs mt-1">Paste content or upload a file to begin</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </main>

      {/* Footer Info */}
      <footer className="max-w-7xl mx-auto px-6 py-8 border-t border-stone-200 mt-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-stone-400 uppercase tracking-widest">How it works</h4>
            <p className="text-xs text-stone-500 leading-relaxed">
              This tool uses advanced AI to identify math regions in your content and convert them to Pressbooks-compatible <code className="bg-stone-100 px-1 rounded">[latex]</code> shortcodes while preserving all other formatting.
            </p>
          </div>
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-stone-400 uppercase tracking-widest">Supported Formats</h4>
            <ul className="text-xs text-stone-500 space-y-1">
              <li>• Raw LaTeX ($...$, $$...$$, etc.)</li>
              <li>• MathJax HTML output</li>
              <li>• Google Docs exported HTML</li>
              <li>• MS Word (.docx) & PDF</li>
              <li>• AsciiMath notation (e.g., `x^2`)</li>
            </ul>
          </div>
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-stone-400 uppercase tracking-widest">Pressbooks Tip</h4>
            <p className="text-xs text-stone-500 leading-relaxed">
              Always use the <strong>Text (HTML)</strong> editor in Pressbooks when pasting converted content to ensure shortcodes are processed correctly by the MathJax plugin.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
