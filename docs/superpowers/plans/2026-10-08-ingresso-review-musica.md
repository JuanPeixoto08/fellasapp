# Ingresso (review + música) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Anexar ao post um ingresso com a sua review do Letterboxd ou a música do Last.fm, congelado e validado no banco.

**Architecture:** `posts.media jsonb` (check `post_media_ok` + trava) e `profiles.letterboxd_user`. Letterboxd via
Edge Function `letterboxd-reviews` (sem parâmetro: lê o usuário de quem chama). Last.fm no cliente. `lib/postMedia.ts`
monta e revalida anexos; `PostTicket` desenha; dois seletores no compositor.

**Tech Stack:** Expo Router / RN (+ web), Supabase (Postgres, Edge Function Deno), Jest + RNTL.

**Spec:** `docs/superpowers/specs/2026-10-08-ingresso-review-musica-design.md`

## Global Constraints
- pt-BR; tokens de `lib/theme.ts`; primitivos em `components/ui`; `npx tsc --noEmit` e `npm test` a cada tarefa.
- Hosts: Last.fm páginas `https://(www.)last.fm/`, capas `https://lastfm-img.freetls.fastly.net/`; Letterboxd
  páginas `https://letterboxd.com/<user>/film/`, pôsteres `https://a.ltrbxd.com/`.
- Publicação: links → push; depois migração + função pelo Juan → conferir → push.

## Review Focus
- Review sem nota, sem ano ou sem pôster → ingresso sem esses pedaços, sem quebrar.
- Link colado de outra pessoa, de uma lista, ou review antiga (fora das ~50) → mensagem clara, nada anexado.
- Spoiler marcado → texto escondido; sem marca → normal; a linha em inglês nunca aparece.
- Capa/pôster que não carrega → canhoto liso com ícone.
- Post com música anexada → sem a linha ao vivo do cabeçalho.

---
### Task 1: Links tocáveis no texto (`lib/mentions.ts` split + `MentionText`) — push sozinho
### Task 2: `lib/postMedia.ts` — tipos, montar de Last.fm/review, revalidar para desenhar
### Task 3: Edge Function `letterboxd-reviews` (`rules.ts` parser puro + `handler.ts` + `index.ts`) e `lib/api/letterboxd.ts`
### Task 4: Migração 0026 + tipos + README + teste da migração
### Task 5: Perfil: "Usuário no Letterboxd" (API + Editar perfil)
### Task 6: Posts: `FeedPost.media`, `createPost({ media })`
### Task 7: `PostTicket` (review/música, spoiler, "mais", imagem que falha) no `PostCard`; esconde a linha ao vivo
### Task 8: Compositor: rascunho `media`, botões 🎬/♪, `ReviewPicker` e `MusicPicker`, ingresso anexado com ✕
### Task 9: DESIGN.md, passada visual, publicação
