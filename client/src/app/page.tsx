"use client";
import React, { useState, useEffect, useRef } from 'react';
import { Shield, Send, Lock, Loader2, Activity } from 'lucide-react';
import { getNewKey, encryptData, decryptData, bufferToBase64, base64ToBuffer } from './cryptoUtils';

export default function Home() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([{ role: 'ai', text: 'Secure session active. Encryption key localized.' }]);
  const [logs, setLogs] = useState<string[]>(["[SYSTEM]: AES-GCM Key Handshake Complete"]);
  const [key, setKey] = useState<CryptoKey | null>(null);
  const [loading, setLoading] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { getNewKey().then(setKey); }, []);
  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [logs]);

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString().split(' ')[0];
    setLogs(prev => [...prev, `[${time}] ${msg}`]);
  };

  const handleSend = async () => {
    if (!input || !key) return;
    const userText = input;
    setMessages(prev => [...prev, { role: 'user', text: userText }]);
    setInput('');
    setLoading(true);
    addLog("PLAINTEXT_CAPTURED: Initiating GCM encryption...");

    try {
      const { ciphertext, iv } = await encryptData(userText, key);
      const rawKey = await window.crypto.subtle.exportKey("raw", key);
      
      const res = await fetch("http://localhost:5000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          encryptedPayload: bufferToBase64(ciphertext),
          iv: bufferToBase64(iv),
          rawKey: bufferToBase64(rawKey)
        })
      });

      if (!res.ok) throw new Error("Relay connection failed (Timeout).");

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      addLog(`RELAY_RESPONSE: Received Encrypted Stream (Tag: ${data.authTag?.substring(0, 8)})`);
      
      const decryptedAiText = await decryptData(
        base64ToBuffer(data.encryptedResponse),
        key,
        base64ToBuffer(data.returnIv)
      );
      
      addLog("DECRYPT_SUCCESS: AI response verified and unlocked.");
      setMessages(prev => [...prev, { role: 'ai', text: decryptedAiText }]);
    } catch (err: any) {
      addLog(`CRITICAL_ERROR: ${err.message}`);
      setMessages(prev => [...prev, { role: 'ai', text: `System Alert: ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-slate-950 text-white font-sans overflow-hidden">
      <aside className="w-64 bg-slate-900 border-r border-slate-800 p-6 flex flex-col gap-6">
        <div className="flex items-center gap-2 text-emerald-400 font-bold text-xl">
          <Shield size={28} /> <span>VAULT</span>
        </div>
        <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
          <p className="text-[10px] text-slate-500 font-bold mb-2 uppercase text-center tracking-widest">Security Protocol</p>
          <div className="flex items-center justify-center gap-2 text-xs text-emerald-400 font-mono">
            <div className={`w-2 h-2 rounded-full ${key ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></div>
            {key ? 'AES-256-ACTIVE' : 'OFFLINE'}
          </div>
        </div>
        <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700 flex-1 overflow-hidden flex flex-col">
          <p className="text-[10px] text-slate-500 font-bold mb-2 uppercase tracking-widest flex items-center gap-2 border-b border-slate-700 pb-2">
            <Activity size={12} /> Security Audit
          </p>
          <div className="font-mono text-[10px] text-slate-400 space-y-2 overflow-y-auto pt-2 scrollbar-hide">
            {logs.map((log, i) => (
              <div key={i} className="border-l border-slate-700 pl-2 py-1 leading-tight break-all">{log}</div>
            ))}
            <div ref={logEndRef} />
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col bg-slate-950 relative">
        <header className="p-4 border-b border-slate-800 flex justify-between px-8 bg-slate-950/50 backdrop-blur-md">
          <span className="text-[10px] text-slate-500 font-mono tracking-widest uppercase">Blind Relay v2.5</span>
          <Lock size={16} className="text-emerald-500" />
        </header>
        <div className="flex-1 p-8 overflow-y-auto space-y-6">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`p-4 rounded-2xl max-w-xl text-sm leading-relaxed ${
                msg.role === 'user' ? 'bg-emerald-600 text-white rounded-tr-none shadow-lg' : 'bg-slate-800 border border-slate-700 rounded-tl-none text-slate-300'
              }`}>
                {msg.text}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex items-center gap-2 text-slate-500 text-xs italic font-mono animate-pulse">
              <Loader2 className="animate-spin" size={14} /> TRANSMITTING...
            </div>
          )}
        </div>
        <footer className="p-6">
          <div className="max-w-4xl mx-auto relative">
            <input 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl py-4 px-6 focus:outline-none focus:border-emerald-500 text-sm pr-14"
              placeholder="Encrypt and send..."
            />
            <button onClick={handleSend} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-emerald-600 rounded-lg">
              <Send size={20} />
            </button>
          </div>
        </footer>
      </main>
    </div>
  );
}