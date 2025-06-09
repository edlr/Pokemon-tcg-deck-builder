import React, { useState, useEffect } from 'react';
import { Search, Plus, Minus, Sparkles, Filter, Heart, X, Eye, Shuffle, Star, Users, Zap, Shield } from 'lucide-react';
import './App.css';

// API configuration and functions directly in this file
const API_BASE = process.env.REACT_APP_API_BASE_URL || 'https://api.pokemontcg.io/v2';
const API_KEY = process.env.REACT_APP_POKEMON_API_KEY;

// API functions
const makeAPIRequest = async (url, options = {}) => {
  const headers = {
    'Content-Type': 'application/json',
    ...(API_KEY && { 'X-Api-Key': API_KEY }),
    ...options.headers,
  };

  try {
    console.log('Making request to:', url);
    console.log('With headers:', headers);
    
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
};

const searchCardsAPI = async (searchParams = {}) => {
  const {
    page = 1,
    pageSize = 20,
    name,
    types,
    supertype,
    rarity,
    setName,
  } = searchParams;

  let url = `${API_BASE}/cards?page=${page}&pageSize=${pageSize}`;
  const queryParts = [];

  if (name) queryParts.push(`name:"${name}*"`);
  if (types?.length) queryParts.push(`types:${types.join(' OR types:')}`);
  if (supertype) queryParts.push(`supertype:${supertype}`);
  if (rarity) queryParts.push(`rarity:"${rarity}"`);
  if (setName) queryParts.push(`set.name:"${setName}"`);

  if (queryParts.length > 0) {
    url += `&q=${encodeURIComponent(queryParts.join(' AND '))}`;
  }

  console.log('Final API URL:', url);
  return makeAPIRequest(url);
};

const PokemonTCGDeckBuilder = () => {
  // All state variables
  const [cards, setCards] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    type: '',
    supertype: '',
    rarity: '',
    set: ''
  });
  const [deck, setDeck] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [favorites, setFavorites] = useState([]);
  const [activeTab, setActiveTab] = useState('search');
  const [deckName, setDeckName] = useState('My Deck');
  const [savedDecks, setSavedDecks] = useState([]);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState('');
  const [clipboardSupported, setClipboardSupported] = useState(false);

  // Load saved data on component mount
  useEffect(() => {
    const savedDeck = localStorage.getItem('pokemonTCG_currentDeck');
    const savedFavorites = localStorage.getItem('pokemonTCG_favorites');
    const savedDeckName = localStorage.getItem('pokemonTCG_deckName');
    const savedDecksList = localStorage.getItem('pokemonTCG_savedDecks');
    
    if (savedDeck) {
      try {
        setDeck(JSON.parse(savedDeck));
      } catch (error) {
        console.error('Error loading saved deck:', error);
      }
    }
    
    if (savedFavorites) {
      try {
        setFavorites(JSON.parse(savedFavorites));
      } catch (error) {
        console.error('Error loading favorites:', error);
      }
    }
    
    if (savedDeckName) {
      setDeckName(savedDeckName);
    }
    
    if (savedDecksList) {
      try {
        setSavedDecks(JSON.parse(savedDecksList));
      } catch (error) {
        console.error('Error loading saved decks list:', error);
      }
    }
    
    // Load initial cards
    console.log('Component mounted, API_KEY present:', !!API_KEY);
    searchCards(1, true);
    
    // Check clipboard API support
    setClipboardSupported(navigator.clipboard && window.isSecureContext);
  }, []);

  // Save deck whenever it changes
  useEffect(() => {
    localStorage.setItem('pokemonTCG_currentDeck', JSON.stringify(deck));
  }, [deck]);

  // Save favorites whenever they change
  useEffect(() => {
    localStorage.setItem('pokemonTCG_favorites', JSON.stringify(favorites));
  }, [favorites]);

  // Save deck name whenever it changes
  useEffect(() => {
    localStorage.setItem('pokemonTCG_deckName', deckName);
  }, [deckName]);

  // Save deck list whenever it changes
  useEffect(() => {
    localStorage.setItem('pokemonTCG_savedDecks', JSON.stringify(savedDecks));
  }, [savedDecks]);

  // Check if card is Ace Spec
  const isAceSpec = (card) => {
    return card.subtypes && card.subtypes.includes('ACE SPEC');
  };

  // Check if card is basic energy
  const isBasicEnergy = (card) => {
    return card.supertype === 'Energy' && card.subtypes && card.subtypes.includes('Basic');
  };

  // Get maximum allowed copies for a card
  const getMaxCopies = (card) => {
    if (isAceSpec(card)) return 1;
    if (isBasicEnergy(card)) return 99; // Unlimited
    return 4; // Standard limit
  };

  // Paste from clipboard
  const pasteFromClipboard = async () => {
    if (!clipboardSupported) {
      alert('Clipboard access is not supported in this browser or requires HTTPS.');
      return;
    }
    
    try {
      const clipboardText = await navigator.clipboard.readText();
      if (clipboardText.trim()) {
        setImportText(clipboardText);
      } else {
        alert('Clipboard is empty!');
      }
    } catch (error) {
      console.error('Failed to read clipboard:', error);
      alert('Failed to access clipboard. Make sure you\'ve granted permission and the site is served over HTTPS.');
    }
  };

  // Quick import directly from clipboard
  const quickImportFromClipboard = async () => {
    if (!clipboardSupported) {
      alert('Clipboard access is not supported in this browser or requires HTTPS.');
      return;
    }
    
    try {
      const clipboardText = await navigator.clipboard.readText();
      if (!clipboardText.trim()) {
        alert('Clipboard is empty!');
        return;
      }
      
      // Check if clipboard content looks like a deck list
      const hasCardPattern = /^\d+\s+[^0-9]/m.test(clipboardText);
      const hasSectionHeaders = /Pokémon:|Trainer:|Energy:/i.test(clipboardText);
      
      if (!hasCardPattern && !hasSectionHeaders) {
        const proceed = window.confirm('Clipboard content doesn\'t look like a deck list. Import anyway?');
        if (!proceed) return;
      }
      
      setImportText(clipboardText);
      setShowImportModal(true);
    } catch (error) {
      console.error('Failed to read clipboard:', error);
      alert('Failed to access clipboard. Make sure you\'ve granted permission and the site is served over HTTPS.');
    }
  };
  const parseDeckList = (deckText) => {
    const lines = deckText.split('\n').map(line => line.trim()).filter(line => line);
    const cardEntries = [];
    let currentDeckName = 'Imported Deck';
    
    for (const line of lines) {
      // Skip section headers and total cards
      if (line.includes('Pokémon:') || line.includes('Trainer:') || line.includes('Energy:') || 
          line.includes('Total Cards:') || line === '') {
        continue;
      }
      
      // Check if line looks like a deck name (no numbers at start)
      if (!line.match(/^\d+/)) {
        currentDeckName = line;
        continue;
      }
      
      // Parse card lines like "4 Ethan's Cyndaquil DRI 32" or "5 Basic {R} Energy Energy 10"
      const cardMatch = line.match(/^(\d+)\s+(.+?)(?:\s+([A-Z]{2,4})\s+(\d+))?$/);
      if (cardMatch) {
        const [, count, cardName, setCode, cardNumber] = cardMatch;
        cardEntries.push({
          count: parseInt(count),
          name: cardName.trim(),
          setCode: setCode,
          number: cardNumber
        });
      }
    }
    
    return { cardEntries, deckName: currentDeckName };
  };

  // Search for card by name and set info
  const findCardByNameAndSet = async (cardName, setCode, cardNumber) => {
    try {
      // Clean up card name (remove special characters that might interfere)
      const cleanName = cardName.replace(/[{}]/g, '').replace(/\s+/g, ' ').trim();
      
      let searchParams = {
        page: 1,
        pageSize: 50,
        name: cleanName
      };
      
      // If we have set code, include it
      if (setCode) {
        searchParams.setName = setCode;
      }
      
      const data = await searchCardsAPI(searchParams);
      const cards = data.data || [];
      
      // Try to find exact match by name first
      let exactMatch = cards.find(card => 
        card.name.toLowerCase() === cleanName.toLowerCase()
      );
      
      // If no exact match, try partial match
      if (!exactMatch) {
        exactMatch = cards.find(card => 
          card.name.toLowerCase().includes(cleanName.toLowerCase()) ||
          cleanName.toLowerCase().includes(card.name.toLowerCase())
        );
      }
      
      // If we have set/number info, try to match that too
      if (exactMatch && setCode && cardNumber) {
        const setMatch = cards.find(card => 
          card.name.toLowerCase() === cleanName.toLowerCase() &&
          (card.set?.id?.toLowerCase() === setCode.toLowerCase() || 
           card.set?.ptcgoCode?.toLowerCase() === setCode.toLowerCase()) &&
          card.number === cardNumber
        );
        if (setMatch) {
          exactMatch = setMatch;
        }
      }
      
      return exactMatch;
    } catch (error) {
      console.error(`Error finding card: ${cardName}`, error);
      return null;
    }
  };

  // Import deck from text with enhanced debugging
  const importDeck = async () => {
    if (!importText.trim()) {
      alert('Please paste a deck list to import!');
      return;
    }
    
    setLoading(true);
    console.log('🔍 Starting deck import process...');
    console.log('📋 Raw import text:', importText);
    
    const { cardEntries, deckName: importedDeckName } = parseDeckList(importText);
    console.log('📊 Parsed card entries:', cardEntries);
    console.log('🏷️ Detected deck name:', importedDeckName);
    
    if (cardEntries.length === 0) {
      alert('No valid cards found in the deck list. Please check the format.');
      setLoading(false);
      return;
    }
    
    const newDeck = [];
    const notFound = [];
    const debugResults = [];
    let processed = 0;
    
    console.log(`🎯 Processing ${cardEntries.length} cards...`);
    
    for (const entry of cardEntries) {
      console.log(`\n🔄 Processing card ${processed + 1}/${cardEntries.length}:`);
      console.log(`   Name: "${entry.name}"`);
      console.log(`   Set: ${entry.setCode || 'none'}`);
      console.log(`   Number: ${entry.number || 'none'}`);
      console.log(`   Count: ${entry.count}`);
      
      try {
        const foundCard = await findCardByNameAndSet(entry.name, entry.setCode, entry.number);
        if (foundCard) {
          console.log(`✅ SUCCESS: Found "${foundCard.name}" from ${foundCard.set?.name} #${foundCard.number}`);
          newDeck.push({
            ...foundCard,
            count: entry.count
          });
          debugResults.push({
            searched: entry.name,
            found: foundCard.name,
            set: foundCard.set?.name,
            success: true
          });
        } else {
          console.log(`❌ FAILED: Could not find "${entry.name}"`);
          notFound.push(`${entry.count} ${entry.name}${entry.setCode ? ` ${entry.setCode}-${entry.number}` : ''}`);
          debugResults.push({
            searched: entry.name,
            found: null,
            success: false,
            setCode: entry.setCode
          });
        }
        processed++;
        
        // Add delay to avoid rate limiting
        if (processed % 3 === 0) {
          console.log('⏱️ Pausing to avoid rate limits...');
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      } catch (error) {
        console.error('💥 Error processing card:', entry, error);
        notFound.push(`${entry.count} ${entry.name}`);
        debugResults.push({
          searched: entry.name,
          found: null,
          success: false,
          error: error.message
        });
      }
    }
    
    // Enhanced results analysis
    console.log('\n📈 IMPORT SUMMARY:');
    console.log(`   Total cards processed: ${processed}`);
    console.log(`   Successfully found: ${newDeck.length}`);
    console.log(`   Failed to find: ${notFound.length}`);
    
    console.log('\n🔍 DETAILED RESULTS:');
    debugResults.forEach((result, index) => {
      if (result.success) {
        console.log(`   ✅ ${index + 1}. "${result.searched}" → "${result.found}" (${result.set})`);
      } else {
        console.log(`   ❌ ${index + 1}. "${result.searched}" → NOT FOUND${result.setCode ? ` (Set: ${result.setCode})` : ''}`);
      }
    });
    
    // Analyze failure patterns
    const failedSets = debugResults
      .filter(r => !r.success && r.setCode)
      .map(r => r.setCode);
    const uniqueFailedSets = [...new Set(failedSets)];
    
    if (uniqueFailedSets.length > 0) {
      console.log('\n🎯 FAILURE ANALYSIS:');
      console.log('   Failed set codes:', uniqueFailedSets);
      console.log('   This suggests missing set code mappings or API coverage issues');
    }
    
    setDeck(newDeck);
    setDeckName(importedDeckName);
    setImportText('');
    setShowImportModal(false);
    setActiveTab('deck');
    setLoading(false);
    
    // Show enhanced results
    const foundCount = newDeck.reduce((sum, card) => sum + card.count, 0);
    const totalCount = cardEntries.reduce((sum, entry) => sum + entry.count, 0);
    
    let resultMessage = `Import completed!\n\nFound: ${foundCount}/${totalCount} cards`;
    
    if (notFound.length > 0) {
      resultMessage += `\n\nNot found:\n${notFound.slice(0, 10).join('\n')}${notFound.length > 10 ? `\n... and ${notFound.length - 10} more` : ''}`;
      
      if (uniqueFailedSets.length > 0) {
        resultMessage += `\n\nNote: Many failures from sets: ${uniqueFailedSets.join(', ')}. Check console for detailed analysis.`;
      } else {
        resultMessage += '\n\nNote: Check browser console (F12) for detailed search analysis.';
      }
    } else {
      resultMessage += '\n\nAll cards found successfully!';
    }
    
    alert(resultMessage);
  };
  const saveDeck = () => {
    if (deck.length === 0) {
      alert('Cannot save an empty deck!');
      return;
    }
    
    const deckToSave = {
      id: Date.now().toString(),
      name: deckName,
      cards: deck,
      dateCreated: new Date().toLocaleDateString(),
      cardCount: deck.reduce((sum, card) => sum + card.count, 0)
    };
    
    const updatedDecks = [...savedDecks, deckToSave];
    setSavedDecks(updatedDecks);
    alert(`Deck "${deckName}" saved successfully!`);
  };

  const loadDeck = (savedDeck) => {
    setDeck(savedDeck.cards);
    setDeckName(savedDeck.name);
    setActiveTab('deck');
    alert(`Loaded deck: ${savedDeck.name}`);
  };

  const deleteSavedDeck = (deckId) => {
    if (window.confirm('Are you sure you want to delete this saved deck?')) {
      setSavedDecks(savedDecks.filter(deck => deck.id !== deckId));
    }
  };

  const clearCurrentDeck = () => {
    if (window.confirm('Are you sure you want to clear your current deck?')) {
      setDeck([]);
      setDeckName('My Deck');
    }
  };

  const exportDeck = () => {
    if (deck.length === 0) {
      alert('Cannot export an empty deck!');
      return;
    }
    
    const deckList = `${deckName}\n\n` +
      `Pokémon (${deck.filter(card => card.supertype === 'Pokémon').reduce((sum, card) => sum + card.count, 0)}):\n` +
      deck.filter(card => card.supertype === 'Pokémon')
        .map(card => `${card.count} ${card.name} ${card.set?.id}-${card.number}`)
        .join('\n') +
      `\n\nTrainer (${deck.filter(card => card.supertype === 'Trainer').reduce((sum, card) => sum + card.count, 0)}):\n` +
      deck.filter(card => card.supertype === 'Trainer')
        .map(card => `${card.count} ${card.name} ${card.set?.id}-${card.number}`)
        .join('\n') +
      `\n\nEnergy (${deck.filter(card => card.supertype === 'Energy').reduce((sum, card) => sum + card.count, 0)}):\n` +
      deck.filter(card => card.supertype === 'Energy')
        .map(card => `${card.count} ${card.name} ${card.set?.id}-${card.number}`)
        .join('\n') +
      `\n\nTotal Cards: ${deck.reduce((sum, card) => sum + card.count, 0)}`;
    
    // Create downloadable file
    const blob = new Blob([deckList], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${deckName.replace(/[^a-z0-9]/gi, '_')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Fetch cards from API
  const searchCards = async (page = 1, isNewSearch = false) => {
    setLoading(true);
    try {
      const searchParams = {
        page,
        pageSize: 20,
        name: searchQuery.trim() || undefined,
        supertype: filters.supertype || undefined,
        rarity: filters.rarity || undefined,
        types: filters.type ? [filters.type] : undefined
      };

      console.log('Searching with params:', searchParams);
      const data = await searchCardsAPI(searchParams);
      
      if (isNewSearch) {
        setCards(data.data || []);
      } else {
        setCards(prev => [...prev, ...(data.data || [])]);
      }
      
      setTotalCount(data.totalCount || 0);
      console.log('Found', data.totalCount, 'cards');
    } catch (error) {
      console.error('Error fetching cards:', error);
      if (isNewSearch) {
        setCards([]);
      }
      setTotalCount(0);
    }
    setLoading(false);
  };

  const handleSearch = () => {
    console.log('Search triggered with query:', searchQuery, 'and filters:', filters);
    setCurrentPage(1);
    searchCards(1, true);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const loadMore = () => {
    const nextPage = currentPage + 1;
    setCurrentPage(nextPage);
    searchCards(nextPage, false);
  };

  const addToDeck = (card) => {
    const existingCard = deck.find(c => c.id === card.id);
    const maxCopies = getMaxCopies(card);
    
    // Check for Ace Spec rule - only one Ace Spec card allowed in entire deck
    if (isAceSpec(card) && !existingCard) {
      const hasAceSpec = deck.some(c => isAceSpec(c));
      if (hasAceSpec) {
        alert('You can only have ONE ACE SPEC card in your deck!');
        return;
      }
    }
    
    if (existingCard) {
      if (existingCard.count < maxCopies) {
        setDeck(deck.map(c => 
          c.id === card.id ? { ...c, count: c.count + 1 } : c
        ));
      } else {
        const cardType = isAceSpec(card) ? 'ACE SPEC' : isBasicEnergy(card) ? 'Basic Energy' : 'card';
        const limit = maxCopies === 99 ? 'unlimited' : maxCopies;
        alert(`Maximum ${limit} copies of this ${cardType} allowed!`);
      }
    } else {
      setDeck([...deck, { ...card, count: 1 }]);
    }
  };

  const removeFromDeck = (cardId) => {
    const existingCard = deck.find(c => c.id === cardId);
    if (existingCard && existingCard.count > 1) {
      setDeck(deck.map(c => 
        c.id === cardId ? { ...c, count: c.count - 1 } : c
      ));
    } else {
      setDeck(deck.filter(c => c.id !== cardId));
    }
  };

  const toggleFavorite = (card) => {
    const isFavorite = favorites.some(f => f.id === card.id);
    if (isFavorite) {
      setFavorites(favorites.filter(f => f.id !== card.id));
    } else {
      setFavorites([...favorites, card]);
    }
  };

  // Enhanced AI analysis with competitive meta insights
  const getEnhancedAISuggestions = () => {
    if (deck.length === 0) return [];
    
    const suggestions = [];
    const deckCards = deck.filter(card => card.count > 0);
    
    // Basic composition analysis
    const pokemon = deckCards.filter(card => card.supertype === 'Pokémon');
    const trainers = deckCards.filter(card => card.supertype === 'Trainer');
    const energy = deckCards.filter(card => card.supertype === 'Energy');
    
    const pokemonCount = pokemon.reduce((sum, card) => sum + card.count, 0);
    const trainerCount = trainers.reduce((sum, card) => sum + card.count, 0);
    const energyCount = energy.reduce((sum, card) => sum + card.count, 0);
    const totalCards = pokemonCount + trainerCount + energyCount;
    
    // Identify deck archetype and strategy
    const deckArchetype = identifyDeckArchetype(deckCards);
    const metaPosition = analyzeMetaPosition(deckArchetype, deckCards);
    
    // Advanced meta-aware analysis
    const competitiveAnalysis = analyzeCompetitiveViability(deckCards, deckArchetype);
    const matchupAnalysis = generateMatchupAdvice(deckCards, deckArchetype);
    const optimizationSuggestions = generateOptimizationSuggestions(deckCards, deckArchetype);
    
    // Combine all analysis types
    suggestions.push(...competitiveAnalysis);
    suggestions.push(...matchupAnalysis);
    suggestions.push(...optimizationSuggestions);
    
    // Basic composition checks (keep existing logic but enhance)
    if (totalCards < 60) {
      suggestions.push({
        category: 'Deck Completion',
        priority: 'high',
        message: `Add ${60 - totalCards} more cards to reach tournament legal 60-card requirement`,
        type: 'requirement',
        explanation: 'All tournament formats require exactly 60 cards. Consider adding consistency pieces or tech cards.',
        metaRelevance: 'essential'
      });
    }
    
    // Meta-aware trainer analysis
    const metaTrainerAnalysis = analyzeTrainerSuite(trainers, deckArchetype);
    suggestions.push(...metaTrainerAnalysis);
    
    // Energy curve analysis
    const energyAnalysis = analyzeEnergyRequirements(deckCards, energy);
    suggestions.push(...energyAnalysis);
    
    // Win condition analysis
    const winConditionAnalysis = analyzeWinConditions(pokemon, deckArchetype);
    suggestions.push(...winConditionAnalysis);
    
    return suggestions.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      const metaOrder = { essential: 3, important: 2, optional: 1 };
      
      const aPriority = priorityOrder[a.priority] || 0;
      const bPriority = priorityOrder[b.priority] || 0;
      const aMetaRelevance = metaOrder[a.metaRelevance] || 0;
      const bMetaRelevance = metaOrder[b.metaRelevance] || 0;
      
      // Sort by priority first, then meta relevance
      if (aPriority !== bPriority) return bPriority - aPriority;
      return bMetaRelevance - aMetaRelevance;
    });
  };

  // Identify what type of deck this is
  const identifyDeckArchetype = (deckCards) => {
    const pokemonNames = deckCards
      .filter(card => card.supertype === 'Pokémon')
      .map(card => card.name.toLowerCase());
    
    // Check for popular archetypes
    if (pokemonNames.some(name => name.includes('charizard'))) {
      return { type: 'Charizard ex', tier: 'Tier 1', strategy: 'High HP beatdown' };
    }
    if (pokemonNames.some(name => name.includes('miraidon'))) {
      return { type: 'Miraidon ex', tier: 'Tier 1', strategy: 'Electric toolbox' };
    }
    if (pokemonNames.some(name => name.includes('gardevoir'))) {
      return { type: 'Gardevoir ex', tier: 'Tier 1', strategy: 'Psychic acceleration' };
    }
    if (pokemonNames.some(name => name.includes('typhlosion'))) {
      return { type: 'Ethan\'s Typhlosion', tier: 'Tier 1.5', strategy: 'Single prize aggro' };
    }
    if (pokemonNames.some(name => name.includes('dragapult'))) {
      return { type: 'Dragapult ex', tier: 'Tier 2', strategy: 'Damage spread' };
    }
    if (pokemonNames.some(name => name.includes('pidgeot'))) {
      return { type: 'Pidgeot Control', tier: 'Tier 2', strategy: 'Control/Consistency' };
    }
    
    // Determine if it's a single prize or multi-prize strategy
    const hasExGX = pokemonNames.some(name => name.includes('ex') || name.includes('gx'));
    const hasV = pokemonNames.some(name => name.includes(' v'));
    
    if (hasExGX || hasV) {
      return { type: 'Multi-Prize Deck', tier: 'Unknown', strategy: 'Two-prize Pokemon' };
    }
    
    return { type: 'Single Prize Deck', tier: 'Unknown', strategy: 'One-prize Pokemon' };
  };

  // Analyze how this deck fits in the current meta
  const analyzeMetaPosition = (archetype, deckCards) => {
    const metaDecks = {
      'Charizard ex': { popularity: 'Very High', difficulty: 'Medium' },
      'Miraidon ex': { popularity: 'High', difficulty: 'Medium' },
      'Gardevoir ex': { popularity: 'High', difficulty: 'High' },
      'Ethan\'s Typhlosion': { popularity: 'Medium', difficulty: 'Medium' },
      'Dragapult ex': { popularity: 'Medium', difficulty: 'High' }
    };
    
    return metaDecks[archetype.type] || { popularity: 'Low', difficulty: 'Unknown' };
  };

  // Generate competitive viability analysis
  const analyzeCompetitiveViability = (deckCards, archetype) => {
    const suggestions = [];
    
    suggestions.push({
      category: 'Meta Analysis',
      priority: 'medium',
      message: `Deck Archetype: ${archetype.type} (${archetype.tier})`,
      type: 'meta',
      explanation: `This deck follows the ${archetype.strategy} strategy. Current meta position: ${archetype.tier}`,
      metaRelevance: 'important'
    });
    
    // Check for meta staples
    const hasResearch = deckCards.some(card => card.name.includes('Professor\'s Research'));
    const hasUltraBall = deckCards.some(card => card.name.includes('Ultra Ball'));
    const hasBoss = deckCards.some(card => card.name.includes('Boss\'s Orders'));
    
    if (!hasResearch) {
      suggestions.push({
        category: 'Meta Staples',
        priority: 'high',
        message: 'Add 3-4 Professor\'s Research - Essential draw power in current meta',
        type: 'meta',
        explanation: 'Professor\'s Research is the most played supporter in competitive Pokemon. Provides explosive draw power.',
        metaRelevance: 'essential'
      });
    }
    
    if (!hasUltraBall) {
      suggestions.push({
        category: 'Meta Staples',
        priority: 'high',
        message: 'Add 4 Ultra Ball - Standard Pokemon search in all competitive decks',
        type: 'meta',
        explanation: 'Ultra Ball is played as a 4-of in virtually every competitive deck for Pokemon consistency.',
        metaRelevance: 'essential'
      });
    }
    
    if (!hasBoss) {
      suggestions.push({
        category: 'Meta Staples',
        priority: 'medium',
        message: 'Add 1-2 Boss\'s Orders - Crucial for taking knockout prizes',
        type: 'meta',
        explanation: 'Boss\'s Orders allows you to target specific threats and secure key knockouts.',
        metaRelevance: 'important'
      });
    }
    
    return suggestions;
  };

  // Generate matchup-specific advice
  const generateMatchupAdvice = (deckCards, archetype) => {
    const suggestions = [];
    
    if (archetype.type === 'Ethan\'s Typhlosion') {
      suggestions.push({
        category: 'Matchup Strategy',
        priority: 'medium',
        message: 'Favorable vs Charizard ex, Gardevoir ex (single prize advantage)',
        type: 'strategy',
        explanation: 'Your single prize Pokemon force unfavorable prize trades against two-prize decks.',
        metaRelevance: 'important'
      });
      
      suggestions.push({
        category: 'Matchup Strategy',
        priority: 'medium',
        message: 'Difficult vs Miraidon ex, Lost Box (speed advantage)',
        type: 'strategy',
        explanation: 'Fast decks can pressure you before your Stage 2 setup completes. Consider consistency improvements.',
        metaRelevance: 'important'
      });
    }
    
    if (archetype.type === 'Charizard ex') {
      suggestions.push({
        category: 'Matchup Strategy',
        priority: 'medium',
        message: 'Strong vs Gardevoir ex, Miraidon ex (high HP advantage)',
        type: 'strategy',
        explanation: '330 HP makes Charizard difficult to OHKO for most meta decks.',
        metaRelevance: 'important'
      });
    }
    
    // Add general competitive advice
    suggestions.push({
      category: 'Tournament Prep',
      priority: 'low',
      message: 'Practice prize management - crucial skill in current meta',
      type: 'strategy',
      explanation: 'Managing prize trades and when to take certain knockouts separates good players from great ones.',
      metaRelevance: 'important'
    });
    
    return suggestions;
  };

  // Generate optimization suggestions
  const generateOptimizationSuggestions = (deckCards, archetype) => {
    const suggestions = [];
    
    // Archetype-specific optimizations
    if (archetype.type.includes('Typhlosion')) {
      const hasGravityMountain = deckCards.some(card => card.name.includes('Gravity Mountain'));
      if (!hasGravityMountain) {
        suggestions.push({
          category: 'Meta Optimization',
          priority: 'medium',
          message: 'Add 1-2 Gravity Mountain - Crucial for damage math vs high HP Pokemon',
          type: 'meta',
          explanation: 'Reduces Stage 2 HP by 30, often turning 2HKOs into OHKOs against Charizard/Gardevoir.',
          metaRelevance: 'important'
        });
      }
      
      const hasPidgeot = deckCards.some(card => card.name.includes('Pidgeot'));
      if (!hasPidgeot) {
        suggestions.push({
          category: 'Consistency Engine',
          priority: 'high',
          message: 'Add 2-2 Pidgeot ex line - Meta standard for draw consistency',
          type: 'meta',
          explanation: 'Pidgeot ex provides reliable card search every turn, essential for competitive play.',
          metaRelevance: 'essential'
        });
      }
    }
    
    if (archetype.type.includes('Charizard')) {
      const hasRadiantCharizard = deckCards.some(card => card.name.includes('Radiant Charizard'));
      if (!hasRadiantCharizard) {
        suggestions.push({
          category: 'Meta Tech',
          priority: 'medium',
          message: 'Consider Radiant Charizard - Popular energy acceleration option',
          type: 'meta',
          explanation: 'Provides additional energy attachment and damage output flexibility.',
          metaRelevance: 'optional'
        });
      }
    }
    
    return suggestions;
  };

  // Analyze trainer suite for meta compliance
  const analyzeTrainerSuite = (trainers, archetype) => {
    const suggestions = [];
    const trainerCounts = {};
    
    trainers.forEach(card => {
      trainerCounts[card.name] = (trainerCounts[card.name] || 0) + card.count;
    });
    
    // Check research count
    const researchCount = trainerCounts['Professor\'s Research'] || 0;
    if (researchCount < 3) {
      suggestions.push({
        category: 'Draw Engine',
        priority: 'high',
        message: `Increase Professor's Research to 3-4 copies (currently ${researchCount})`,
        type: 'meta',
        explanation: 'Competitive decks typically run 3-4 Research for explosive draw power.',
        metaRelevance: 'essential'
      });
    }
    
    return suggestions;
  };

  // Analyze energy requirements
  const analyzeEnergyRequirements = (deckCards, energy) => {
    const suggestions = [];
    const energyCount = energy.reduce((sum, card) => sum + card.count, 0);
    
    // Basic energy count analysis based on deck type
    const pokemon = deckCards.filter(card => card.supertype === 'Pokémon');
    const avgEnergyCost = calculateAverageEnergyCost(pokemon);
    
    if (avgEnergyCost > 2 && energyCount < 8) {
      suggestions.push({
        category: 'Energy Curve',
        priority: 'medium',
        message: `Consider ${8 - energyCount} more energy cards - High energy cost attackers detected`,
        type: 'strategy',
        explanation: `Average energy cost: ${avgEnergyCost.toFixed(1)}. Higher energy counts improve consistency.`,
        metaRelevance: 'important'
      });
    }
    
    return suggestions;
  };

  // Analyze win conditions
  const analyzeWinConditions = (pokemon, archetype) => {
    const suggestions = [];
    
    const mainAttackers = pokemon.filter(card => 
      card.name.includes('ex') || card.name.includes('GX') || 
      card.name.includes('V') || card.subtypes?.includes('Stage 2')
    );
    
    if (mainAttackers.length === 0) {
      suggestions.push({
        category: 'Win Condition',
        priority: 'high',
        message: 'No clear primary attacker identified - Add powerful Pokemon',
        type: 'strategy',
        explanation: 'Competitive decks need defined win conditions with strong attacking Pokemon.',
        metaRelevance: 'essential'
      });
    }
    
    return suggestions;
  };

  // Helper function to calculate average energy cost
  const calculateAverageEnergyCost = (pokemon) => {
    const attackers = pokemon.filter(card => card.attacks && card.attacks.length > 0);
    if (attackers.length === 0) return 1;
    
    const totalCost = attackers.reduce((sum, card) => {
      const maxCost = Math.max(...card.attacks.map(attack => attack.cost?.length || 0));
      return sum + maxCost;
    }, 0);
    
    return totalCost / attackers.length;
  };

  const getDeckStats = () => {
    const totalCards = deck.reduce((sum, card) => sum + card.count, 0);
    const pokemon = deck.filter(card => card.supertype === 'Pokémon');
    const trainers = deck.filter(card => card.supertype === 'Trainer');
    const energy = deck.filter(card => card.supertype === 'Energy');
    
    return {
      total: totalCards,
      pokemon: pokemon.reduce((sum, card) => sum + card.count, 0),
      trainers: trainers.reduce((sum, card) => sum + card.count, 0),
      energy: energy.reduce((sum, card) => sum + card.count, 0)
    };
  };

  const CardComponent = ({ card }) => {
    const maxCopies = getMaxCopies(card);
    const deckCard = deck.find(c => c.id === card.id);
    const currentCount = deckCard ? deckCard.count : 0;
    const isAtLimit = currentCount >= maxCopies;
    
    return (
      <div className="card">
        <div className="card-actions">
          <button
            onClick={() => toggleFavorite(card)}
            className={`icon-btn ${favorites.some(f => f.id === card.id) ? 'favorited' : ''}`}
          >
            <Heart size={16} fill={favorites.some(f => f.id === card.id) ? 'currentColor' : 'none'} />
          </button>
          <button
            onClick={() => setSelectedCard(card)}
            className="icon-btn"
          >
            <Eye size={16} />
          </button>
        </div>
        
        {card.images?.small && (
          <img 
            src={card.images.small} 
            alt={card.name}
            className="card-image"
          />
        )}
        
        <h3 className="card-title">{card.name}</h3>
        <div className="card-details">
          <div>Set: {card.set?.name}</div>
          {card.types && <div>Type: {card.types.join(', ')}</div>}
          {card.supertype && <div>Category: {card.supertype}</div>}
          {card.subtypes && <div>Subtype: {card.subtypes.join(', ')}</div>}
          {card.rarity && <div>Rarity: {card.rarity}</div>}
          {isAceSpec(card) && <div className="ace-spec-badge">⭐ ACE SPEC (Limit: 1)</div>}
          {isBasicEnergy(card) && <div className="basic-energy-badge">⚡ Basic Energy (Unlimited)</div>}
          {card.tcgplayer?.prices?.holofoil?.market && (
            <div className="card-price">
              ${card.tcgplayer.prices.holofoil.market.toFixed(2)}
            </div>
          )}
        </div>
        
        {/* Always show deck controls for all cards */}
        <div className="deck-controls">
          <div className="count-info">
            <span className="count-display">
              In Deck: {currentCount}
              {maxCopies === 99 ? ' (Unlimited)' : ` / ${maxCopies}`}
            </span>
          </div>
          <div className="count-buttons">
            <button
              onClick={() => removeFromDeck(card.id)}
              className="btn btn-danger btn-small"
              disabled={currentCount === 0}
              title="Remove from deck"
            >
              <Minus size={12} />
            </button>
            <span className="current-count">{currentCount}</span>
            <button
              onClick={() => addToDeck(card)}
              className="btn btn-success btn-small"
              disabled={isAtLimit}
              title={isAtLimit ? `Maximum ${maxCopies === 99 ? 'unlimited' : maxCopies} copies allowed` : 'Add to deck'}
            >
              <Plus size={12} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  const stats = getDeckStats();
  const suggestions = getEnhancedAISuggestions();

  return (
    <div className="app">
      <div className="container">
        {/* Header */}
        <header className="header">
          <h1>Pokémon TCG Deck Builder</h1>
          <p>Build competitive decks with real-time card data</p>
          {!API_KEY && (
            <div style={{background: '#fee2e2', color: '#991b1b', padding: '0.5rem', borderRadius: '4px', marginTop: '0.5rem'}}>
              ⚠️ No API key detected. Add your API key to the .env file
            </div>
          )}
        </header>

        {/* Navigation Tabs */}
        <div className="tabs">
          <div className="tab-container">
            {[
              { id: 'search', label: 'Card Search', icon: Search },
              { id: 'deck', label: `${deckName} (${stats.total}/60)`, icon: Users },
              { id: 'favorites', label: `Favorites (${favorites.length})`, icon: Heart },
              { id: 'suggestions', label: 'AI Suggestions', icon: Sparkles }
            ].map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`tab ${activeTab === tab.id ? 'active' : ''}`}
                >
                  <Icon size={16} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Search Tab */}
        {activeTab === 'search' && (
          <div className="tab-content">
            {/* Search and Filters */}
            <div className="search-section card">
              <div className="search-controls">
                <div className="search-input-container">
                  <input
                    type="text"
                    placeholder="Search cards by name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="search-input"
                  />
                </div>
                <button
                  onClick={handleSearch}
                  className="btn btn-primary"
                >
                  <Search size={16} /> Search
                </button>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="btn btn-secondary"
                >
                  <Filter size={16} />
                </button>
              </div>

              {showFilters && (
                <div className="filters">
                  <select
                    value={filters.type}
                    onChange={(e) => setFilters({...filters, type: e.target.value})}
                    className="filter-select"
                  >
                    <option value="">All Types</option>
                    <option value="Colorless">Colorless</option>
                    <option value="Fire">Fire</option>
                    <option value="Water">Water</option>
                    <option value="Lightning">Lightning</option>
                    <option value="Psychic">Psychic</option>
                    <option value="Fighting">Fighting</option>
                    <option value="Darkness">Darkness</option>
                    <option value="Metal">Metal</option>
                    <option value="Grass">Grass</option>
                  </select>
                  
                  <select
                    value={filters.supertype}
                    onChange={(e) => setFilters({...filters, supertype: e.target.value})}
                    className="filter-select"
                  >
                    <option value="">All Categories</option>
                    <option value="Pokémon">Pokémon</option>
                    <option value="Trainer">Trainer</option>
                    <option value="Energy">Energy</option>
                  </select>
                  
                  <select
                    value={filters.rarity}
                    onChange={(e) => setFilters({...filters, rarity: e.target.value})}
                    className="filter-select"
                  >
                    <option value="">All Rarities</option>
                    <option value="Common">Common</option>
                    <option value="Uncommon">Uncommon</option>
                    <option value="Rare">Rare</option>
                    <option value="Rare Holo">Rare Holo</option>
                  </select>
                  
                  <button
                    onClick={handleSearch}
                    className="btn btn-primary"
                  >
                    Apply Filters
                  </button>
                </div>
              )}
            </div>

            {/* Loading State */}
            {loading && cards.length === 0 && (
              <div className="loading">
                <div className="spinner"></div>
                <p>Loading cards...</p>
              </div>
            )}

            {/* Cards Grid */}
            {!loading || cards.length > 0 ? (
              <div className="cards-grid">
                {cards.map((card) => (
                  <CardComponent key={card.id} card={card} />
                ))}
              </div>
            ) : null}

            {/* No Results */}
            {!loading && cards.length === 0 && (searchQuery || Object.values(filters).some(f => f)) && (
              <div className="no-results card">
                <Search size={48} />
                <h3>No cards found</h3>
                <p>Try adjusting your search terms or filters</p>
              </div>
            )}

            {/* Load More */}
            {cards.length < totalCount && (
              <div className="load-more">
                <button
                  onClick={loadMore}
                  disabled={loading}
                  className="btn btn-primary"
                >
                  {loading ? 'Loading...' : 'Load More Cards'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Deck Tab */}
        {activeTab === 'deck' && (
          <div className="tab-content">
            {/* Deck Management Section */}
            <div className="deck-management card">
              <div className="deck-header">
                <div className="deck-name-section">
                  <label htmlFor="deckName">Deck Name:</label>
                  <input
                    id="deckName"
                    type="text"
                    value={deckName}
                    onChange={(e) => setDeckName(e.target.value)}
                    className="deck-name-input"
                    placeholder="Enter deck name..."
                  />
                </div>
                <div className="deck-actions">
                  <button onClick={saveDeck} className="btn btn-success">
                    💾 Save Deck
                  </button>
                  <button onClick={() => setShowImportModal(true)} className="btn btn-secondary">
                    📥 Import
                  </button>
                  {clipboardSupported && (
                    <button onClick={quickImportFromClipboard} className="btn btn-info">
                      📋 Quick Import
                    </button>
                  )}
                  <button onClick={exportDeck} className="btn btn-primary">
                    📄 Export
                  </button>
                  <button onClick={clearCurrentDeck} className="btn btn-danger">
                    🗑️ Clear
                  </button>
                </div>
              </div>
            </div>

            {/* Saved Decks Section */}
            {savedDecks.length > 0 && (
              <div className="saved-decks card">
                <h3>📚 Saved Decks ({savedDecks.length})</h3>
                <div className="saved-decks-grid">
                  {savedDecks.map((savedDeck) => (
                    <div key={savedDeck.id} className="saved-deck-item">
                      <div className="saved-deck-info">
                        <h4>{savedDeck.name}</h4>
                        <p>{savedDeck.cardCount} cards • {savedDeck.dateCreated}</p>
                      </div>
                      <div className="saved-deck-actions">
                        <button
                          onClick={() => loadDeck(savedDeck)}
                          className="btn btn-primary btn-small"
                        >
                          Load
                        </button>
                        <button
                          onClick={() => deleteSavedDeck(savedDeck.id)}
                          className="btn btn-danger btn-small"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div className="deck-stats card">
              <h2>
                <Users />
                {deckName} ({stats.total}/60)
              </h2>
              <div className="stats-grid">
                <div className="stat-item pokemon">
                  <Shield size={24} />
                  <div className="stat-number">{stats.pokemon}</div>
                  <div className="stat-label">Pokémon</div>
                </div>
                <div className="stat-item trainers">
                  <Star size={24} />
                  <div className="stat-number">{stats.trainers}</div>
                  <div className="stat-label">Trainers</div>
                </div>
                <div className="stat-item energy">
                  <Zap size={24} />
                  <div className="stat-number">{stats.energy}</div>
                  <div className="stat-label">Energy</div>
                </div>
                <div className="stat-item total">
                  <Shuffle size={24} />
                  <div className="stat-number">{stats.total}</div>
                  <div className="stat-label">Total</div>
                </div>
              </div>
            </div>

            {deck.length > 0 ? (
              <div className="cards-grid">
                {deck.map((card) => (
                  <div key={card.id} className="deck-card">
                    <CardComponent card={card} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-deck card">
                <Users size={48} />
                <h3>Your deck is empty</h3>
                <p>Start building by searching and adding cards!</p>
              </div>
            )}
          </div>
        )}

        {/* Favorites Tab */}
        {activeTab === 'favorites' && (
          <div className="tab-content">
            <h2>
              <Heart />
              Favorite Cards ({favorites.length})
            </h2>
            {favorites.length > 0 ? (
              <div className="cards-grid">
                {favorites.map((card) => (
                  <CardComponent key={card.id} card={card} />
                ))}
              </div>
            ) : (
              <div className="empty-favorites card">
                <Heart size={48} />
                <h3>No favorites yet</h3>
                <p>Click the heart icon on cards to save them here!</p>
              </div>
            )}
          </div>
        )}

        {/* AI Suggestions Tab */}
        {activeTab === 'suggestions' && (
          <div className="tab-content">
            <h2>
              <Sparkles />
              AI Deck Suggestions
            </h2>
            
            <div className="suggestions-section card">
              <h3>🧠 Competitive Deck Analysis</h3>
              {suggestions.length > 0 ? (
                <div className="suggestions-container">
                  {suggestions.map((suggestion, index) => (
                    <div key={index} className={`suggestion-item ${suggestion.priority} ${suggestion.type}`}>
                      <div className="suggestion-header">
                        <span className="suggestion-category">{suggestion.category}</span>
                        <div className="suggestion-badges">
                          <span className={`priority-badge ${suggestion.priority}`}>
                            {suggestion.priority.toUpperCase()}
                          </span>
                          {suggestion.metaRelevance && (
                            <span className={`meta-badge ${suggestion.metaRelevance}`}>
                              {suggestion.metaRelevance.toUpperCase()}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="suggestion-message">{suggestion.message}</div>
                      {suggestion.explanation && (
                        <div className="suggestion-explanation">{suggestion.explanation}</div>
                      )}
                      <div className="suggestion-type">
                        {suggestion.type === 'meta' ? '📊 Meta Analysis' : 
                         suggestion.type === 'strategy' ? '⚔️ Strategy' : '⚠️ Requirement'}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="no-suggestions">
                  <Sparkles size={48} />
                  <h3>No analysis available</h3>
                  <p>Build your deck to get competitive meta analysis!</p>
                </div>
              )}
            </div>

            <div className="tips-section card">
              <h3>Deck Building Tips</h3>
              <div className="tips-grid">
                <div className="tip-card standard">
                  <h4>Standard Deck Composition</h4>
                  <ul>
                    <li>• 10-20 Pokémon cards</li>
                    <li>• 25-35 Trainer cards</li>
                    <li>• 8-15 Energy cards</li>
                    <li>• Total: 60 cards</li>
                  </ul>
                </div>
                <div className="tip-card strategy">
                  <h4>Key Strategies</h4>
                  <ul>
                    <li>• Focus on 1-2 main Pokémon types</li>
                    <li>• Include evolution lines</li>
                    <li>• Add draw/search trainers</li>
                    <li>• Balance offense and defense</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Import Modal */}
        {showImportModal && (
          <div className="modal-overlay">
            <div className="modal import-modal">
              <div className="modal-header">
                <h2>📥 Import Deck List</h2>
                <button
                  onClick={() => setShowImportModal(false)}
                  className="modal-close"
                >
                  <X size={24} />
                </button>
              </div>
              
              <div className="import-modal-content">
                <div className="import-instructions">
                  <h3>Supported Formats:</h3>
                  <ul>
                    <li><strong>LimitlessTCG:</strong> Copy deck list from tournament results</li>
                    <li><strong>Pokémon Live:</strong> Export from the official app</li>
                    <li><strong>PTCGO Lists:</strong> Standard tournament format</li>
                  </ul>
                  
                  <div className="format-example">
                    <strong>Example format:</strong>
                    <pre>{`Pokémon: 12
4 Charizard ex PAL 054
3 Charmander MEW 004
2 Charmeleon MEW 005

Trainer: 36
4 Professor's Research SVI 189
4 Ultra Ball SVI 196
2 Boss's Orders PAL 172

Energy: 12
8 Basic Fire Energy
4 Double Turbo Energy PAL 151

Total Cards: 60`}</pre>
                  </div>
                </div>
                
                <div className="import-textarea-container">
                  <div className="textarea-header">
                    <label htmlFor="importText">Paste your deck list here:</label>
                    {clipboardSupported && (
                      <button
                        onClick={pasteFromClipboard}
                        className="btn btn-small btn-info"
                        type="button"
                      >
                        📋 Paste from Clipboard
                      </button>
                    )}
                  </div>
                  <textarea
                    id="importText"
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    placeholder="Paste your deck list here..."
                    className="import-textarea"
                    rows={12}
                  />
                </div>
                
                <div className="import-actions">
                  <button
                    onClick={() => setShowImportModal(false)}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={importDeck}
                    className="btn btn-primary"
                    disabled={!importText.trim() || loading}
                  >
                    {loading ? 'Importing...' : '📥 Import Deck'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Card Detail Modal */}
        {selectedCard && (
          <div className="modal-overlay">
            <div className="modal">
              <div className="modal-header">
                <h2>{selectedCard.name}</h2>
                <button
                  onClick={() => setSelectedCard(null)}
                  className="modal-close"
                >
                  <X size={24} />
                </button>
              </div>
              
              <div className="modal-content">
                <div className="modal-image">
                  {selectedCard.images?.large && (
                    <img
                      src={selectedCard.images.large}
                      alt={selectedCard.name}
                    />
                  )}
                </div>
                
                <div className="modal-details">
                  <div className="detail-section">
                    <h3>Card Details</h3>
                    <div className="details-list">
                      <div><strong>Set:</strong> {selectedCard.set?.name}</div>
                      <div><strong>Number:</strong> {selectedCard.number}</div>
                      {selectedCard.types && <div><strong>Type:</strong> {selectedCard.types.join(', ')}</div>}
                      <div><strong>Supertype:</strong> {selectedCard.supertype}</div>
                      {selectedCard.hp && <div><strong>HP:</strong> {selectedCard.hp}</div>}
                      {selectedCard.rarity && <div><strong>Rarity:</strong> {selectedCard.rarity}</div>}
                    </div>
                  </div>

                  {selectedCard.attacks && (
                    <div className="detail-section">
                      <h3>Attacks</h3>
                      <div className="attacks-list">
                        {selectedCard.attacks.map((attack, index) => (
                          <div key={index} className="attack-item">
                            <div className="attack-name">{attack.name}</div>
                            {attack.cost && (
                              <div className="attack-cost">
                                Cost: {attack.cost.join(', ')}
                              </div>
                            )}
                            {attack.damage && (
                              <div className="attack-damage">Damage: {attack.damage}</div>
                            )}
                            {attack.text && (
                              <div className="attack-text">{attack.text}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedCard.tcgplayer?.prices && (
                    <div className="detail-section">
                      <h3>Market Price</h3>
                      <div className="price">
                        ${Object.values(selectedCard.tcgplayer.prices)[0]?.market?.toFixed(2) || 'N/A'}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PokemonTCGDeckBuilder;