'use client';

import { useState, useEffect } from 'react';

interface OpenAISettings {
  hasKey: boolean;
  openaiModel: string;
  promptOptimizeSv: string;
  promptTranslateDirect: string;
  exampleProductImportTokens: string | null;
  updatedAt: string | null;
}

export default function InstallningarPage() {
  const [settings, setSettings] = useState<OpenAISettings>({
    hasKey: false,
    openaiModel: 'gpt-4o-mini',
    promptOptimizeSv: '',
    promptTranslateDirect: '',
    exampleProductImportTokens: null,
    updatedAt: null
  });
  
  const [formData, setFormData] = useState({
    apiKey: '',
    openaiModel: 'gpt-4o-mini',
    promptOptimizeSv: '',
    promptTranslateDirect: ''
  });
  
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [exampleFile, setExampleFile] = useState<File | null>(null);
  const [extractedTokens, setExtractedTokens] = useState<string[]>([]);
  const [isUploadingExample, setIsUploadingExample] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/settings/openai');
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
        setFormData({
          apiKey: '',
          openaiModel: data.openaiModel,
          promptOptimizeSv: data.promptOptimizeSv,
          promptTranslateDirect: data.promptTranslateDirect
        });
        
        // Parse existing example tokens if they exist
        if (data.exampleProductImportTokens) {
          try {
            const parsed = JSON.parse(data.exampleProductImportTokens);
            if (parsed.tokens && parsed.tokens.length > 0) {
              const tokens = parsed.tokens.map((t: any) => t.token);
              setExtractedTokens(tokens);
            }
          } catch (error) {
            console.warn('Failed to parse existing example tokens:', error);
          }
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      setMessage({ type: 'error', text: 'Kunde inte ladda inställningar' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);
    
    try {
      const response = await fetch('/api/settings/openai', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });
      
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
        setFormData(prev => ({ ...prev, apiKey: '' }));
        setShowApiKeyInput(false);
        setMessage({ type: 'success', text: 'Inställningar sparade!' });
      } else {
        const error = await response.json();
        setMessage({ type: 'error', text: error.error || 'Kunde inte spara inställningar' });
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      setMessage({ type: 'error', text: 'Kunde inte spara inställningar' });
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges = () => {
    return (
      formData.apiKey.trim() !== '' ||
      formData.openaiModel !== settings.openaiModel ||
      formData.promptOptimizeSv !== settings.promptOptimizeSv ||
      formData.promptTranslateDirect !== settings.promptTranslateDirect
    );
  };

  const handleExampleFileUpload = async (file: File) => {
    setIsUploadingExample(true);
    setMessage(null);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/analyze-tokens', {
        method: 'POST',
        body: formData
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.tokens?.tokens && result.tokens.tokens.length > 0) {
          const tokens = result.tokens.tokens.map((t: any) => t.token);
          setExtractedTokens(tokens);
          setExampleFile(file);
          setMessage({ type: 'success', text: `Upptäckte ${tokens.length} tokens från exempelfilen` });
        } else {
          setMessage({ type: 'error', text: 'Kunde inte extrahera tokens från filen. Kontrollera att filen innehåller kolumnrubriker.' });
        }
      } else {
        const error = await response.json();
        setMessage({ type: 'error', text: error.error || 'Kunde inte analysera filen' });
      }
    } catch (error) {
      console.error('Error analyzing example file:', error);
      setMessage({ type: 'error', text: 'Kunde inte analysera filen' });
    } finally {
      setIsUploadingExample(false);
    }
  };

  const saveExampleTokens = async () => {
    if (extractedTokens.length === 0) return;
    
    try {
      const tokensData = JSON.stringify({ tokens: extractedTokens.map(token => ({ token, original: token })) });
      
      const response = await fetch('/api/settings/openai', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          exampleProductImportTokens: tokensData
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
        setMessage({ type: 'success', text: 'Exempeltokens sparade!' });
      } else {
        setMessage({ type: 'error', text: 'Kunde inte spara exempeltokens' });
      }
    } catch (error) {
      console.error('Error saving example tokens:', error);
      setMessage({ type: 'error', text: 'Kunde inte spara exempeltokens' });
    }
  };

  if (isLoading) {
    return (
      <div style={{ flex: 1, padding: '2rem', background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)', minHeight: 'calc(100vh - 80px)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ background: 'white', borderRadius: '1rem', padding: '2rem', marginBottom: '2rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', border: '1px solid #e5e7eb', textAlign: 'center' }}>
            <h1 style={{ fontSize: '2rem', fontWeight: '700', color: '#111827', margin: '0 0 0.5rem 0' }}>Inställningar</h1>
            <p style={{ fontSize: '1.125rem', color: '#6b7280', margin: '0' }}>Konfigurera dina AI-inställningar</p>
          </div>
          <div style={{ background: 'white', borderRadius: '1.5rem', padding: '2rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', border: '1px solid #e5e7eb' }}>
            <p style={{ textAlign: 'center', color: '#6b7280' }}>Laddar inställningar...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, padding: '2rem', background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)', minHeight: 'calc(100vh - 80px)' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ background: 'white', borderRadius: '1rem', padding: '2rem', marginBottom: '2rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', border: '1px solid #e5e7eb', textAlign: 'center' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: '700', color: '#111827', margin: '0 0 0.5rem 0' }}>Inställningar</h1>
          <p style={{ fontSize: '1.125rem', color: '#6b7280', margin: '0' }}>Konfigurera dina AI-inställningar</p>
        </div>
        
        <div style={{ background: 'white', borderRadius: '1.5rem', padding: '2rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', border: '2px solid transparent', transition: 'all 0.3s ease', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, rgba(139, 92, 246, 0.05) 100%)', opacity: 0 }}></div>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '2rem' }}>
              <div style={{ position: 'relative', width: '3rem', height: '3rem', borderRadius: '50%', background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg style={{ width: '1.5rem', height: '1.5rem', color: 'white' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <div style={{ position: 'absolute', top: '-0.5rem', right: '-0.5rem', width: '1.5rem', height: '1.5rem', background: 'white', border: '2px solid #3b82f6', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: '700', color: '#3b82f6' }}>1</div>
              </div>
              <div style={{ flex: 1 }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1f2937', margin: '0 0 0.5rem 0', letterSpacing: '-0.01em' }}>OpenAI-inställningar</h2>
                <p style={{ color: '#6b7280', lineHeight: '1.6', margin: '0', fontSize: '1rem' }}>Konfigurera din AI-assistent för bästa resultat</p>
              </div>
            </div>
        
            {message && (
              <div style={{ 
                marginBottom: '1.5rem', 
                padding: '1rem', 
                borderRadius: '0.5rem', 
                border: '1px solid',
                ...(message.type === 'success' 
                  ? { backgroundColor: '#f0fdf4', color: '#166534', borderColor: '#bbf7d0' }
                  : { backgroundColor: '#fef2f2', color: '#dc2626', borderColor: '#fecaca' }
                )
              }}>
                {message.text}
              </div>
            )}
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* API Key */}
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                  API-nyckel
                </label>
                {settings.hasKey && !showApiKeyInput ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f0fdf4', borderRadius: '0.5rem', padding: '0.75rem', border: '1px solid #bbf7d0' }}>
                    <span style={{ fontSize: '0.875rem', color: '#166534' }}>Nyckel lagrad</span>
                    <button
                      type="button"
                      onClick={() => setShowApiKeyInput(true)}
                      style={{ fontSize: '0.875rem', color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      Byt nyckel
                    </button>
                  </div>
                ) : (
                  <input
                    type="password"
                    value={formData.apiKey}
                    onChange={(e) => setFormData(prev => ({ ...prev, apiKey: e.target.value }))}
                    placeholder="sk-..."
                    style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', outline: 'none', fontSize: '0.875rem', minHeight: '2.75rem' }}
                  />
                )}
              </div>

              {/* Model */}
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                  AI-modell
                </label>
                <select
                  value={formData.openaiModel}
                  onChange={(e) => setFormData(prev => ({ ...prev, openaiModel: e.target.value }))}
                  style={{ 
                    width: '100%', 
                    padding: '0.75rem', 
                    border: '1px solid #d1d5db', 
                    borderRadius: '0.5rem', 
                    outline: 'none', 
                    fontSize: '0.875rem', 
                    backgroundColor: 'white',
                    minHeight: '2.75rem',
                    appearance: 'none',
                    backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                    backgroundPosition: 'right 0.5rem center',
                    backgroundRepeat: 'no-repeat',
                    backgroundSize: '1.5em 1.5em',
                    paddingRight: '2.5rem'
                  }}
                >
                  <option value="gpt-4o-mini">GPT-4o Mini</option>
                  <option value="gpt-4o">GPT-4o</option>
                  <option value="gpt-4-turbo">GPT-4 Turbo</option>
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                </select>
              </div>

              {/* Optimization Prompt */}
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                  Prompt – Optimering (SV)
                </label>
                <textarea
                  value={formData.promptOptimizeSv}
                  onChange={(e) => setFormData(prev => ({ ...prev, promptOptimizeSv: e.target.value }))}
                  rows={4}
                  style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', outline: 'none', fontSize: '0.875rem', resize: 'vertical', minHeight: '6rem' }}
                  placeholder="Systemprompt för optimering..."
                />
              </div>

              {/* Translation Prompt */}
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                  Prompt – Direktöversättning (SV → NO/DK)
                </label>
                <textarea
                  value={formData.promptTranslateDirect}
                  onChange={(e) => setFormData(prev => ({ ...prev, promptTranslateDirect: e.target.value }))}
                  rows={4}
                  style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', outline: 'none', fontSize: '0.875rem', resize: 'vertical', minHeight: '6rem' }}
                  placeholder="Systemprompt för översättning..."
                />
                <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                  Använd {`{targetLang}`} som placeholder för målspråket
                </p>
              </div>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '1rem', borderTop: '1px solid #e5e7eb', marginTop: '2rem' }}>
              <button
                onClick={handleSave}
                disabled={!hasChanges() || isSaving}
                style={{
                  background: hasChanges() && !isSaving ? '#3b82f6' : '#9ca3af',
                  color: 'white',
                  border: 'none',
                  padding: '1rem 2rem',
                  borderRadius: '0.75rem',
                  fontWeight: '600',
                  fontSize: '1rem',
                  cursor: hasChanges() && !isSaving ? 'pointer' : 'not-allowed',
                  minWidth: '200px',
                  transition: 'all 0.2s ease'
                }}
              >
                {isSaving ? 'Sparar...' : 'Spara inställningar'}
              </button>
            </div>
          </div>
        </div>

        {/* Example File Section */}
        <div style={{ background: 'white', borderRadius: '1.5rem', padding: '2rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', border: '2px solid transparent', transition: 'all 0.3s ease', position: 'relative', overflow: 'hidden', marginTop: '2rem' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.05) 0%, rgba(16, 185, 129, 0.05) 100%)', opacity: 0 }}></div>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '2rem' }}>
              <div style={{ position: 'relative', width: '3rem', height: '3rem', borderRadius: '50%', background: 'linear-gradient(135deg, #22c55e, #10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg style={{ width: '1.5rem', height: '1.5rem', color: 'white' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <div style={{ position: 'absolute', top: '-0.5rem', right: '-0.5rem', width: '1.5rem', height: '1.5rem', background: 'white', border: '2px solid #22c55e', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: '700', color: '#22c55e' }}>2</div>
              </div>
              <div style={{ flex: 1 }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1f2937', margin: '0 0 0.5rem 0', letterSpacing: '-0.01em' }}>Exempelfil (Produkttexter)</h2>
                <p style={{ color: '#6b7280', lineHeight: '1.6', margin: '0', fontSize: '1rem' }}>Ladda upp en exempelfil för att extrahera tillgängliga tokens</p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* File Upload */}
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                  Exempelfil (.xlsx)
                </label>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                  <input
                    type="file"
                    accept=".xlsx"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setExampleFile(file);
                        setExtractedTokens([]);
                        setMessage(null);
                      }
                    }}
                    disabled={isUploadingExample}
                    style={{ 
                      flex: 1,
                      padding: '0.75rem', 
                      border: '1px solid #d1d5db', 
                      borderRadius: '0.5rem', 
                      outline: 'none', 
                      fontSize: '0.875rem',
                      backgroundColor: isUploadingExample ? '#f9fafb' : 'white',
                      cursor: isUploadingExample ? 'not-allowed' : 'pointer'
                    }}
                  />
                  <button
                    onClick={() => {
                      if (exampleFile) {
                        handleExampleFileUpload(exampleFile);
                      }
                    }}
                    disabled={!exampleFile || isUploadingExample}
                    style={{
                      padding: '0.75rem 1.5rem',
                      backgroundColor: exampleFile && !isUploadingExample ? '#22c55e' : '#9ca3af',
                      color: 'white',
                      border: 'none',
                      borderRadius: '0.5rem',
                      fontWeight: '500',
                      fontSize: '0.875rem',
                      cursor: exampleFile && !isUploadingExample ? 'pointer' : 'not-allowed',
                      transition: 'all 0.2s ease',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {isUploadingExample ? 'Analyserar...' : 'Analysera'}
                  </button>
                </div>
                
                {/* Template Information */}
                <div style={{ marginTop: '0.75rem', padding: '0.75rem', backgroundColor: '#f0f9ff', borderRadius: '0.5rem', border: '1px solid #bae6fd' }}>
                  <p style={{ fontSize: '0.75rem', color: '#0369a1', margin: '0 0 0.5rem 0', fontWeight: '500' }}>
                    📋 Mallformat:
                  </p>
                  <ul style={{ fontSize: '0.75rem', color: '#0369a1', margin: '0', paddingLeft: '1rem' }}>
                    <li>Endast rubrikrad + 1 datarekord räcker</li>
                    <li>Exempel: ArticleId, Title, Description_sv, Brand, Bullet_1</li>
                    <li>Tokens extraheras automatiskt från kolumnrubriker</li>
                  </ul>
                </div>
                
                {isUploadingExample && (
                  <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.5rem' }}>
                    Laddar upp och analyserar fil...
                  </p>
                )}
              </div>

              {/* Extracted Tokens */}
              {extractedTokens.length > 0 && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                    Upptäckta tokens ({extractedTokens.length} st)
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
                    {extractedTokens.map((token, index) => (
                      <span
                        key={index}
                        style={{
                          display: 'inline-block',
                          padding: '0.25rem 0.75rem',
                          backgroundColor: '#dbeafe',
                          color: '#1e40af',
                          borderRadius: '1rem',
                          fontSize: '0.75rem',
                          fontWeight: '500',
                          border: '1px solid #bfdbfe'
                        }}
                      >
                        {`{{${token}}}`}
                      </span>
                    ))}
                  </div>
                  <button
                    onClick={saveExampleTokens}
                    style={{
                      marginTop: '1rem',
                      background: '#22c55e',
                      color: 'white',
                      border: 'none',
                      padding: '0.5rem 1rem',
                      borderRadius: '0.5rem',
                      fontWeight: '500',
                      fontSize: '0.875rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    Spara tokens
                  </button>
                </div>
              )}

              {/* Current Settings Tokens */}
              {settings.exampleProductImportTokens && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                    Sparade exempeltokens
                  </label>
                  <div style={{ padding: '1rem', backgroundColor: '#f0fdf4', borderRadius: '0.5rem', border: '1px solid #bbf7d0' }}>
                    <p style={{ fontSize: '0.875rem', color: '#166534', margin: '0' }}>
                      Exempeltokens är sparade och kommer att användas som fallback när inga tokens finns i den valda uploaden.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}