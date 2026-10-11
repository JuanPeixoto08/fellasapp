// Migração das fotos do Storage pro Cloudinary (0042): as funções que listam o que falta, trocam o endereço em todo lugar e
// voltam tudo. Roda no PGlite com tabelas mínimas de posts e comentários (as do app não estão no banco dos jogos).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { beforeEach, describe, expect, it } from 'vitest';

import { freshDb, type TestDb } from './db';

let t: TestDb;
const q = async <T>(sql: string, p: unknown[] = []) => (await t.db.query<T>(sql, p)).rows;
const U = '00000000-0000-0000-0000-00000000000a';
const V = '00000000-0000-0000-0000-00000000000b';
const CLD = 'https://res.cloudinary.com/slxposvw/image/upload/x';

beforeEach(async () => {
  t = await freshDb();
  await t.db.exec(`
    create role service_role nologin;
    alter table public.profiles add column avatar_url text, add column banner_url text;
    create table public.posts (id int primary key, image_url text, images text[] not null default '{}');
    create table public.comments (id int primary key, images text[] not null default '{}');
  `);
  await t.db.exec(readFileSync(resolve(__dirname, '../../supabase/migrations/0042_fotos_cloudinary.sql'), 'utf8'));
  await t.member(U);
  await t.member(V);
  await q(`update public.profiles set avatar_url = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/avatar-1.gif', banner_url = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/banner-1.jpg' where id = $1`, [U]);
  await q(`update public.profiles set avatar_url = 'https://ja/estava.png' where id = $1`, [V]);
  await q(`insert into public.posts values (1, 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/1-0.jpg', '{aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/1-0.jpg,aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/1-1.jpg}'), (2, 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/2.jpg', '{}'), (3, null, '{}'), (4, '${CLD}/novo', '{}')`);
  await q(`insert into public.comments values (1, '{aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/c-0.jpg,aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/1-0.jpg}'), (2, '{}')`);
});

const pendentes = (n = 100) => q<{ caminho: string; uso: string }>('select * from public.fotos_pendentes($1)', [n]);

describe('fotos do Storage pro Cloudinary', () => {
  it('lista cada caminho do Storage uma vez, com o uso (post, perfil, banner); endereço completo fica de fora', async () => {
    expect(await pendentes()).toEqual([
      { caminho: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/1-0.jpg', uso: 'post' },
      { caminho: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/1-1.jpg', uso: 'post' },
      { caminho: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/2.jpg', uso: 'post' },
      { caminho: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/avatar-1.gif', uso: 'perfil' },
      { caminho: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/banner-1.jpg', uso: 'banner' },
      { caminho: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/c-0.jpg', uso: 'post' },
    ]);
    expect(await pendentes(2)).toHaveLength(2);
    expect((await q<{ n: number }>('select public.fotos_pendentes_total() as n'))[0].n).toBe(6);
  });
  it('trocar: o caminho vira o endereço em posts (capa e lista), comentários e perfil, e fica guardado pra voltar', async () => {
    await q(`select public.foto_trocar('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/1-0.jpg', '${CLD}/a', 'post')`);
    await q(`select public.foto_trocar('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/avatar-1.gif', '${CLD}/b', 'perfil')`);
    await q(`select public.foto_trocar('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/banner-1.jpg', '${CLD}/c', 'banner')`);
    expect(await q('select id, image_url, images from public.posts where id = 1')).toEqual([
      { id: 1, image_url: `${CLD}/a`, images: [`${CLD}/a`, 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/1-1.jpg'] },
    ]);
    expect((await q<{ images: string[] }>('select images from public.comments where id = 1'))[0].images).toEqual(['aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/c-0.jpg', `${CLD}/a`]);
    expect(await q('select avatar_url, banner_url from public.profiles where id = $1', [U])).toEqual([
      { avatar_url: `${CLD}/b`, banner_url: `${CLD}/c` },
    ]);
    expect((await q<{ n: number }>('select count(*)::int as n from public.fotos_migradas'))[0].n).toBe(3);
    expect((await pendentes()).map((p) => p.caminho)).toEqual(['aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/1-1.jpg', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/2.jpg', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/c-0.jpg']);
  });
  it('trocar de novo o mesmo caminho não quebra nada (rodar a migração duas vezes)', async () => {
    await q(`select public.foto_trocar('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/2.jpg', '${CLD}/d', 'post')`);
    await q(`select public.foto_trocar('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/2.jpg', '${CLD}/d', 'post')`);
    expect((await q<{ image_url: string }>('select image_url from public.posts where id = 2'))[0].image_url).toBe(`${CLD}/d`);
    expect((await q<{ n: number }>('select count(*)::int as n from public.fotos_migradas'))[0].n).toBe(1);
  });
  it('voltar: todo endereço migrado volta a ser o caminho do Storage', async () => {
    for (const [c, u, uso] of [['aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/1-0.jpg', 'a', 'post'], ['aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/avatar-1.gif', 'b', 'perfil'], ['aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/c-0.jpg', 'e', 'post']]) {
      await q(`select public.foto_trocar($1, $2, $3)`, [c, `${CLD}/${u}`, uso]);
    }
    expect((await q<{ n: number }>('select public.fotos_voltar() as n'))[0].n).toBe(3);
    expect(await q('select id, image_url, images from public.posts where id = 1')).toEqual([
      { id: 1, image_url: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/1-0.jpg', images: ['aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/1-0.jpg', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/1-1.jpg'] },
    ]);
    expect((await q<{ images: string[] }>('select images from public.comments where id = 1'))[0].images).toEqual(['aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/c-0.jpg', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/1-0.jpg']);
    expect((await q<{ avatar_url: string }>('select avatar_url from public.profiles where id = $1', [U]))[0].avatar_url).toBe('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/avatar-1.gif');
    expect(await pendentes()).toHaveLength(6);
  });
  it('caminho fora do formato <usuário>/<arquivo> (ex.: ../outro-bucket) nunca entra na lista', async () => {
    await q(`update public.profiles set avatar_url = '../outro/segredo.txt' where id = $1`, [V]);
    await q(`insert into public.posts values (9, 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/../../x', '{}')`);
    const lista = (await pendentes()).map((p) => p.caminho);
    expect(lista).not.toContain('../outro/segredo.txt');
    expect(lista).not.toContain('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/../../x');
  });
  it('ninguém do app chama: só a função (service_role)', async () => {
    await t.as(U);
    await expect(t.asRole('authenticated', 'select * from public.fotos_pendentes(10)')).rejects.toThrow();
    await expect(t.asRole('authenticated', `select public.foto_trocar('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/2.jpg', 'x', 'post')`)).rejects.toThrow();
    await expect(t.asRole('anon', 'select public.fotos_voltar()')).rejects.toThrow();
    await expect(t.asRole('authenticated', 'select * from public.fotos_migradas')).rejects.toThrow();
  });
});
