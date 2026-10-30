# 🎾 Tennis AI Predictor — Document de Spécification Technique

> **Version :** 1.0  
> **Date :** Mai 2026  
> **Statut :** Prêt pour développement  

---

## Table des matières

1. [Vue d'ensemble du projet](#1-vue-densemble-du-projet)
2. [Fonctionnalités principales](#2-fonctionnalités-principales)
3. [Architecture globale](#3-architecture-globale)
4. [Stack technologique](#4-stack-technologique)
5. [Sources de données tennis](#5-sources-de-données-tennis)
6. [Intégrations IA](#6-intégrations-ia)
7. [Moteur de verdict et score de confiance](#7-moteur-de-verdict-et-score-de-confiance)
8. [Architecture temps réel](#8-architecture-temps-réel)
9. [Structure du projet](#9-structure-du-projet)
10. [Modèles de données](#10-modèles-de-données)
11. [API Backend — Routes et contrats](#11-api-backend--routes-et-contrats)
12. [Frontend — Composants et UX](#12-frontend--composants-et-ux)
13. [Flux d'implémentation pas à pas](#13-flux-dimplémentation-pas-à-pas)
14. [Configuration et variables d'environnement](#14-configuration-et-variables-denvironnement)
15. [Gestion des erreurs et fallbacks](#15-gestion-des-erreurs-et-fallbacks)
16. [Sécurité](#16-sécurité)
17. [Tests](#17-tests)
18. [Déploiement](#18-déploiement)
19. [Roadmap et évolutions futures](#19-roadmap-et-évolutions-futures)

---

## 1. Vue d'ensemble du projet

### 1.1 Description

**Tennis AI Predictor** est une application web temps réel qui suit un match de tennis en direct, analyse les données statistiques à l'aide de trois modèles d'IA (Claude, GPT-4, Gemini), et prédit automatiquement le score le plus probable du prochain jeu à chaque fin de jeu en cours. Un moteur de verdict agrège les trois analyses et produit un résultat consensuel accompagné d'un **score de confiance**.

### 1.2 Cas d'usage principal

```
Utilisateur entre → "Berrettini vs Comesana"
          ↓
Application trouve le match live via l'API Tennis
          ↓
Polling toutes les 10 secondes des données live
          ↓
Détection de la fin du jeu en cours
          ↓
Appels parallèles à Claude + GPT-4 + Gemini
          ↓
Moteur de verdict → Score prédit + Indice de confiance
          ↓
Affichage temps réel dans l'UI
```

### 1.3 Contraintes techniques

- **Temps de réponse cible :** < 5 secondes entre la fin du jeu et l'affichage de la prédiction
- **Disponibilité :** Tolère la défaillance d'un modèle IA (dégradation gracieuse)
- **Polling tennis data :** Toutes les 10 secondes (respecte les limites d'API)
- **Stateless côté client :** Toute la logique d'état est côté serveur

---

## 2. Fonctionnalités principales

### 2.1 Recherche de match

- Champ de saisie pour les noms des deux joueurs (autocomplétion optionnelle)
- Recherche dans les matchs en cours via l'API SportRadar
- Affichage de la liste des matchs trouvés si plusieurs résultats
- Confirmation du match sélectionné

### 2.2 Suivi live du match

- Score en temps réel (sets, jeux, points)
- Statistiques clés en direct : aces, double fautes, 1er service %, winners, fautes non forcées, break points
- Indicateur de serveur actuel
- Historique des jeux joués avec scores

### 2.3 Prédiction automatique

- Déclenchement automatique à chaque fin de jeu
- Appels parallèles et simultanés aux 3 IA
- Affichage de l'analyse de chaque IA séparément
- Verdict consolidé avec score de confiance global
- Historique des prédictions et leur résultat réel (validation post-jeu)

### 2.4 Tableau de bord des performances

- Taux de précision de chaque IA sur le match en cours
- Comparaison des performances des 3 modèles
- Timeline des prédictions vs résultats réels

---

## 3. Architecture globale

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                         │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────────┐  │
│  │  Match Input │  │  Live Score  │  │  AI Predictions Panel  │  │
│  │  Component   │  │  Dashboard   │  │  Claude|GPT|Gemini     │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬────────────┘  │
│         │                 │  SSE Connection       │               │
└─────────┼─────────────────┼──────────────────────┼───────────────┘
          │                 │                       │
          ▼                 ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                     NEXT.JS SERVER (API Routes)                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │  /api/search │  │  /api/stream │  │  /api/predict        │   │
│  │  Find match  │  │  SSE handler │  │  Trigger AI calls    │   │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘   │
│         │                 │                       │               │
│  ┌──────▼─────────────────▼───────────────────────▼───────────┐  │
│  │                   CORE SERVICES                              │  │
│  │  ┌────────────┐  ┌─────────────┐  ┌────────────────────┐   │  │
│  │  │  Tennis    │  │  Game State │  │  AI Orchestrator   │   │  │
│  │  │  Data Svc  │  │  Detector   │  │  (Parallel calls)  │   │  │
│  │  └────────────┘  └─────────────┘  └────────────────────┘   │  │
│  │  ┌────────────────────────────────────────────────────────┐ │  │
│  │  │               Verdict Engine                            │ │  │
│  │  │  Claude result + GPT result + Gemini result → Verdict  │ │  │
│  │  └────────────────────────────────────────────────────────┘ │  │
│  └────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
          │                 │                       │
          ▼                 ▼                       ▼
┌──────────────┐  ┌──────────────┐       ┌──────────────────────┐
│  SportRadar  │  │    Redis     │       │    AI APIs           │
│  Tennis API  │  │  (cache +    │       │  ┌──────────────┐    │
│  (live data) │  │   state)     │       │  │ Anthropic    │    │
└──────────────┘  └──────────────┘       │  │ (Claude)     │    │
                                         │  ├──────────────┤    │
                                         │  │ OpenAI       │    │
                                         │  │ (GPT-4o)     │    │
                                         │  ├──────────────┤    │
                                         │  │ Google       │    │
                                         │  │ (Gemini 1.5) │    │
                                         │  └──────────────┘    │
                                         └──────────────────────┘
```

---

## 4. Stack technologique

### 4.1 Frontend

| Technologie | Version | Rôle |
|---|---|---|
| **Next.js** | 15.x (App Router) | Framework full-stack, SSR + API Routes |
| **React** | 19.x | UI library |
| **TypeScript** | 5.x | Typage statique |
| **Tailwind CSS** | 4.x | Styles utilitaires |
| **shadcn/ui** | Latest | Composants UI accessibles |
| **Recharts** | 2.x | Graphiques de performance IA |
| **Lucide React** | Latest | Icônes |
| **SWR** | 2.x | Data fetching & revalidation |

### 4.2 Backend

| Technologie | Version | Rôle |
|---|---|---|
| **Next.js API Routes** | 15.x | Endpoints REST + SSE |
| **Node.js** | 22.x LTS | Runtime serveur |
| **Redis** | 7.x (via Upstash) | Cache données tennis + état match |
| **Zod** | 3.x | Validation de schémas |
| **axios** | 1.x | Appels HTTP externes |

### 4.3 IA

| Modèle | Provider | SDK |
|---|---|---|
| **Claude Sonnet 4** | Anthropic | `@anthropic-ai/sdk` |
| **GPT-4o** | OpenAI | `openai` |
| **Gemini 1.5 Pro** | Google | `@google/generative-ai` |

### 4.4 Infrastructure

| Technologie | Rôle |
|---|---|
| **Vercel** | Hébergement (supporte SSE et Edge Functions) |
| **Upstash Redis** | Cache serverless (compatible Vercel) |
| **SportRadar API** | Source de données tennis live |

### 4.5 Pourquoi cette stack ?

- **Next.js App Router** : Gère nativement les Server-Sent Events, simplifie la séparation client/serveur, déploiement Vercel clé en main
- **Redis (Upstash)** : Stockage de l'état du match entre les requêtes serverless, cache des réponses API tennis pour limiter les appels
- **SSE plutôt que WebSockets** : Suffisant pour un flux unidirectionnel serveur → client, plus simple à déployer sur Vercel
- **Appels IA parallèles avec `Promise.allSettled`** : Tolérance aux pannes, un modèle IA qui échoue ne bloque pas les autres

---

## 5. Sources de données tennis

### 5.1 API recommandée : SportRadar Tennis API

**URL de base :** `https://api.sportradar.com/tennis/trial/v3/en`

#### Endpoints clés

```
GET /schedules/live/summaries.json
  → Liste tous les matchs en cours avec scores

GET /sport_events/{event_id}/summary.json
  → Détail complet d'un match (scores, stats, état du jeu)

GET /competitors/search.json?name={player_name}
  → Recherche de joueurs
```

#### Format de réponse pertinent (extrait)

```json
{
  "sport_event_status": {
    "status": "live",
    "match_status": "3rd_set",
    "home_score": 2,
    "away_score": 1,
    "period_scores": [
      { "home_score": 6, "away_score": 4, "type": "set", "number": 1 },
      { "home_score": 3, "away_score": 6, "type": "set", "number": 2 },
      { "home_score": 4, "away_score": 3, "type": "set", "number": 3 }
    ],
    "game_state": {
      "home_score": 30,
      "away_score": 40,
      "serving": "home",
      "tie_break": false
    }
  },
  "statistics": {
    "totals": {
      "competitors": [
        {
          "name": "Player A",
          "statistics": {
            "aces": 5,
            "double_faults": 2,
            "first_serve_successful": 38,
            "first_serve_points_won": 31,
            "service_points_won": 47,
            "breakpoints_won": 3,
            "total_breakpoints": 8,
            "forehand_winners": 12,
            "backhand_winners": 4,
            "forehand_unforced_errors": 8,
            "backhand_unforced_errors": 15,
            "points_won": 72,
            "points_won_from_last_10": 7
          }
        }
      ]
    }
  }
}
```

#### Alternatives si SportRadar n'est pas disponible

| API | Notes |
|---|---|
| **API-Tennis (RapidAPI)** | Plus accessible (freemium), couverture moindre |
| **OpenLigaDB** | Limité au tennis ATP principal |
| **The Odds API** | Données de cotes + scores, bonne alternative |

### 5.2 Stratégie de polling

```
┌─────────────────────────────────────────────────┐
│  Polling interval adaptatif                      │
│                                                  │
│  Entre les points  → toutes les 10 secondes     │
│  Score 40/40 (deuce) → toutes les 5 secondes    │
│  Fin de jeu détectée → traitement immédiat       │
└─────────────────────────────────────────────────┘
```

**Détection de fin de jeu :**  
Comparer le nombre total de jeux gagnés entre deux polls consécutifs. Si `gamesWon_t1 !== gamesWon_t0`, un jeu vient de se terminer → déclencher les prédictions.

---

## 6. Intégrations IA

### 6.1 Prompt système commun (base)

```
Tu es un expert analyste de tennis professionnel avec 20 ans d'expérience.
Tu analyses des données statistiques de matchs ATP/WTA en temps réel.
Ton rôle est de prédire le résultat le plus probable du prochain jeu
(qui va remporter le jeu) en te basant sur les données fournies.

RÈGLES :
- Réponds UNIQUEMENT au format JSON spécifié
- Base-toi sur les statistiques concrètes, pas sur la réputation des joueurs
- Évalue la dynamique récente (points_won_from_last_10) comme indicateur clé
- Justifie chaque facteur avec les données correspondantes
```

### 6.2 Prompt utilisateur (template)

```
CONTEXTE DU MATCH :
- Tournoi : {tournament_name}
- Surface : {surface}
- Set actuel : {current_set} | Score sets : {home_sets}-{away_sets}
- Score en jeux dans le set : {home_games}-{away_games}
- Serveur du prochain jeu : {next_server}

STATISTIQUES GLOBALES DU MATCH :

{player_home} :
- Aces : {aces_home} | Double fautes : {df_home}
- 1er service réussi : {first_serve_in_home}%
- Points gagnés sur 1er service : {first_serve_won_home}%
- Points gagnés sur 2e service : {second_serve_won_home}%
- Winners : {winners_home} | Fautes directes non forcées : {ufe_home}
- Break points convertis : {bp_won_home}/{bp_total_home}
- Points gagnés sur les 10 derniers : {last10_home}/10
- Jeux de service remportés : {service_games_won_home}

{player_away} :
- Aces : {aces_away} | Double fautes : {df_away}
- 1er service réussi : {first_serve_in_away}%
- Points gagnés sur 1er service : {first_serve_won_away}%
- Points gagnés sur 2e service : {second_serve_won_away}%
- Winners : {winners_away} | Fautes directes non forcées : {ufe_away}
- Break points convertis : {bp_won_away}/{bp_total_away}
- Points gagnés sur les 10 derniers : {last10_away}/10
- Jeux de service remportés : {service_games_won_away}

QUESTION : Qui va remporter le prochain jeu (jeu n°{next_game_number}) ?
Le serveur sera : {next_server}

Réponds UNIQUEMENT avec ce JSON :
{
  "predicted_winner": "{player_home | player_away}",
  "win_probability": <nombre entre 0.5 et 1.0>,
  "serving_player": "{player_home | player_away}",
  "is_break_predicted": <true | false>,
  "key_factors": [
    { "factor": "Nom du facteur", "value": "Valeur observée", "impact": "positive | negative | neutral" }
  ],
  "predicted_score": "<ex: 40-15 | 40-30 | deuce>",
  "reasoning": "Explication concise en 2-3 phrases"
}
```

### 6.3 Implémentation Claude (Anthropic)

```typescript
// services/ai/claude.service.ts
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function getClaudePrediction(
  matchData: MatchData,
  prompt: string
): Promise<AIPrediction> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  return parseAIResponse('claude', text);
}
```

### 6.4 Implémentation GPT-4o (OpenAI)

```typescript
// services/ai/openai.service.ts
import OpenAI from 'openai';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function getGPTPrediction(
  matchData: MatchData,
  prompt: string
): Promise<AIPrediction> {
  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 1024,
    temperature: 0.3, // Basse pour des prédictions cohérentes
  });

  const text = response.choices[0].message.content ?? '';
  return parseAIResponse('gpt4o', text);
}
```

### 6.5 Implémentation Gemini (Google)

```typescript
// services/ai/gemini.service.ts
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function getGeminiPrediction(
  matchData: MatchData,
  prompt: string
): Promise<AIPrediction> {
  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-pro',
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.3,
    },
  });

  const result = await model.generateContent([SYSTEM_PROMPT, prompt]);
  const text = result.response.text();
  return parseAIResponse('gemini', text);
}
```

### 6.6 Orchestrateur IA (appels parallèles)

```typescript
// services/ai/orchestrator.ts
export async function runAllPredictions(
  matchData: MatchData
): Promise<OrchestrationResult> {
  const prompt = buildPrompt(matchData);

  // Appels parallèles avec tolérance aux pannes
  const [claudeResult, gptResult, geminiResult] = await Promise.allSettled([
    getClaudePrediction(matchData, prompt),
    getGPTPrediction(matchData, prompt),
    getGeminiPrediction(matchData, prompt),
  ]);

  const predictions: AIPrediction[] = [];

  if (claudeResult.status === 'fulfilled') predictions.push(claudeResult.value);
  if (gptResult.status === 'fulfilled') predictions.push(gptResult.value);
  if (geminiResult.status === 'fulfilled') predictions.push(geminiResult.value);

  if (predictions.length === 0) throw new Error('All AI calls failed');

  const verdict = computeVerdict(predictions);
  return { predictions, verdict };
}
```

---

## 7. Moteur de verdict et score de confiance

### 7.1 Algorithme de vote pondéré

Le moteur de verdict agrège les 3 prédictions selon un système de **vote pondéré** :

```typescript
// services/verdict.engine.ts

interface Weight {
  claude: number;
  gpt4o: number;
  gemini: number;
}

// Pondération de base (peut être ajustée dynamiquement selon les performances passées)
const BASE_WEIGHTS: Weight = {
  claude: 0.35,
  gpt4o: 0.35,
  gemini: 0.30,
};

export function computeVerdict(predictions: AIPrediction[]): VerdictResult {
  // 1. Compter les votes par joueur
  const votes: Record<string, number> = {};
  const totalWeight = predictions.reduce((sum, p) => sum + getWeight(p.model), 0);

  for (const pred of predictions) {
    const weight = getWeight(pred.model) / totalWeight;
    votes[pred.predicted_winner] = (votes[pred.predicted_winner] ?? 0) + weight;
  }

  // 2. Déterminer le gagnant prédit
  const predictedWinner = Object.entries(votes).sort(([,a],[,b]) => b - a)[0][0];
  const winnerVoteShare = votes[predictedWinner];

  // 3. Calculer le score de confiance composite
  const avgProbability = predictions
    .filter(p => p.predicted_winner === predictedWinner)
    .reduce((sum, p) => sum + p.win_probability, 0) / predictions.length;

  // 4. Facteur de consensus (1.0 = unanime, 0.33 = désaccord total)
  const consensusFactor = winnerVoteShare; // entre 0 et 1

  // 5. Score de confiance final (0-100)
  const confidenceScore = Math.round(
    (avgProbability * 0.6 + consensusFactor * 0.4) * 100
  );

  // 6. Niveau de confiance qualitatif
  const confidenceLevel =
    confidenceScore >= 80 ? 'HIGH' :
    confidenceScore >= 60 ? 'MEDIUM' : 'LOW';

  // 7. Accord des modèles
  const agreement = predictions.every(p => p.predicted_winner === predictedWinner)
    ? 'UNANIMOUS'
    : predictions.filter(p => p.predicted_winner === predictedWinner).length >= 2
    ? 'MAJORITY'
    : 'SPLIT';

  return {
    predicted_winner: predictedWinner,
    confidence_score: confidenceScore,
    confidence_level: confidenceLevel,
    agreement,
    vote_breakdown: votes,
    is_break_predicted: predictions.filter(p => p.is_break_predicted).length >= 2,
    predicted_score: getMostCommonScore(predictions),
    summary: buildSummary(predictions, predictedWinner, confidenceScore),
  };
}
```

### 7.2 Affichage du score de confiance

```
┌─────────────────────────────────────────────┐
│  🎾 VERDICT FINAL — Jeu 8                   │
│                                              │
│  Gagnant prédit : BERRETTINI                │
│                                              │
│  Score de confiance : ████████░░  78%       │
│  Niveau : ● MEDIUM                          │
│  Accord : MAJORITY (2/3 modèles)            │
│                                              │
│  Score prédit : 40-30                        │
│  Break prédit : NON                          │
│                                              │
│  ┌──────────┬───────────┬──────────────┐    │
│  │ Claude   │ GPT-4o    │ Gemini       │    │
│  │ Berr. ✓  │ Berr. ✓   │ Comes. ✗    │    │
│  │ 65%      │ 70%       │ 58%          │    │
│  └──────────┴───────────┴──────────────┘    │
└─────────────────────────────────────────────┘
```

### 7.3 Pondération dynamique (optionnel — Phase 2)

Après chaque jeu, enregistrer le résultat réel et ajuster les poids selon les performances :

```typescript
function updateWeights(
  currentWeights: Weight,
  predictions: AIPrediction[],
  actualWinner: string
): Weight {
  const learningRate = 0.05;

  return {
    claude: adjustWeight(currentWeights.claude, predictions.find(p => p.model === 'claude'), actualWinner, learningRate),
    gpt4o: adjustWeight(currentWeights.gpt4o, predictions.find(p => p.model === 'gpt4o'), actualWinner, learningRate),
    gemini: adjustWeight(currentWeights.gemini, predictions.find(p => p.model === 'gemini'), actualWinner, learningRate),
  };
}
```

---

## 8. Architecture temps réel

### 8.1 Server-Sent Events (SSE)

Choix de **SSE** plutôt que WebSockets car :
- Flux **unidirectionnel** suffisant (serveur → client)
- Compatible natif avec **Vercel Edge Functions**
- Reconnexion automatique côté client
- Plus simple à implémenter et déboguer

```typescript
// app/api/stream/[matchId]/route.ts
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { matchId: string } }
) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // Envoi de l'état initial
      const initialData = await getMatchData(params.matchId);
      controller.enqueue(encoder.encode(formatSSE('match_update', initialData)));

      // Polling toutes les 10 secondes
      const interval = setInterval(async () => {
        try {
          const newData = await getMatchData(params.matchId);
          const gameEnded = detectGameEnd(newData, params.matchId);

          // Toujours envoyer la mise à jour du score
          controller.enqueue(encoder.encode(formatSSE('match_update', newData)));

          // Si un jeu vient de se terminer, lancer les prédictions
          if (gameEnded) {
            controller.enqueue(encoder.encode(formatSSE('prediction_start', {})));

            const result = await runAllPredictions(newData);
            controller.enqueue(encoder.encode(formatSSE('prediction_result', result)));
          }
        } catch (err) {
          controller.enqueue(encoder.encode(formatSSE('error', { message: 'Poll failed' })));
        }
      }, 10000);

      // Nettoyage à la déconnexion
      req.signal.addEventListener('abort', () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

function formatSSE(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}
```

### 8.2 Hook React client pour SSE

```typescript
// hooks/useMatchStream.ts
import { useState, useEffect, useCallback } from 'react';

export function useMatchStream(matchId: string | null) {
  const [matchData, setMatchData] = useState<MatchData | null>(null);
  const [predictions, setPredictions] = useState<PredictionEvent[]>([]);
  const [isPredicting, setIsPredicting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');

  useEffect(() => {
    if (!matchId) return;

    setConnectionStatus('connecting');
    const eventSource = new EventSource(`/api/stream/${matchId}`);

    eventSource.addEventListener('match_update', (e) => {
      setMatchData(JSON.parse(e.data));
      setConnectionStatus('connected');
    });

    eventSource.addEventListener('prediction_start', () => {
      setIsPredicting(true);
    });

    eventSource.addEventListener('prediction_result', (e) => {
      const result = JSON.parse(e.data);
      setPredictions(prev => [...prev, result]);
      setIsPredicting(false);
    });

    eventSource.addEventListener('error', () => {
      setConnectionStatus('disconnected');
    });

    eventSource.onerror = () => {
      setConnectionStatus('disconnected');
      // EventSource reconnecte automatiquement
    };

    return () => {
      eventSource.close();
      setConnectionStatus('disconnected');
    };
  }, [matchId]);

  return { matchData, predictions, isPredicting, connectionStatus };
}
```

### 8.3 Détection de fin de jeu

```typescript
// services/game-state.service.ts
import { redis } from '@/lib/redis';

export async function detectGameEnd(
  currentData: TennisAPIResponse,
  matchId: string
): Promise<boolean> {
  const previousKey = `match:${matchId}:lastGamesCount`;
  const previousCount = await redis.get(previousKey);

  const currentGamesCount = getTotalGamesPlayed(currentData);

  if (previousCount !== null && Number(previousCount) !== currentGamesCount) {
    await redis.set(previousKey, currentGamesCount, { ex: 3600 });
    return true; // Un jeu s'est terminé
  }

  await redis.set(previousKey, currentGamesCount, { ex: 3600 });
  return false;
}

function getTotalGamesPlayed(data: TennisAPIResponse): number {
  return data.sport_event_status.period_scores.reduce(
    (sum, set) => sum + set.home_score + set.away_score, 0
  );
}
```

---

## 9. Structure du projet

```
tennis-ai-predictor/
├── app/
│   ├── page.tsx                    # Page d'accueil + recherche de match
│   ├── match/
│   │   └── [matchId]/
│   │       └── page.tsx            # Page de suivi du match
│   ├── api/
│   │   ├── search/
│   │   │   └── route.ts            # GET /api/search?q=Berrettini
│   │   ├── stream/
│   │   │   └── [matchId]/
│   │   │       └── route.ts        # SSE stream endpoint
│   │   └── predict/
│   │       └── [matchId]/
│   │           └── route.ts        # POST manuel (debug)
│   └── layout.tsx
│
├── components/
│   ├── match/
│   │   ├── PlayerSearch.tsx        # Formulaire de recherche
│   │   ├── MatchCard.tsx           # Carte de résultat de recherche
│   │   ├── LiveScoreBoard.tsx      # Tableau de score temps réel
│   │   ├── StatsPanel.tsx          # Statistiques des joueurs
│   │   └── GameHistory.tsx         # Historique des jeux
│   ├── predictions/
│   │   ├── PredictionPanel.tsx     # Container des 3 prédictions IA
│   │   ├── AICard.tsx              # Carte individuelle par IA
│   │   ├── VerdictCard.tsx         # Verdict final + score de confiance
│   │   ├── ConfidenceMeter.tsx     # Jauge de confiance visuelle
│   │   └── PredictionHistory.tsx   # Historique + accuracy
│   └── ui/                         # Composants shadcn/ui générés
│
├── hooks/
│   ├── useMatchStream.ts           # Hook SSE principal
│   ├── useMatchSearch.ts           # Hook recherche de match
│   └── usePredictionHistory.ts     # Gestion historique prédictions
│
├── services/
│   ├── tennis/
│   │   ├── sportradar.client.ts    # Client API SportRadar
│   │   ├── match.service.ts        # Logique métier match
│   │   └── game-state.service.ts   # Détection état du jeu
│   ├── ai/
│   │   ├── claude.service.ts       # Service Claude
│   │   ├── openai.service.ts       # Service GPT-4o
│   │   ├── gemini.service.ts       # Service Gemini
│   │   ├── orchestrator.ts         # Coordination des 3 IA
│   │   └── prompt.builder.ts       # Construction des prompts
│   └── verdict.engine.ts           # Algorithme de verdict
│
├── lib/
│   ├── redis.ts                    # Client Redis (Upstash)
│   └── utils.ts                    # Utilitaires communs
│
├── types/
│   ├── tennis.types.ts             # Types données tennis
│   ├── ai.types.ts                 # Types réponses IA
│   └── verdict.types.ts            # Types verdict
│
├── constants/
│   └── prompts.ts                  # Prompts système IA
│
├── .env.local                      # Variables d'environnement (non commité)
├── .env.example                    # Template variables
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## 10. Modèles de données

### 10.1 Types TypeScript principaux

```typescript
// types/tennis.types.ts

export interface MatchData {
  id: string;
  status: 'live' | 'final' | 'scheduled';
  tournament: string;
  surface: 'clay' | 'hard' | 'grass' | 'indoor';
  players: {
    home: Player;
    away: Player;
  };
  score: {
    sets: { home: number; away: number };
    currentSet: SetScore;
    currentGame: GameScore;
    serving: 'home' | 'away';
  };
  statistics: {
    home: PlayerStats;
    away: PlayerStats;
  };
  nextGame: {
    number: number;
    server: 'home' | 'away';
  };
}

export interface Player {
  id: string;
  name: string;
  country: string;
  seed?: number;
}

export interface PlayerStats {
  aces: number;
  doubleFaults: number;
  firstServePercentage: number;
  firstServePointsWon: number;
  secondServePointsWon: number;
  winners: number;
  unforcedErrors: number;
  breakPointsWon: number;
  breakPointsTotal: number;
  pointsWonLast10: number;
  serviceGamesWon: number;
  gamesWon: number;
}

// types/ai.types.ts

export interface AIPrediction {
  model: 'claude' | 'gpt4o' | 'gemini';
  predicted_winner: string; // Nom du joueur
  win_probability: number;  // 0.5 - 1.0
  serving_player: string;
  is_break_predicted: boolean;
  predicted_score: string;  // ex: "40-15"
  key_factors: KeyFactor[];
  reasoning: string;
  latency_ms: number;
  error?: string;
}

export interface KeyFactor {
  factor: string;
  value: string;
  impact: 'positive' | 'negative' | 'neutral';
}

// types/verdict.types.ts

export interface VerdictResult {
  predicted_winner: string;
  confidence_score: number;    // 0-100
  confidence_level: 'HIGH' | 'MEDIUM' | 'LOW';
  agreement: 'UNANIMOUS' | 'MAJORITY' | 'SPLIT';
  vote_breakdown: Record<string, number>;
  is_break_predicted: boolean;
  predicted_score: string;
  summary: string;
}

export interface PredictionEvent {
  game_number: number;
  set_number: number;
  timestamp: string;
  predictions: AIPrediction[];
  verdict: VerdictResult;
  actual_winner?: string;      // Renseigné après le jeu
  was_correct?: boolean;       // true/false après validation
}
```

---

## 11. API Backend — Routes et contrats

### 11.1 GET `/api/search`

**Paramètres :**
```
?q=Berrettini+Comesana
```

**Réponse :**
```json
{
  "matches": [
    {
      "id": "sr:sport_event:71563762",
      "status": "live",
      "tournament": "French Open Men Singles",
      "home_player": "Berrettini, Matteo",
      "away_player": "Comesana, Francisco",
      "score": "3-4 (1st set)"
    }
  ],
  "total": 1
}
```

### 11.2 GET `/api/stream/[matchId]`

**SSE Events émis :**

| Event | Payload | Déclencheur |
|---|---|---|
| `match_update` | `MatchData` | Chaque poll (10s) |
| `prediction_start` | `{}` | Détection fin de jeu |
| `prediction_result` | `{ predictions, verdict }` | Après appels IA |
| `match_ended` | `{ final_score }` | Match terminé |
| `error` | `{ message, code }` | Erreur serveur |
| `heartbeat` | `{ timestamp }` | Toutes les 30s (keepalive) |

### 11.3 POST `/api/predict/[matchId]`

Endpoint de déclenchement manuel (debug/tests).

**Body :** `{}`

**Réponse :**
```json
{
  "predictions": [
    {
      "model": "claude",
      "predicted_winner": "Berrettini, Matteo",
      "win_probability": 0.65,
      "is_break_predicted": false,
      "predicted_score": "40-30",
      "reasoning": "..."
    }
  ],
  "verdict": {
    "predicted_winner": "Berrettini, Matteo",
    "confidence_score": 72,
    "confidence_level": "MEDIUM",
    "agreement": "UNANIMOUS"
  }
}
```

---

## 12. Frontend — Composants et UX

### 12.1 Page d'accueil — Recherche de match

```
┌─────────────────────────────────────────────────────┐
│  🎾 Tennis AI Predictor                             │
│                                                     │
│  Entrez les noms des deux joueurs :                 │
│  ┌─────────────────────────────────────────────┐   │
│  │  ex: Berrettini Comesana                    │   │
│  └─────────────────────────────────────────────┘   │
│                       [Rechercher]                  │
│                                                     │
│  Matchs en cours trouvés :                         │
│  ┌─────────────────────────────────────────────┐   │
│  │  🔴 LIVE  Berrettini vs Comesana            │   │
│  │  French Open — Court Simonne Mathieu        │   │
│  │  Score : 3-4 (1er set)                      │   │
│  │              [Suivre ce match →]            │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### 12.2 Page match — Layout principal

```
┌──────────────────────────────────────────────────────────────────┐
│  🔴 LIVE  French Open — Court Simonne Mathieu          🔗 ●●●   │
├─────────────────────────┬────────────────────────────────────────┤
│   SCORE EN DIRECT        │   PRÉDICTION — JEU 9                 │
│                          │                                        │
│  Berrettini  3-4  Comes. │  ⏳ Analyse en cours...              │
│  (3e set)                │  Claude ████░░ 65%                    │
│  40  |  15               │  GPT-4o ████░░ 70%                    │
│  🎾 Berrettini           │  Gemini ███░░░ 58%                    │
│                          │                                        │
├─────────────────────────┤  ┌────────────────────────────────┐   │
│   STATISTIQUES           │  │ 🏆 VERDICT                     │   │
│                          │  │ Berrettini remporte le jeu     │   │
│  1er serv. %  78%  91%  │  │ Score de confiance : 68/100    │   │
│  Winners      5    3    │  │ ████████░░░  MEDIUM            │   │
│  F. non forc. 5    2    │  │ Accord : MAJORITY (2/3)        │   │
│  BP gagnés   0/0  0/0  │  └────────────────────────────────┘   │
│                          │                                        │
├─────────────────────────┴────────────────────────────────────────┤
│   HISTORIQUE DES PRÉDICTIONS                                      │
│                                                                    │
│  Jeu 7 → Comesana prédit (conf: 70%) → Comesana ✅ CORRECT      │
│  Jeu 6 → Berrettini prédit (conf: 65%) → Berrettini ✅ CORRECT  │
│  Jeu 5 → Berrettini prédit (conf: 60%) → Comesana ❌ INCORRECT  │
│                                                         Acc: 67%  │
└──────────────────────────────────────────────────────────────────┘
```

### 12.3 Composant AICard

```typescript
// components/predictions/AICard.tsx
interface AICardProps {
  model: 'claude' | 'gpt4o' | 'gemini';
  prediction: AIPrediction | null;
  isLoading: boolean;
}

const MODEL_CONFIG = {
  claude: { name: 'Claude', color: 'orange', icon: '🤖' },
  gpt4o: { name: 'GPT-4o', color: 'green', icon: '🧠' },
  gemini: { name: 'Gemini', color: 'blue', icon: '✨' },
};
```

---

## 13. Flux d'implémentation pas à pas

### Phase 1 — Fondations (Semaine 1)

```
□ Initialiser projet Next.js 15 avec TypeScript + Tailwind
□ Installer et configurer shadcn/ui
□ Configurer Redis (Upstash) — créer compte + instance
□ Implémenter client SportRadar (sportradar.client.ts)
□ Créer endpoint /api/search avec données mockées
□ Créer page d'accueil + composant PlayerSearch
□ Tests d'intégration API SportRadar avec clé d'essai
```

### Phase 2 — Données live (Semaine 2)

```
□ Implémenter match.service.ts (fetch + normalisation données)
□ Implémenter game-state.service.ts (détection fin de jeu + Redis)
□ Créer endpoint SSE /api/stream/[matchId]
□ Implémenter hook useMatchStream côté client
□ Créer composants LiveScoreBoard et StatsPanel
□ Tests avec match live réel
```

### Phase 3 — Intégration IA (Semaine 3)

```
□ Implémenter prompt.builder.ts
□ Implémenter claude.service.ts + tests
□ Implémenter openai.service.ts + tests
□ Implémenter gemini.service.ts + tests
□ Implémenter orchestrator.ts (Promise.allSettled)
□ Implémenter verdict.engine.ts
□ Connecter prédictions au flux SSE
□ Créer composants AICard, VerdictCard, ConfidenceMeter
```

### Phase 4 — Historique et polish (Semaine 4)

```
□ Implémenter validation post-jeu (actual_winner)
□ Créer PredictionHistory avec taux de précision
□ Ajouter graphique de performance des IA (Recharts)
□ Gestion des erreurs et états de chargement
□ Optimisations UX (animations, responsive mobile)
□ Tests end-to-end
□ Déploiement Vercel
```

---

## 14. Configuration et variables d'environnement

### 14.1 Fichier `.env.local`

```bash
# Tennis Data API
SPORTRADAR_API_KEY=your_sportradar_key
SPORTRADAR_BASE_URL=https://api.sportradar.com/tennis/trial/v3/en

# AI APIs
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=AIza...

# Redis (Upstash)
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx

# App Config
NEXT_PUBLIC_APP_URL=http://localhost:3000
POLL_INTERVAL_MS=10000
AI_TIMEOUT_MS=15000
```

### 14.2 Configuration Next.js

```typescript
// next.config.ts
const nextConfig = {
  experimental: {
    serverActions: { allowedOrigins: ['localhost:3000'] },
  },
  // Augmenter la durée des routes SSE
  serverExternalPackages: ['@anthropic-ai/sdk', 'openai', '@google/generative-ai'],
};
```

---

## 15. Gestion des erreurs et fallbacks

### 15.1 Hiérarchie des fallbacks

```
SportRadar API indisponible
  → Utiliser données en cache Redis (max 30 secondes)
  → Si cache expiré → afficher message "Données temporairement indisponibles"

1 modèle IA en erreur (timeout > 15s ou HTTP 5xx)
  → Continuer avec les 2 modèles restants
  → Afficher "X indisponible" sur la carte du modèle
  → Verdict calculé sur N=2

2 modèles IA en erreur
  → Verdict calculé sur N=1
  → Confidence_score plafonné à 60 (incertitude forcée)
  → Avertissement UI : "Analyse partielle"

0 modèle IA disponible
  → Message d'erreur explicite
  → Retry automatique après 30 secondes

Connexion SSE perdue
  → EventSource reconnecte automatiquement (natif)
  → Indicateur visuel "Reconnexion en cours..."
```

### 15.2 Gestion des timeouts IA

```typescript
async function callWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  model: string
): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`${model} timeout after ${timeoutMs}ms`)), timeoutMs)
  );
  return Promise.race([promise, timeout]);
}
```

---

## 16. Sécurité

### 16.1 Protection des clés API

- Toutes les clés API sont des **variables d'environnement serveur** (sans préfixe `NEXT_PUBLIC_`)
- Les appels IA se font **exclusivement côté serveur** (API Routes Next.js)
- Le client ne reçoit que les résultats formatés, jamais les clés

### 16.2 Rate limiting

```typescript
// Limiter les requêtes de recherche (éviter l'abus)
import { Ratelimit } from '@upstash/ratelimit';

const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1m'), // 10 requêtes/minute par IP
});
```

### 16.3 Validation des entrées

```typescript
import { z } from 'zod';

const searchSchema = z.object({
  q: z.string().min(3).max(100).trim(),
});

// Dans la route API
const result = searchSchema.safeParse(params);
if (!result.success) return Response.json({ error: 'Invalid input' }, { status: 400 });
```

---

## 17. Tests

### 17.1 Tests unitaires (Jest + Testing Library)

```bash
npm run test
```

Couvrir :
- `verdict.engine.ts` — cas unanime, majorité, split
- `game-state.service.ts` — détection correcte de fin de jeu
- `prompt.builder.ts` — template complet avec toutes les variables
- `sportradar.client.ts` — normalisation des données API

### 17.2 Tests d'intégration

```bash
npm run test:integration
```

Couvrir :
- Endpoint `/api/search` — recherche réelle vs mock
- Endpoint SSE — réception des events dans l'ordre
- Appels IA — validation du format JSON de réponse

### 17.3 Tests E2E (Playwright)

```bash
npm run test:e2e
```

Scénarios :
1. Recherche d'un match → sélection → affichage du score live
2. Réception d'une prédiction après fin de jeu simulée
3. Reconnexion SSE après déconnexion simulée

---

## 18. Déploiement

### 18.1 Vercel (recommandé)

```bash
# Installation Vercel CLI
npm i -g vercel

# Déploiement
vercel deploy --prod
```

**Configuration Vercel :**
- Region : `cdg1` (Paris) — latence optimale avec les APIs EU
- Function timeout : `60s` pour les routes SSE et IA
- Variables d'environnement : configurer dans le dashboard Vercel

### 18.2 Variables à configurer dans Vercel Dashboard

```
SPORTRADAR_API_KEY
ANTHROPIC_API_KEY
OPENAI_API_KEY
GEMINI_API_KEY
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
```

### 18.3 Commandes utiles

```bash
npm run dev          # Développement local
npm run build        # Build de production
npm run start        # Serveur de production local
npm run lint         # ESLint
npm run test         # Tests unitaires
vercel deploy --prod # Déploiement production
```

---

## 19. Roadmap et évolutions futures

### Phase 2 — Fonctionnalités avancées

- **Pondération dynamique des IA** : Ajustement des poids selon la précision historique par surface / tournoi
- **Support multi-matchs** : Suivre plusieurs matchs en simultané
- **Notifications push** : Alerte navigateur à chaque nouvelle prédiction
- **Export PDF** : Rapport de match complet avec toutes les prédictions

### Phase 3 — Intelligence avancée

- **Analyse de tendance** : Détection des momentum shifts sur plusieurs jeux consécutifs
- **Données historiques** : Enrichir le prompt avec H2H (confrontations directes) et stats sur surface
- **Modèle de scoring personnalisé** : Fine-tuning d'un modèle léger pour la prédiction tennis
- **Dashboard analytics** : Performances des IA sur tous les matchs suivis

### Phase 4 — Scalabilité

- **Architecture microservices** : Séparer le service tennis data, l'orchestrateur IA et l'API gateway
- **Queue de tâches** (BullMQ) : Gérer les pics de charge lors des grands tournois
- **Streaming des réponses IA** : Afficher l'analyse en temps réel pendant la génération

---

## Annexe A — Dépendances npm

```json
{
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "typescript": "^5.0.0",
    "@anthropic-ai/sdk": "^0.30.0",
    "openai": "^4.60.0",
    "@google/generative-ai": "^0.21.0",
    "@upstash/redis": "^1.34.0",
    "@upstash/ratelimit": "^2.0.0",
    "axios": "^1.7.0",
    "zod": "^3.23.0",
    "recharts": "^2.12.0",
    "lucide-react": "^0.400.0",
    "swr": "^2.2.0",
    "tailwindcss": "^4.0.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "jest": "^29.0.0",
    "@testing-library/react": "^16.0.0",
    "playwright": "^1.45.0",
    "eslint": "^9.0.0"
  }
}
```

---

## Annexe B — Commandes d'initialisation du projet

```bash
# 1. Créer le projet Next.js
npx create-next-app@latest tennis-ai-predictor \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir=false

cd tennis-ai-predictor

# 2. Installer les dépendances IA
npm install @anthropic-ai/sdk openai @google/generative-ai

# 3. Installer Redis et utilitaires
npm install @upstash/redis @upstash/ratelimit axios zod swr

# 4. Installer composants UI
npm install recharts lucide-react class-variance-authority clsx
npx shadcn@latest init
npx shadcn@latest add card badge button input progress

# 5. Installer outils de développement
npm install -D jest @testing-library/react @testing-library/jest-dom playwright

# 6. Copier le .env.example
cp .env.example .env.local
# → Renseigner toutes les clés API
```

---

*Document généré pour la création de l'application Tennis AI Predictor.*  
*Toutes les technologies, APIs et approches mentionnées sont choisies pour leur adéquation au cas d'usage et leur maturité en production.*
