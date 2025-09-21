'use client';

import { useState, useEffect } from 'react';
import { LANGUAGES, getLanguageDisplayName, searchLanguages } from '@/lib/languages';

interface OpenAISettings {
  hasKey: boolean;
  openaiModel: string;
  promptOptimizeSv: string;
  promptOptimizeBrandsSv: string | null;
  promptTranslateDirect: string;
  exampleProductImportTokens: string | null;
  exampleBrandsImportTokens: string | null;
  translationLanguages: string | null;
  originalLanguage: string | null;
  glossary: string | null;
  updatedAt: string | null;
}

interface GlossaryEntry {
  id: string;
  source: string;
  comment?: string;
  targets: Record<string, string>;
}

export default function InstallningarPage() {
  const [settings, setSettings] = useState<OpenAISettings>({
    hasKey: false,
    openaiModel: 'gpt-4o-mini',
    promptOptimizeSv: '',
    promptTranslateDirect: '',
    exampleProductImportTokens: null,
    translationLanguages: null,
    originalLanguage: null,
    glossary: null,
    updatedAt: null
  });
  
  const [formData, setFormData] = useState({
    apiKey: '',
    openaiModel: 'gpt-4o-mini',
    promptOptimizeSv: '',
    promptOptimizeBrandsSv: ''
  });
  
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [exampleFile, setExampleFile] = useState<File | null>(null);
  const [brandsExampleFile, setBrandsExampleFile] = useState<File | null>(null);
  const [extractedBrandsTokens, setExtractedBrandsTokens] = useState<string[]>([]);
  const [isUploadingBrandsExample, setIsUploadingBrandsExample] = useState(false);
  const [analyzedBrandsFileName, setAnalyzedBrandsFileName] = useState<string | null>(null);
  const [extractedTokens, setExtractedTokens] = useState<string[]>([]);
  const [isUploadingExample, setIsUploadingExample] = useState(false);
  const [translationLanguages, setTranslationLanguages] = useState<string[]>([]);
  const [originalLanguage, setOriginalLanguage] = useState<string>('');
  const [languageSearchQuery, setLanguageSearchQuery] = useState('');
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const [detectedLanguages, setDetectedLanguages] = useState<string[]>([]);
  const [suggestedOriginalLanguage, setSuggestedOriginalLanguage] = useState<string>('');
  const [analyzedFileName, setAnalyzedFileName] = useState<string>('');
  const [glossary, setGlossary] = useState<GlossaryEntry[]>([]);
  const [newGlossaryEntry, setNewGlossaryEntry] = useState<Partial<GlossaryEntry>>({
    source: '',
    comment: '',
    targets: {}
  });
  const [editingGlossaryId, setEditingGlossaryId] = useState<string | null>(null);

  useEffect(() => {
    initializeDatabase();
    // Load saved filename from localStorage
    const savedFileName = localStorage.getItem('analyzedFileName');
    if (savedFileName) {
      setAnalyzedFileName(savedFileName);
    }
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showLanguageDropdown) {
        const target = event.target as Element;
        if (!target.closest('[data-language-dropdown]')) {
          setShowLanguageDropdown(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showLanguageDropdown]);

  const initializeDatabase = async () => {
    try {
      const response = await fetch('/api/init-db', {
        method: 'POST'
      });
      
      if (response.ok) {
        console.log('Database initialized successfully');
        // Load settings after database is initialized
        loadSettings();
      } else {
        console.error('Failed to initialize database');
        setMessage({ type: 'error', text: 'Kunde inte initialisera databas' });
      }
    } catch (error) {
      console.error('Database initialization error:', error);
      setMessage({ type: 'error', text: 'Kunde inte initialisera databas' });
    }
  };

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
          promptOptimizeBrandsSv: data.promptOptimizeBrandsSv || ''
        });
        
        // Parse existing example tokens if they exist
        if (data.exampleProductImportTokens) {
          try {
            const parsed = JSON.parse(data.exampleProductImportTokens);
            if (parsed.tokens && parsed.tokens.length > 0) {
              const tokens = parsed.tokens.map((t: any) => t.token);
              setExtractedTokens(tokens);
              // Set filename from saved data or fallback
              const savedFileName = parsed.filename || 'sparad template';
              setAnalyzedFileName(savedFileName);
              // Also save to localStorage for consistency
              localStorage.setItem('analyzedFileName', savedFileName);
            }
          } catch (error) {
            console.warn('Failed to parse existing example tokens:', error);
          }
        }

        // Parse existing brands example tokens if they exist
        console.log('Loading settings, exampleBrandsImportTokens:', data.exampleBrandsImportTokens);
        if (data.exampleBrandsImportTokens) {
          try {
            const parsed = JSON.parse(data.exampleBrandsImportTokens);
            console.log('Parsed brands tokens:', parsed);
            if (parsed.tokens && parsed.tokens.length > 0) {
              const tokens = parsed.tokens.map((t: any) => t.token);
              console.log('Setting extractedBrandsTokens:', tokens);
              setExtractedBrandsTokens(tokens);
              // Set filename from saved data or fallback
              const savedFileName = parsed.filename || 'sparad brands template';
              setAnalyzedBrandsFileName(savedFileName);
            }
          } catch (error) {
            console.warn('Failed to parse existing brands example tokens:', error);
          }
        }

        // Parse existing translation languages if they exist
        if (data.translationLanguages) {
          try {
            const parsed = JSON.parse(data.translationLanguages);
            if (Array.isArray(parsed)) {
              setTranslationLanguages(parsed);
            }
          } catch (error) {
            console.warn('Failed to parse existing translation languages:', error);
          }
        }

        // Set original language if it exists
        if (data.originalLanguage) {
          setOriginalLanguage(data.originalLanguage);
        }

        // Parse existing glossary if it exists
        if (data.glossary) {
          try {
            const parsed = JSON.parse(data.glossary);
            if (Array.isArray(parsed)) {
              setGlossary(parsed);
            }
          } catch (error) {
            console.warn('Failed to parse existing glossary:', error);
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
      formData.promptOptimizeBrandsSv !== (settings.promptOptimizeBrandsSv || '')
    );
  };

  const addLanguage = (languageCode: string) => {
    // Don't allow adding the original language to translation languages
    if (languageCode === originalLanguage) {
      setMessage({ type: 'error', text: 'Kan inte lägga till originalspråket i översättningsspråk' });
      return;
    }
    
    if (!translationLanguages.includes(languageCode)) {
      const newLanguages = [...translationLanguages, languageCode];
      setTranslationLanguages(newLanguages);
      setLanguageSearchQuery('');
      setShowLanguageDropdown(false);
      // Clear any existing messages
      setMessage(null);
    }
  };

  const removeLanguage = (languageCode: string) => {
    setTranslationLanguages(prev => prev.filter(lang => lang !== languageCode));
    // Clear any existing messages
    setMessage(null);
  };

  const handleOriginalLanguageChange = (languageCode: string) => {
    setOriginalLanguage(languageCode);
    // Remove the original language from translation languages if it exists
    setTranslationLanguages(prev => prev.filter(lang => lang !== languageCode));
    // Clear any existing messages
    setMessage(null);
  };

  const saveTranslationLanguages = async () => {
    try {
      const response = await fetch('/api/settings/openai', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          translationLanguages: JSON.stringify(translationLanguages),
          originalLanguage: originalLanguage || null
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
        setMessage({ type: 'success', text: 'Språkinställningar sparade!' });
      } else {
        const errorData = await response.json();
        console.error('API Error:', errorData);
        setMessage({ type: 'error', text: `Kunde inte spara språkinställningar: ${errorData.error || 'Okänt fel'}` });
      }
    } catch (error) {
      console.error('Error saving translation languages:', error);
      setMessage({ type: 'error', text: `Kunde inte spara språkinställningar: ${error instanceof Error ? error.message : 'Okänt fel'}` });
    }
  };

  const suggestDetectedLanguages = () => {
    const newLanguages = [...translationLanguages];
    let addedCount = 0;
    
    for (const langCode of detectedLanguages) {
      // Don't add the original language to translation languages
      if (!newLanguages.includes(langCode) && langCode !== originalLanguage) {
        newLanguages.push(langCode);
        addedCount++;
      }
    }
    
    if (addedCount > 0) {
      setTranslationLanguages(newLanguages);
      setMessage({ type: 'success', text: `Lade till ${addedCount} språk från exempelfilen (exkluderade originalspråket)` });
    } else {
      setMessage({ type: 'success', text: 'Alla upptäckta språk finns redan i listan eller är originalspråket' });
    }
  };

  const applySuggestedOriginalLanguage = () => {
    if (suggestedOriginalLanguage) {
      setOriginalLanguage(suggestedOriginalLanguage);
      setMessage({ type: 'success', text: `Satte originalspråk till ${getLanguageDisplayName(suggestedOriginalLanguage)}` });
    }
  };

  const addGlossaryEntry = () => {
    if (!newGlossaryEntry.source || newGlossaryEntry.source.trim().length === 0) {
      setMessage({ type: 'error', text: 'Källterm är obligatorisk' });
      return;
    }

    if (newGlossaryEntry.source.trim().length > 120) {
      setMessage({ type: 'error', text: 'Källterm får inte vara längre än 120 tecken' });
      return;
    }

    if (/^\d+$/.test(newGlossaryEntry.source.trim())) {
      setMessage({ type: 'error', text: 'Källterm får inte vara enbart siffror' });
      return;
    }

    // Check for duplicates (case-insensitive)
    const existingEntry = glossary.find(entry => 
      entry.source.toLowerCase() === newGlossaryEntry.source!.toLowerCase()
    );
    if (existingEntry) {
      setMessage({ type: 'error', text: 'Källterm finns redan (skiftlägesokänslig)' });
      return;
    }

    const entry: GlossaryEntry = {
      id: Date.now().toString(),
      source: newGlossaryEntry.source.trim(),
      comment: newGlossaryEntry.comment?.trim() || undefined,
      targets: { ...newGlossaryEntry.targets }
    };

    setGlossary(prev => [...prev, entry]);
    setNewGlossaryEntry({ source: '', comment: '', targets: {} });
    setMessage({ type: 'success', text: 'Glossary-post tillagd' });
  };

  const updateGlossaryEntry = (id: string, updates: Partial<GlossaryEntry>) => {
    setGlossary(prev => prev.map(entry => 
      entry.id === id ? { ...entry, ...updates } : entry
    ));
    setEditingGlossaryId(null);
    setMessage({ type: 'success', text: 'Glossary-post uppdaterad' });
  };

  const deleteGlossaryEntry = (id: string) => {
    setGlossary(prev => prev.filter(entry => entry.id !== id));
    setMessage({ type: 'success', text: 'Glossary-post borttagen' });
  };

  const saveGlossary = async () => {
    try {
      const response = await fetch('/api/settings/glossary', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ glossary })
      });
      
      if (response.ok) {
        setMessage({ type: 'success', text: 'Glossary sparad!' });
      } else {
        const errorData = await response.json();
        setMessage({ type: 'error', text: `Kunde inte spara glossary: ${errorData.error || 'Okänt fel'}` });
      }
    } catch (error) {
      console.error('Error saving glossary:', error);
      setMessage({ type: 'error', text: 'Kunde inte spara glossary' });
    }
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
          setAnalyzedFileName(file.name);
          // Save filename to localStorage
          localStorage.setItem('analyzedFileName', file.name);
          
          // Handle detected languages
          if (result.detectedLanguages && result.detectedLanguages.length > 0) {
            setDetectedLanguages(result.detectedLanguages);
            
            // Suggest original language based on detected languages
            if (result.suggestedOriginalLanguage) {
              setSuggestedOriginalLanguage(result.suggestedOriginalLanguage);
              // Automatically set the original language if it's suggested
              setOriginalLanguage(result.suggestedOriginalLanguage);
              setMessage({ type: 'success', text: `Upptäckte ${tokens.length} tokens och ${result.detectedLanguages.length} språk från exempelfilen. Satte originalspråk till: ${getLanguageDisplayName(result.suggestedOriginalLanguage)}` });
            } else {
              setMessage({ type: 'success', text: `Upptäckte ${tokens.length} tokens och ${result.detectedLanguages.length} språk från exempelfilen` });
            }
          } else {
            setDetectedLanguages([]);
            setSuggestedOriginalLanguage('');
            setMessage({ type: 'success', text: `Upptäckte ${tokens.length} tokens från exempelfilen` });
          }
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
    if (extractedTokens.length === 0) {
      setMessage({ type: 'error', text: 'Inga tokens att spara' });
      return;
    }
    
    try {
      const tokensData = JSON.stringify({ 
        tokens: extractedTokens.map(token => ({ token, original: token })),
        filename: analyzedFileName || exampleFile?.name || 'okänd fil'
      });
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
        // Save filename to localStorage when tokens are saved
        if (analyzedFileName) {
          localStorage.setItem('analyzedFileName', analyzedFileName);
        }
      } else {
        const errorData = await response.json();
        console.error('API Error:', errorData);
        setMessage({ type: 'error', text: `Kunde inte spara exempeltokens: ${errorData.error || 'Okänt fel'}` });
      }
    } catch (error) {
      console.error('Error saving example tokens:', error);
      setMessage({ type: 'error', text: `Kunde inte spara exempeltokens: ${error instanceof Error ? error.message : 'Okänt fel'}` });
    }
  };

  const handleBrandsExampleFileUpload = async (file: File) => {
    setIsUploadingBrandsExample(true);
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
          setExtractedBrandsTokens(tokens);
          setBrandsExampleFile(file);
          setAnalyzedBrandsFileName(file.name);
          setMessage({ type: 'success', text: `Upptäckte ${tokens.length} tokens från brands-exempelfilen` });
        } else {
          setMessage({ type: 'error', text: 'Kunde inte extrahera tokens från brands-filen. Kontrollera att filen innehåller kolumnrubriker.' });
        }
      } else {
        const error = await response.json();
        setMessage({ type: 'error', text: error.error || 'Kunde inte analysera brands-filen' });
      }
    } catch (error) {
      console.error('Error analyzing brands example file:', error);
      setMessage({ type: 'error', text: 'Kunde inte analysera brands-filen' });
    } finally {
      setIsUploadingBrandsExample(false);
    }
  };

  const saveBrandsExampleTokens = async () => {
    console.log('saveBrandsExampleTokens called, tokens count:', extractedBrandsTokens.length);
    if (extractedBrandsTokens.length === 0) {
      setMessage({ type: 'error', text: 'Inga tokens att spara' });
      return;
    }
    
    try {
      const tokensData = JSON.stringify({ 
        tokens: extractedBrandsTokens.map(token => ({ token, original: token })),
        filename: analyzedBrandsFileName || brandsExampleFile?.name || 'okänd fil'
      });
      console.log('Saving brands tokens:', tokensData);
      const response = await fetch('/api/settings/openai', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          exampleBrandsImportTokens: tokensData
        })
      });
      
      console.log('Response status:', response.status);
      if (response.ok) {
        const data = await response.json();
        console.log('Settings updated:', data);
        setSettings(data);
        setMessage({ type: 'success', text: 'Brands-exempeltokens sparade!' });
      } else {
        const errorData = await response.json();
        console.error('API Error:', errorData);
        setMessage({ type: 'error', text: `Kunde inte spara brands-exempeltokens: ${errorData.error || 'Okänt fel'}` });
      }
    } catch (error) {
      console.error('Error saving brands example tokens:', error);
      setMessage({ type: 'error', text: `Kunde inte spara brands-exempeltokens: ${error instanceof Error ? error.message : 'Okänt fel'}` });
    }
  };

  if (isLoading) {
    return (
      <div style={{ flex: 1, padding: '2rem', background: '#fcfbf7', minHeight: 'calc(100vh - 80px)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div className="start-header" style={{ marginBottom: '4rem' }}>
            <h1 className="start-title">
              Inställningar
            </h1>
            <p className="start-subtitle">
              Konfigurera dina AI-inställningar
            </p>
          </div>
          <div style={{ background: 'white', borderRadius: '1.5rem', padding: '2rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', border: '1px solid #e5e7eb' }}>
            <p style={{ textAlign: 'center', color: '#6b7280' }}>Laddar inställningar...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, padding: '2rem', background: '#fcfbf7', minHeight: 'calc(100vh - 80px)' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div className="start-header" style={{ marginBottom: '4rem' }}>
          <h1 className="start-title">
            Inställningar
          </h1>
          <p className="start-subtitle">
            Konfigurera dina AI-inställningar
          </p>
        </div>
        
        <div style={{ background: 'white', borderRadius: '1.5rem', padding: '2rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', border: '2px solid transparent', transition: 'all 0.3s ease', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, rgba(139, 92, 246, 0.05) 100%)', opacity: 0 }}></div>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '2rem' }}>
              <div style={{ position: 'relative', width: '3rem', height: '3rem', borderRadius: '50%', background: 'linear-gradient(135deg, #1d40b0, #1e3a8a)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg style={{ width: '1.5rem', height: '1.5rem', color: 'white' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <div style={{ position: 'absolute', top: '-0.5rem', right: '-0.5rem', width: '1.5rem', height: '1.5rem', background: 'white', border: '2px solid #1d40b0', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: '700', color: '#1d40b0' }}>1</div>
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
                      style={{ fontSize: '0.875rem', color: '#1d40b0', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
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
                    padding: '10px', 
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

              {/* Brands Optimization Prompt */}
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                  Systemprompt för varumärkesoptimering
                </label>
                <textarea
                  value={formData.promptOptimizeBrandsSv}
                  onChange={(e) => setFormData(prev => ({ ...prev, promptOptimizeBrandsSv: e.target.value }))}
                  rows={4}
                  style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', outline: 'none', fontSize: '0.875rem', resize: 'vertical', minHeight: '6rem' }}
                  placeholder="Systemprompt för varumärkesoptimering..."
                />
              </div>

            </div>
            
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '1rem', borderTop: '1px solid #e5e7eb', marginTop: '2rem' }}>
              <button
                onClick={handleSave}
                disabled={!hasChanges() || isSaving}
                style={{
                  background: hasChanges() && !isSaving ? '#1d40b0' : '#9ca3af',
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
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
                        padding: '10px', 
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
                  
                  {/* File status display */}
                  {(exampleFile || extractedTokens.length > 0) && (
                    <div style={{ 
                      padding: '10px', 
                      backgroundColor: '#f0f9ff', 
                      borderRadius: '0.5rem', 
                      border: '1px solid #bae6fd',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      <svg style={{ width: '1rem', height: '1rem', color: '#0369a1' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span style={{ fontSize: '0.875rem', color: '#0369a1', fontWeight: '500' }}>
                        {exampleFile ? `Vald fil: ${exampleFile.name}` : `Template analyserad: ${analyzedFileName || 'sparad fil'}`}
                      </span>
                      {extractedTokens.length > 0 && (
                        <span style={{ fontSize: '0.75rem', color: '#059669', backgroundColor: '#d1fae5', padding: '0.25rem 0.5rem', borderRadius: '0.25rem' }}>
                          ✓ Analyserad
                        </span>
                      )}
                      <button
                        onClick={() => {
                          setExampleFile(null);
                          setExtractedTokens([]);
                          setDetectedLanguages([]);
                          setSuggestedOriginalLanguage('');
                          setAnalyzedFileName('');
                          setMessage(null);
                          // Clear saved filename from localStorage
                          localStorage.removeItem('analyzedFileName');
                        }}
                        style={{
                          marginLeft: 'auto',
                          background: 'none',
                          border: 'none',
                          color: '#dc2626',
                          cursor: 'pointer',
                          padding: '0.25rem',
                          fontSize: '0.75rem',
                          fontWeight: '500',
                          textDecoration: 'underline'
                        }}
                        title="Rensa vald fil"
                      >
                        Rensa
                      </button>
                    </div>
                  )}
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

              {/* Detected Languages */}
              {detectedLanguages.length > 0 && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                    Upptäckta språk från exempelfilen ({detectedLanguages.length} st)
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', padding: '1rem', backgroundColor: '#fef3c7', borderRadius: '0.5rem', border: '1px solid #fbbf24', marginBottom: '1rem' }}>
                    {detectedLanguages.map((langCode) => (
                      <span
                        key={langCode}
                        style={{
                          display: 'inline-block',
                          padding: '0.25rem 0.75rem',
                          backgroundColor: '#f59e0b',
                          color: 'white',
                          borderRadius: '1rem',
                          fontSize: '0.75rem',
                          fontWeight: '500',
                          border: '1px solid #d97706'
                        }}
                      >
                        {getLanguageDisplayName(langCode)}
                      </span>
                    ))}
                  </div>
                  <button
                    onClick={suggestDetectedLanguages}
                    style={{
                      background: '#f59e0b',
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
                    Lägg till upptäckta språk
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

        {/* Brands Example File */}
        <div style={{ background: 'white', borderRadius: '1.5rem', padding: '2rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', border: '2px solid transparent', transition: 'all 0.3s ease', position: 'relative', overflow: 'hidden', marginTop: '2rem' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, rgba(34, 197, 94, 0.05) 100%)', opacity: 0 }}></div>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '2rem' }}>
              <div style={{ position: 'relative', width: '3rem', height: '3rem', borderRadius: '50%', background: 'linear-gradient(135deg, #10b981, #22c55e)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg style={{ width: '1.5rem', height: '1.5rem', color: 'white' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <div style={{ position: 'absolute', top: '-0.5rem', right: '-0.5rem', width: '1.5rem', height: '1.5rem', background: 'white', border: '2px solid #10b981', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: '700', color: '#10b981' }}>3</div>
              </div>
              <div style={{ flex: 1 }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1f2937', margin: '0 0 0.5rem 0', letterSpacing: '-0.01em' }}>③ Exempelfil (Varumärken)</h2>
                <p style={{ color: '#6b7280', lineHeight: '1.6', margin: '0', fontSize: '1rem' }}>Ladda upp en exempelfil för varumärken för att extrahera tillgängliga tokens</p>
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
                        setBrandsExampleFile(file);
                        setExtractedBrandsTokens([]);
                        setMessage(null);
                      }
                    }}
                    disabled={isUploadingBrandsExample}
                    style={{ 
                      flex: 1,
                      padding: '10px', 
                      border: '1px solid #d1d5db', 
                      borderRadius: '0.5rem', 
                      outline: 'none', 
                      fontSize: '0.875rem',
                      backgroundColor: isUploadingBrandsExample ? '#f9fafb' : 'white',
                      cursor: isUploadingBrandsExample ? 'not-allowed' : 'pointer'
                    }}
                  />
                  <button
                    onClick={() => {
                      if (brandsExampleFile) {
                        handleBrandsExampleFileUpload(brandsExampleFile);
                      }
                    }}
                    disabled={!brandsExampleFile || isUploadingBrandsExample}
                    style={{
                      background: (!brandsExampleFile || isUploadingBrandsExample) ? '#d1d5db' : '#3b82f6',
                      color: 'white',
                      border: 'none',
                      padding: '10px 20px',
                      borderRadius: '0.5rem',
                      fontWeight: '500',
                      fontSize: '0.875rem',
                      cursor: (!brandsExampleFile || isUploadingBrandsExample) ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {isUploadingBrandsExample ? 'Analyserar...' : 'Analysera'}
                  </button>
                </div>
                <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '0.5rem 0 0 0' }}>
                  {brandsExampleFile ? brandsExampleFile.name : 'Ingen fil har valts'}
                </p>
              </div>

              {/* Template Format */}
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#374151', margin: '0 0 0.75rem 0' }}>Mallformat</h3>
                <ul style={{ fontSize: '0.875rem', color: '#6b7280', lineHeight: '1.6', margin: '0', paddingLeft: '1.5rem' }}>
                  <li>Endast rubrikrad + 1 datarekord räcker</li>
                  <li>Exempel: BrandName, Description_sv, Category, Target_Age</li>
                  <li>Tokens extraheras automatiskt från kolumnrubriker</li>
                </ul>
              </div>

              {/* Extracted Tokens */}
              {extractedBrandsTokens.length > 0 && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                    Extraherade tokens ({extractedBrandsTokens.length} st)
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', padding: '1rem', backgroundColor: '#f0fdf4', borderRadius: '0.5rem', border: '1px solid #bbf7d0' }}>
                    {extractedBrandsTokens.map((token, index) => (
                      <span
                        key={index}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          padding: '0.25rem 0.5rem',
                          backgroundColor: '#dcfce7',
                          color: '#166534',
                          borderRadius: '0.375rem',
                          fontSize: '0.75rem',
                          fontWeight: '500',
                          border: '1px solid #bbf7d0'
                        }}
                      >
                        <span>{`{{${token}}}`}</span>
                      </span>
                    ))}
                  </div>
                  <div style={{ marginTop: '0.75rem' }}>
                    <button
                      onClick={saveBrandsExampleTokens}
                      style={{
                        background: '#10b981',
                        color: 'white',
                        border: 'none',
                        padding: '0.5rem 1rem',
                        borderRadius: '0.375rem',
                        fontWeight: '500',
                        fontSize: '0.875rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      Spara tokens
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Glossary Section */}
        <div style={{ background: 'white', borderRadius: '1.5rem', padding: '2rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', border: '2px solid transparent', transition: 'all 0.3s ease', position: 'relative', overflow: 'hidden', marginTop: '2rem' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.05) 0%, rgba(16, 185, 129, 0.05) 100%)', opacity: 0 }}></div>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '2rem' }}>
              <div style={{ position: 'relative', width: '3rem', height: '3rem', borderRadius: '50%', background: 'linear-gradient(135deg, #22c55e, #10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg style={{ width: '1.5rem', height: '1.5rem', color: 'white' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <div style={{ position: 'absolute', top: '-0.5rem', right: '-0.5rem', width: '1.5rem', height: '1.5rem', background: 'white', border: '2px solid #22c55e', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: '700', color: '#22c55e' }}>4</div>
              </div>
              <div style={{ flex: 1 }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1f2937', margin: '0 0 0.5rem 0', letterSpacing: '-0.01em' }}>Glossary (Ordlista)</h2>
                <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: 0, lineHeight: '1.5' }}>
                  Hantera översättningstermer och deras måltermer för olika språk
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Current Glossary Entries */}
              {glossary.length > 0 && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                    Aktiva glossary-poster ({glossary.length} st)
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {glossary.map((entry) => (
                      <div key={entry.id} style={{ padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#1f2937', marginBottom: '0.25rem' }}>
                              Källterm: <span style={{ color: '#1d40b0' }}>"{entry.source}"</span>
                            </div>
                            {entry.comment && (
                              <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                                Kommentar: {entry.comment}
                              </div>
                            )}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                              {Object.entries(entry.targets).map(([lang, term]) => (
                                <span key={lang} style={{ display: 'inline-block', padding: '0.25rem 0.5rem', backgroundColor: '#dbeafe', color: '#1e40af', borderRadius: '0.25rem', fontSize: '0.75rem', fontWeight: '500' }}>
                                  {lang}: "{term}"
                                </span>
                              ))}
                            </div>
                          </div>
                          <button
                            onClick={() => deleteGlossaryEntry(entry.id)}
                            style={{
                              background: '#dc2626',
                              color: 'white',
                              border: 'none',
                              padding: '0.25rem 0.5rem',
                              borderRadius: '0.25rem',
                              fontSize: '0.75rem',
                              fontWeight: '500',
                              cursor: 'pointer',
                              marginLeft: '1rem'
                            }}
                          >
                            Ta bort
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add New Glossary Entry */}
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                  Ny glossary-post
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem', backgroundColor: '#f0f9ff', borderRadius: '0.5rem', border: '1px solid #bae6fd' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '500', color: '#374151', marginBottom: '0.25rem' }}>
                      Källterm (originalspråk) *
                    </label>
                    <input
                      type="text"
                      value={newGlossaryEntry.source || ''}
                      onChange={(e) => setNewGlossaryEntry(prev => ({ ...prev, source: e.target.value }))}
                      placeholder="t.ex. 'USB-C' eller 'Högpresterande'"
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '0.25rem', outline: 'none', fontSize: '0.875rem' }}
                    />
                  </div>
                  
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '500', color: '#374151', marginBottom: '0.25rem' }}>
                      Kommentar (valfri)
                    </label>
                    <input
                      type="text"
                      value={newGlossaryEntry.comment || ''}
                      onChange={(e) => setNewGlossaryEntry(prev => ({ ...prev, comment: e.target.value }))}
                      placeholder="Beskrivning eller kontext"
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '0.25rem', outline: 'none', fontSize: '0.875rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                      Måltermer (endast för aktiva språk)
                    </label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {translationLanguages.map((langCode) => (
                        <div key={langCode} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <label style={{ fontSize: '0.75rem', fontWeight: '500', color: '#374151', minWidth: '3rem' }}>
                            {langCode}:
                          </label>
                          <input
                            type="text"
                            value={newGlossaryEntry.targets?.[langCode] || ''}
                            onChange={(e) => setNewGlossaryEntry(prev => ({
                              ...prev,
                              targets: { ...prev.targets, [langCode]: e.target.value }
                            }))}
                            placeholder={`Målterm för ${getLanguageDisplayName(langCode)}`}
                            style={{ flex: 1, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '0.25rem', outline: 'none', fontSize: '0.875rem' }}
                          />
                        </div>
                      ))}
                      {translationLanguages.length === 0 && (
                        <p style={{ fontSize: '0.75rem', color: '#6b7280', fontStyle: 'italic' }}>
                          Lägg till språk i språkinställningarna först
                        </p>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={addGlossaryEntry}
                    disabled={translationLanguages.length === 0}
                    style={{
                      background: translationLanguages.length > 0 ? '#22c55e' : '#9ca3af',
                      color: 'white',
                      border: 'none',
                      padding: '0.5rem 1rem',
                      borderRadius: '0.25rem',
                      fontWeight: '500',
                      fontSize: '0.875rem',
                      cursor: translationLanguages.length > 0 ? 'pointer' : 'not-allowed',
                      transition: 'all 0.2s ease',
                      alignSelf: 'flex-start'
                    }}
                  >
                    Lägg till post
                  </button>
                </div>
              </div>

              {/* Save Glossary Button */}
              <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '1rem', borderTop: '1px solid #e5e7eb' }}>
                <button
                  onClick={saveGlossary}
                  style={{
                    background: '#22c55e',
                    color: 'white',
                    border: 'none',
                    padding: '0.75rem 1.5rem',
                    borderRadius: '0.5rem',
                    fontWeight: '500',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  Spara glossary
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}